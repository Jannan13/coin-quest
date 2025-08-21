import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// ===============================
// API ROUTES
// ===============================

// Get user profile and stats
app.get('/api/user/:id', async (c) => {
  const { env } = c;
  const userId = c.req.param('id');

  try {
    const user = await env.DB.prepare(`
      SELECT u.*, 
             COUNT(DISTINCT ua.achievement_id) as achievements_count,
             (SELECT COUNT(*) FROM achievements) as total_achievements,
             lm.reward_title, lm.reward_description, lm.video_background_url
      FROM users u
      LEFT JOIN user_achievements ua ON u.id = ua.user_id
      LEFT JOIN level_milestones lm ON u.current_level = lm.level
      WHERE u.id = ?
      GROUP BY u.id
    `).bind(userId).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get dashboard data
app.get('/api/dashboard/:userId', async (c) => {
  const { env } = c;
  const userId = c.req.param('userId');

  try {
    // Get monthly summary
    const monthlyStats = await env.DB.prepare(`
      SELECT 
        type,
        SUM(amount) as total
      FROM budget_entries 
      WHERE user_id = ? 
        AND strftime('%Y-%m', entry_date) = strftime('%Y-%m', 'now')
      GROUP BY type
    `).bind(userId).all();

    // Get recent transactions
    const recentTransactions = await env.DB.prepare(`
      SELECT be.*, c.name as category_name, c.icon, c.color
      FROM budget_entries be
      JOIN categories c ON be.category_id = c.id
      WHERE be.user_id = ?
      ORDER BY be.entry_date DESC
      LIMIT 10
    `).bind(userId).all();

    // Get active debts
    const debts = await env.DB.prepare(`
      SELECT * FROM debts 
      WHERE user_id = ? AND status = 'active'
      ORDER BY current_amount DESC
    `).bind(userId).all();

    // Get savings goals
    const savingsGoals = await env.DB.prepare(`
      SELECT * FROM savings_goals 
      WHERE user_id = ? AND status = 'active'
      ORDER BY target_date ASC
    `).bind(userId).all();

    return c.json({
      monthlyStats: monthlyStats.results,
      recentTransactions: recentTransactions.results,
      debts: debts.results,
      savingsGoals: savingsGoals.results
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Add new budget entry
app.post('/api/budget-entry', async (c) => {
  const { env } = c;
  const { user_id, category_id, amount, description, entry_date, type } = await c.req.json();

  try {
    const result = await env.DB.prepare(`
      INSERT INTO budget_entries (user_id, category_id, amount, description, entry_date, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(user_id, category_id, amount, description, entry_date, type).run();

    // Check for level up
    const user = await env.DB.prepare(`
      SELECT experience_points, current_level 
      FROM users WHERE id = ?
    `).bind(user_id).first();

    const nextLevel = await env.DB.prepare(`
      SELECT level, experience_required 
      FROM level_milestones 
      WHERE level > ? AND experience_required <= ?
      ORDER BY level ASC
      LIMIT 1
    `).bind(user.current_level, user.experience_points).first();

    if (nextLevel) {
      await env.DB.prepare(`
        UPDATE users SET current_level = ?, avatar_video_level = ?
        WHERE id = ?
      `).bind(nextLevel.level, nextLevel.level, user_id).run();
    }

    return c.json({ 
      id: result.meta.last_row_id, 
      levelUp: !!nextLevel,
      newLevel: nextLevel?.level || user.current_level
    });
  } catch (error) {
    console.error('Error adding budget entry:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get categories
app.get('/api/categories', async (c) => {
  const { env } = c;
  
  try {
    const categories = await env.DB.prepare(`
      SELECT * FROM categories ORDER BY type, name
    `).all();

    return c.json(categories.results);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get achievements
app.get('/api/achievements/:userId', async (c) => {
  const { env } = c;
  const userId = c.req.param('userId');

  try {
    const achievements = await env.DB.prepare(`
      SELECT a.*, 
             CASE WHEN ua.user_id IS NOT NULL THEN 1 ELSE 0 END as earned
      FROM achievements a
      LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
      ORDER BY a.level_requirement, a.id
    `).bind(userId).all();

    return c.json(achievements.results);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get character rewards for user
app.get('/api/character-rewards/:userId', async (c) => {
  const { env } = c;
  const userId = c.req.param('userId');

  try {
    const rewards = await env.DB.prepare(`
      SELECT cr.*, 
             CASE WHEN ur.user_id IS NOT NULL THEN 1 ELSE 0 END as unlocked,
             CASE WHEN ur.is_equipped = 1 THEN 1 ELSE 0 END as equipped
      FROM character_rewards cr
      LEFT JOIN user_rewards ur ON cr.id = ur.reward_id AND ur.user_id = ?
      ORDER BY cr.type, cr.unlock_level, cr.id
    `).bind(userId).all();

    return c.json(rewards.results);
  } catch (error) {
    console.error('Error fetching character rewards:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Equip character reward
app.post('/api/equip-reward', async (c) => {
  const { env } = c;
  const { user_id, reward_id } = await c.req.json();

  try {
    // Get the reward details
    const reward = await env.DB.prepare(`
      SELECT * FROM character_rewards WHERE id = ?
    `).bind(reward_id).first();

    if (!reward) {
      return c.json({ error: 'Reward not found' }, 404);
    }

    // Check if user has unlocked this reward
    const userReward = await env.DB.prepare(`
      SELECT * FROM user_rewards WHERE user_id = ? AND reward_id = ?
    `).bind(user_id, reward_id).first();

    if (!userReward) {
      return c.json({ error: 'Reward not unlocked' }, 403);
    }

    // Unequip any currently equipped item of the same type
    await env.DB.prepare(`
      UPDATE user_rewards 
      SET is_equipped = 0 
      WHERE user_id = ? AND reward_id IN (
        SELECT id FROM character_rewards WHERE type = ?
      )
    `).bind(user_id, reward.type).run();

    // Equip the new item
    await env.DB.prepare(`
      UPDATE user_rewards 
      SET is_equipped = 1 
      WHERE user_id = ? AND reward_id = ?
    `).bind(user_id, reward_id).run();

    // Update user's equipped items
    const updateField = `equipped_${reward.type}`;
    await env.DB.prepare(`
      UPDATE users 
      SET ${updateField} = ?
      WHERE id = ?
    `).bind(reward.name, user_id).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error equipping reward:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Check and unlock new rewards
app.post('/api/check-rewards', async (c) => {
  const { env } = c;
  const { user_id } = await c.req.json();

  try {
    // Get user stats
    const user = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(user_id).first();

    // Find rewards user should have unlocked
    const availableRewards = await env.DB.prepare(`
      SELECT cr.* FROM character_rewards cr
      LEFT JOIN user_rewards ur ON cr.id = ur.reward_id AND ur.user_id = ?
      WHERE ur.user_id IS NULL
        AND cr.unlock_level <= ?
        AND cr.unlock_savings_requirement <= ?
        AND cr.unlock_debt_payment_requirement <= ?
    `).bind(user_id, user.current_level, user.total_saved, user.total_debt_paid).all();

    const newRewards = [];
    for (const reward of availableRewards.results) {
      // Unlock the reward
      await env.DB.prepare(`
        INSERT OR IGNORE INTO user_rewards (user_id, reward_id, unlocked_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).bind(user_id, reward.id).run();
      
      newRewards.push(reward);
    }

    return c.json({ newRewards });
  } catch (error) {
    console.error('Error checking rewards:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Pay debt
app.post('/api/pay-debt', async (c) => {
  const { env } = c;
  const { user_id, debt_id, amount } = await c.req.json();

  try {
    // Update debt
    const debt = await env.DB.prepare(`
      SELECT * FROM debts WHERE id = ? AND user_id = ?
    `).bind(debt_id, user_id).first();

    if (!debt) {
      return c.json({ error: 'Debt not found' }, 404);
    }

    const newAmount = Math.max(0, debt.current_amount - amount);
    const status = newAmount === 0 ? 'paid_off' : 'active';

    await env.DB.prepare(`
      UPDATE debts 
      SET current_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(newAmount, status, debt_id).run();

    // Add budget entry for debt payment
    await env.DB.prepare(`
      INSERT INTO budget_entries (user_id, category_id, amount, description, entry_date, type)
      VALUES (?, (SELECT id FROM categories WHERE type = 'debt' LIMIT 1), ?, ?, date('now'), 'debt_payment')
    `).bind(user_id, amount, `Payment for ${debt.name}`).run();

    return c.json({ 
      success: true, 
      newAmount: newAmount,
      paidOff: status === 'paid_off'
    });
  } catch (error) {
    console.error('Error paying debt:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ===============================
// MAIN APP ROUTE
// ===============================
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Coin Quest RPG - Medieval Budget Adventure</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          /* Medieval fantasy theme */
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=MedievalSharp&display=swap');
          
          body {
            font-family: 'Cinzel', serif;
          }
          
          .medieval-title {
            font-family: 'MedievalSharp', cursive;
          }
          
          /* Video background styles */
          .video-background {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            object-fit: cover;
            opacity: 0.4;
          }
          
          .medieval-background {
            background: linear-gradient(45deg, 
              rgba(139, 69, 19, 0.8) 0%,
              rgba(101, 67, 33, 0.8) 25%,
              rgba(160, 82, 45, 0.8) 50%,
              rgba(139, 69, 19, 0.8) 75%,
              rgba(101, 67, 33, 0.8) 100%);
            background-size: 400% 400%;
            animation: medievalGlow 20s ease infinite;
          }
          
          @keyframes medievalGlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          
          /* Medieval glass effect */
          .glass {
            background: rgba(139, 69, 19, 0.15);
            backdrop-filter: blur(12px);
            border: 2px solid rgba(218, 165, 32, 0.3);
            box-shadow: 
              inset 0 1px 0 rgba(218, 165, 32, 0.2),
              0 8px 32px rgba(0, 0, 0, 0.4);
          }
          
          .glass-dark {
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(15px);
            border: 2px solid rgba(218, 165, 32, 0.4);
            box-shadow: 
              inset 0 1px 0 rgba(218, 165, 32, 0.3),
              0 12px 40px rgba(0, 0, 0, 0.6);
          }

          /* Medieval animations */
          @keyframes levelUp {
            0% { transform: scale(1) rotate(0deg); }
            25% { transform: scale(1.1) rotate(2deg); }
            75% { transform: scale(1.1) rotate(-2deg); }
            100% { transform: scale(1) rotate(0deg); }
          }
          
          @keyframes goldGlimmer {
            0%, 100% { text-shadow: 0 0 5px #DAA520; }
            50% { text-shadow: 0 0 20px #DAA520, 0 0 30px #FFD700; }
          }
          
          .level-up-animation {
            animation: levelUp 0.8s ease-in-out;
          }
          
          .gold-text {
            color: #DAA520;
            animation: goldGlimmer 3s infinite;
          }

          /* Medieval progress bar */
          .progress-bar {
            background: linear-gradient(90deg, #DAA520 0%, #FFD700 50%, #DAA520 100%);
            transition: width 0.8s ease;
            box-shadow: 0 2px 10px rgba(218, 165, 32, 0.5);
          }
          
          /* Character avatar styles */
          .character-avatar {
            position: relative;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            border: 3px solid #DAA520;
            background: radial-gradient(circle, rgba(139, 69, 19, 0.8), rgba(101, 67, 33, 0.9));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 4rem;
            box-shadow: 0 0 20px rgba(218, 165, 32, 0.4);
          }
          
          .equipment-slot {
            position: absolute;
            width: 30px;
            height: 30px;
            border: 2px solid #8B4513;
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          
          .equipment-slot:hover {
            border-color: #DAA520;
            box-shadow: 0 0 10px rgba(218, 165, 32, 0.6);
          }
          
          /* Position equipment slots around avatar */
          .helmet-slot { top: -15px; left: 50%; transform: translateX(-50%); }
          .weapon-slot { top: 20%; left: -15px; }
          .shield-slot { top: 20%; right: -15px; }
          .armor-slot { bottom: 20%; left: 50%; transform: translateX(-50%); }
          .accessory-slot { bottom: -15px; left: 50%; transform: translateX(-50%); }

          /* Medieval button styles */
          .medieval-btn {
            background: linear-gradient(145deg, #8B4513, #654321);
            border: 2px solid #DAA520;
            color: #FFD700;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
            box-shadow: 
              inset 0 1px 0 rgba(218, 165, 32, 0.2),
              0 4px 15px rgba(0, 0, 0, 0.4);
            transition: all 0.3s ease;
          }
          
          .medieval-btn:hover {
            background: linear-gradient(145deg, #A0522D, #8B4513);
            box-shadow: 
              inset 0 1px 0 rgba(218, 165, 32, 0.3),
              0 6px 20px rgba(0, 0, 0, 0.6),
              0 0 15px rgba(218, 165, 32, 0.3);
            transform: translateY(-2px);
          }

          /* Mobile optimizations */
          @media (max-width: 640px) {
            .mobile-padding {
              padding: 1rem;
            }
            .character-avatar {
              width: 80px;
              height: 80px;
              font-size: 2.5rem;
            }
            .equipment-slot {
              width: 20px;
              height: 20px;
              font-size: 0.8rem;
            }
          }
          
          /* Rarity colors */
          .rarity-common { border-color: #9CA3AF; }
          .rarity-rare { border-color: #3B82F6; }
          .rarity-epic { border-color: #8B5CF6; }
          .rarity-legendary { border-color: #F59E0B; }
          .rarity-mythic { border-color: #EF4444; }
        </style>
    </head>
    <body class="medieval-background min-h-screen text-yellow-100 overflow-x-hidden">
        <!-- Video Background -->
        <video id="videoBackground" class="video-background" autoplay muted loop>
          <source src="/static/videos/medieval_village.mp4" type="video/mp4">
          <!-- Fallback medieval background -->
        </video>

        <!-- Loading Screen -->
        <div id="loadingScreen" class="fixed inset-0 z-50 flex items-center justify-center medieval-background">
          <div class="text-center glass rounded-lg p-8">
            <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-yellow-500 mx-auto mb-4"></div>
            <h2 class="medieval-title text-3xl font-bold gold-text mb-2">⚔️ Coin Quest RPG ⚔️</h2>
            <p class="text-yellow-200">Loading your medieval financial adventure...</p>
          </div>
        </div>

        <!-- Main App Container -->
        <div id="app" class="relative min-h-screen mobile-padding" style="display: none;">
          
          <!-- Header with Character and Stats -->
          <header class="glass rounded-lg p-6 mb-6 sticky top-4 z-10">
            <div class="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <!-- Character Avatar Section -->
              <div class="flex items-center space-x-6">
                <div class="character-avatar" id="characterAvatar">
                  <span id="characterIcon">🏰</span>
                  <!-- Equipment Slots -->
                  <div class="helmet-slot equipment-slot" data-slot="helmet">
                    <span id="helmetIcon">⛑️</span>
                  </div>
                  <div class="weapon-slot equipment-slot" data-slot="weapon">
                    <span id="weaponIcon">🗡️</span>
                  </div>
                  <div class="shield-slot equipment-slot" data-slot="shield">
                    <span id="shieldIcon">🛡️</span>
                  </div>
                  <div class="armor-slot equipment-slot" data-slot="armor">
                    <span id="armorIcon">👕</span>
                  </div>
                  <div class="accessory-slot equipment-slot" data-slot="accessory">
                    <span id="accessoryIcon">💍</span>
                  </div>
                </div>
                
                <div>
                  <h1 class="medieval-title text-3xl font-bold gold-text">
                    ⚔️ Coin Quest RPG
                  </h1>
                  <p class="text-yellow-300" id="userGreeting">Welcome back, brave adventurer!</p>
                  <p class="text-sm text-yellow-400" id="characterTitle">Peasant Coin-Counter</p>
                </div>
              </div>
              
              <!-- Stats Section -->
              <div class="text-center md:text-right">
                <div class="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
                  <div class="text-center">
                    <div class="text-2xl font-bold gold-text" id="userLevel">Level 1</div>
                    <div class="text-xs text-yellow-400" id="characterClass">Peasant</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xl font-bold text-yellow-400" id="userXP">0 XP</div>
                    <div class="text-xs text-yellow-400">Experience</div>
                  </div>
                  <div class="text-center">
                    <div class="text-lg font-bold text-green-400" id="goldCount">0 🪙</div>
                    <div class="text-xs text-yellow-400">Gold Saved</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- XP Progress Bar -->
            <div class="mt-6">
              <div class="flex justify-between text-sm mb-2">
                <span class="text-yellow-300">Quest Progress</span>
                <span id="xpProgress" class="text-yellow-400">0 / 100 XP to next rank</span>
              </div>
              <div class="w-full bg-amber-900 rounded-full h-3 border border-yellow-600">
                <div class="progress-bar h-3 rounded-full" id="xpBar" style="width: 0%"></div>
              </div>
            </div>
          </header>

          <!-- Navigation Tabs -->
          <nav class="glass rounded-lg p-3 mb-6">
            <div class="flex space-x-2">
              <button class="tab-button active flex-1 py-3 px-4 rounded text-center font-medium transition-all medieval-btn" data-tab="dashboard">
                <i class="fas fa-castle mr-2"></i>Quest Hall
              </button>
              <button class="tab-button flex-1 py-3 px-4 rounded text-center font-medium transition-all medieval-btn" data-tab="budget">
                <i class="fas fa-coins mr-2"></i>Treasury
              </button>
              <button class="tab-button flex-1 py-3 px-4 rounded text-center font-medium transition-all medieval-btn" data-tab="debts">
                <i class="fas fa-dragon mr-2"></i>Dragons
              </button>
              <button class="tab-button flex-1 py-3 px-4 rounded text-center font-medium transition-all medieval-btn" data-tab="achievements">
                <i class="fas fa-trophy mr-2"></i>Honors
              </button>
              <button class="tab-button flex-1 py-3 px-4 rounded text-center font-medium transition-all medieval-btn" data-tab="character">
                <i class="fas fa-user-knight mr-2"></i>Character
              </button>
            </div>
          </nav>

          <!-- Tab Content -->
          <div id="tabContent" class="space-y-6">
            <!-- Quest Hall Tab -->
            <div id="dashboard" class="tab-content">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Monthly Treasury Report -->
                <div class="glass rounded-lg p-6">
                  <h3 class="medieval-title text-xl font-bold mb-4 gold-text">
                    <i class="fas fa-scroll mr-2"></i>
                    Monthly Treasury Report
                  </h3>
                  <div class="space-y-3" id="monthlyStats">
                    <div class="flex justify-between items-center p-3 bg-green-600/30 rounded border border-green-400/50">
                      <span class="flex items-center"><i class="fas fa-coins mr-2 text-green-400"></i>Gold Earned</span>
                      <span class="font-bold text-green-400" id="monthlyIncome">0 🪙</span>
                    </div>
                    <div class="flex justify-between items-center p-3 bg-red-600/30 rounded border border-red-400/50">
                      <span class="flex items-center"><i class="fas fa-shopping-cart mr-2 text-red-400"></i>Gold Spent</span>
                      <span class="font-bold text-red-400" id="monthlyExpenses">0 🪙</span>
                    </div>
                    <div class="flex justify-between items-center p-3 bg-blue-600/30 rounded border border-blue-400/50">
                      <span class="flex items-center"><i class="fas fa-treasure-chest mr-2 text-blue-400"></i>Treasure Saved</span>
                      <span class="font-bold text-blue-400" id="monthlySavings">0 🪙</span>
                    </div>
                  </div>
                </div>

                <!-- Quest Actions -->
                <div class="glass rounded-lg p-6">
                  <h3 class="medieval-title text-xl font-bold mb-4 gold-text">
                    <i class="fas fa-sword mr-2"></i>
                    Available Quests
                  </h3>
                  <div class="grid grid-cols-2 gap-3">
                    <button class="medieval-btn p-4 rounded-lg transition-all transform hover:scale-105" onclick="showAddEntryModal('income')">
                      <i class="fas fa-coins text-2xl mb-2 text-green-400"></i>
                      <div class="text-sm font-medium">Earn Gold</div>
                    </button>
                    <button class="medieval-btn p-4 rounded-lg transition-all transform hover:scale-105" onclick="showAddEntryModal('expense')">
                      <i class="fas fa-shopping-bag text-2xl mb-2 text-red-400"></i>
                      <div class="text-sm font-medium">Spend Gold</div>
                    </button>
                    <button class="medieval-btn p-4 rounded-lg transition-all transform hover:scale-105" onclick="showAddEntryModal('savings')">
                      <i class="fas fa-gem text-2xl mb-2 text-blue-400"></i>
                      <div class="text-sm font-medium">Store Treasure</div>
                    </button>
                    <button class="medieval-btn p-4 rounded-lg transition-all transform hover:scale-105" onclick="showPayDebtModal()">
                      <i class="fas fa-dragon text-2xl mb-2 text-purple-400"></i>
                      <div class="text-sm font-medium">Slay Dragons</div>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Recent Quest Activity -->
              <div class="glass rounded-lg p-6">
                <h3 class="medieval-title text-xl font-bold mb-4 gold-text">
                  <i class="fas fa-book mr-2"></i>
                  Recent Quest Activity
                </h3>
                <div class="space-y-3" id="recentTransactions">
                  <!-- Transactions will be loaded here -->
                </div>
              </div>
            </div>

            <!-- Treasury Tab -->
            <div id="budget" class="tab-content hidden">
              <div class="glass rounded-lg p-6">
                <h3 class="medieval-title text-xl font-bold mb-4 gold-text">
                  <i class="fas fa-balance-scale mr-2"></i>
                  Treasury Overview
                </h3>
                <p class="text-yellow-300">Advanced treasury management will be implemented here...</p>
                <p class="text-yellow-400 text-sm mt-2">Track your gold flows, set spending limits, and plan for future quests!</p>
              </div>
            </div>

            <!-- Debt Dragons Tab -->
            <div id="debts" class="tab-content hidden">
              <h2 class="medieval-title text-2xl font-bold mb-6 gold-text text-center">
                <i class="fas fa-dragon mr-2"></i>
                Debt Dragons to Slay
              </h2>
              <div class="space-y-4" id="debtsList">
                <!-- Debts will be loaded here -->
              </div>
            </div>

            <!-- Honors & Achievements Tab -->
            <div id="achievements" class="tab-content hidden">
              <h2 class="medieval-title text-2xl font-bold mb-6 gold-text text-center">
                <i class="fas fa-medal mr-2"></i>
                Honors & Achievements
              </h2>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="achievementsList">
                <!-- Achievements will be loaded here -->
              </div>
            </div>

            <!-- Character Customization Tab -->
            <div id="character" class="tab-content hidden">
              <h2 class="medieval-title text-2xl font-bold mb-6 gold-text text-center">
                <i class="fas fa-user-crown mr-2"></i>
                Character Customization
              </h2>
              
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Character Display -->
                <div class="glass rounded-lg p-6">
                  <h3 class="medieval-title text-xl font-bold mb-4 gold-text">Your Character</h3>
                  <div class="text-center">
                    <div class="character-avatar mx-auto mb-4" style="width: 150px; height: 150px; font-size: 5rem;">
                      <span id="bigCharacterIcon">🏰</span>
                      <!-- Equipment preview slots -->
                      <div class="helmet-slot equipment-slot" style="width: 40px; height: 40px; font-size: 1.2rem;">
                        <span id="previewHelmet">⛑️</span>
                      </div>
                      <div class="weapon-slot equipment-slot" style="width: 40px; height: 40px; font-size: 1.2rem;">
                        <span id="previewWeapon">🗡️</span>
                      </div>
                      <div class="shield-slot equipment-slot" style="width: 40px; height: 40px; font-size: 1.2rem;">
                        <span id="previewShield">🛡️</span>
                      </div>
                      <div class="armor-slot equipment-slot" style="width: 40px; height: 40px; font-size: 1.2rem;">
                        <span id="previewArmor">👕</span>
                      </div>
                      <div class="accessory-slot equipment-slot" style="width: 40px; height: 40px; font-size: 1.2rem;">
                        <span id="previewAccessory">💍</span>
                      </div>
                    </div>
                    <div class="space-y-2">
                      <h4 class="medieval-title text-lg gold-text" id="displayCharacterTitle">Peasant Coin-Counter</h4>
                      <p class="text-yellow-400" id="displayCharacterClass">Peasant</p>
                      <p class="text-yellow-300 text-sm" id="characterStats">Stats will be displayed here</p>
                    </div>
                  </div>
                </div>

                <!-- Equipment Categories -->
                <div class="space-y-4">
                  <div class="glass rounded-lg p-4">
                    <h4 class="medieval-title text-lg font-bold mb-3 gold-text">
                      <i class="fas fa-crown mr-2"></i>Helmets
                    </h4>
                    <div class="grid grid-cols-3 gap-2" id="helmetRewards">
                      <!-- Helmet rewards will be loaded here -->
                    </div>
                  </div>

                  <div class="glass rounded-lg p-4">
                    <h4 class="medieval-title text-lg font-bold mb-3 gold-text">
                      <i class="fas fa-shield-alt mr-2"></i>Armor
                    </h4>
                    <div class="grid grid-cols-3 gap-2" id="armorRewards">
                      <!-- Armor rewards will be loaded here -->
                    </div>
                  </div>

                  <div class="glass rounded-lg p-4">
                    <h4 class="medieval-title text-lg font-bold mb-3 gold-text">
                      <i class="fas fa-sword mr-2"></i>Weapons
                    </h4>
                    <div class="grid grid-cols-3 gap-2" id="weaponRewards">
                      <!-- Weapon rewards will be loaded here -->
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Add Entry Modal -->
        <div id="addEntryModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50">
          <div class="glass-dark rounded-lg p-6 w-full max-w-md mx-4">
            <h3 class="text-xl font-bold mb-4" id="modalTitle">Add Entry</h3>
            <form id="addEntryForm" class="space-y-4">
              <input type="hidden" id="entryType" name="type">
              <div>
                <label class="block text-sm font-medium mb-2">Category</label>
                <select id="entryCategory" name="category_id" class="w-full p-3 bg-gray-800 rounded border border-gray-600 text-white" required>
                  <option value="">Select category...</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Amount ($)</label>
                <input type="number" id="entryAmount" name="amount" step="0.01" class="w-full p-3 bg-gray-800 rounded border border-gray-600 text-white" required>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Description</label>
                <input type="text" id="entryDescription" name="description" class="w-full p-3 bg-gray-800 rounded border border-gray-600 text-white">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Date</label>
                <input type="date" id="entryDate" name="entry_date" class="w-full p-3 bg-gray-800 rounded border border-gray-600 text-white" required>
              </div>
              <div class="flex space-x-3">
                <button type="submit" class="flex-1 bg-green-600 hover:bg-green-700 py-3 rounded font-medium transition-all">
                  Add Entry
                </button>
                <button type="button" onclick="closeModal('addEntryModal')" class="flex-1 bg-gray-600 hover:bg-gray-700 py-3 rounded font-medium transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Pay Debt Modal -->
        <div id="payDebtModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50">
          <div class="glass-dark rounded-lg p-6 w-full max-w-md mx-4">
            <h3 class="text-xl font-bold mb-4">Pay Debt</h3>
            <form id="payDebtForm" class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-2">Select Debt</label>
                <select id="debtSelect" name="debt_id" class="w-full p-3 bg-gray-800 rounded border border-gray-600 text-white" required>
                  <option value="">Select debt to pay...</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Payment Amount ($)</label>
                <input type="number" id="paymentAmount" name="amount" step="0.01" class="w-full p-3 bg-gray-800 rounded border border-gray-600 text-white" required>
              </div>
              <div class="flex space-x-3">
                <button type="submit" class="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded font-medium transition-all">
                  Make Payment
                </button>
                <button type="button" onclick="closeModal('payDebtModal')" class="flex-1 bg-gray-600 hover:bg-gray-700 py-3 rounded font-medium transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Level Up Modal -->
        <div id="levelUpModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/50">
          <div class="glass-dark rounded-lg p-8 w-full max-w-md mx-4 text-center">
            <div class="level-up-animation">
              <i class="fas fa-trophy text-6xl text-yellow-400 mb-4"></i>
              <h2 class="text-3xl font-bold mb-2">LEVEL UP!</h2>
              <p class="text-xl mb-4" id="levelUpText">You reached Level 2!</p>
              <p class="text-gray-300 mb-6" id="levelUpReward">Keep up the great work!</p>
              <button onclick="closeModal('levelUpModal')" class="bg-yellow-600 hover:bg-yellow-700 px-8 py-3 rounded-lg font-bold transition-all">
                Awesome!
              </button>
            </div>
          </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app