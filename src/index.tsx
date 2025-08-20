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
        <title>Budget Level Up - Gamified Finance</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          /* Video background styles */
          .video-background {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            object-fit: cover;
            opacity: 0.3;
          }
          
          /* Glass morphism effect */
          .glass {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
          
          .glass-dark {
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }

          /* Custom animations */
          @keyframes levelUp {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
          
          .level-up-animation {
            animation: levelUp 0.6s ease-in-out;
          }

          /* Progress bar styles */
          .progress-bar {
            background: linear-gradient(90deg, #10B981 0%, #059669 100%);
            transition: width 0.5s ease;
          }

          /* Mobile optimizations */
          @media (max-width: 640px) {
            .mobile-padding {
              padding: 1rem;
            }
          }
        </style>
    </head>
    <body class="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 min-h-screen text-white overflow-x-hidden">
        <!-- Video Background -->
        <video id="videoBackground" class="video-background" autoplay muted loop>
          <source src="/static/videos/level1.mp4" type="video/mp4">
          <!-- Fallback gradient background -->
        </video>

        <!-- Loading Screen -->
        <div id="loadingScreen" class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-900 to-indigo-900">
          <div class="text-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            <h2 class="text-2xl font-bold">Loading your financial journey...</h2>
          </div>
        </div>

        <!-- Main App Container -->
        <div id="app" class="relative min-h-screen mobile-padding" style="display: none;">
          
          <!-- Header with User Stats -->
          <header class="glass rounded-lg p-4 mb-6 sticky top-4 z-10">
            <div class="flex justify-between items-center">
              <div>
                <h1 class="text-2xl font-bold">
                  <i class="fas fa-chart-line mr-2 text-green-400"></i>
                  Budget Level Up
                </h1>
                <p class="text-sm opacity-80" id="userGreeting">Welcome back!</p>
              </div>
              <div class="text-right">
                <div class="flex items-center space-x-4">
                  <div class="text-center">
                    <div class="text-xl font-bold" id="userLevel">Level 1</div>
                    <div class="text-xs opacity-80">Current Level</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xl font-bold text-yellow-400" id="userXP">0 XP</div>
                    <div class="text-xs opacity-80">Experience</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- XP Progress Bar -->
            <div class="mt-4">
              <div class="flex justify-between text-xs mb-1">
                <span>Level Progress</span>
                <span id="xpProgress">0 / 100 XP</span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-2">
                <div class="progress-bar h-2 rounded-full" id="xpBar" style="width: 0%"></div>
              </div>
            </div>
          </header>

          <!-- Navigation Tabs -->
          <nav class="glass rounded-lg p-2 mb-6">
            <div class="flex space-x-1">
              <button class="tab-button active flex-1 py-2 px-4 rounded text-center font-medium transition-all" data-tab="dashboard">
                <i class="fas fa-home mr-2"></i>Dashboard
              </button>
              <button class="tab-button flex-1 py-2 px-4 rounded text-center font-medium transition-all" data-tab="budget">
                <i class="fas fa-wallet mr-2"></i>Budget
              </button>
              <button class="tab-button flex-1 py-2 px-4 rounded text-center font-medium transition-all" data-tab="debts">
                <i class="fas fa-credit-card mr-2"></i>Debts
              </button>
              <button class="tab-button flex-1 py-2 px-4 rounded text-center font-medium transition-all" data-tab="achievements">
                <i class="fas fa-trophy mr-2"></i>Rewards
              </button>
            </div>
          </nav>

          <!-- Tab Content -->
          <div id="tabContent" class="space-y-6">
            <!-- Dashboard Tab -->
            <div id="dashboard" class="tab-content">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Monthly Summary -->
                <div class="glass rounded-lg p-6">
                  <h3 class="text-xl font-bold mb-4">
                    <i class="fas fa-calendar-alt mr-2 text-blue-400"></i>
                    This Month
                  </h3>
                  <div class="space-y-3" id="monthlyStats">
                    <div class="flex justify-between items-center p-3 bg-green-500/20 rounded">
                      <span class="flex items-center"><i class="fas fa-arrow-up mr-2 text-green-400"></i>Income</span>
                      <span class="font-bold text-green-400" id="monthlyIncome">$0</span>
                    </div>
                    <div class="flex justify-between items-center p-3 bg-red-500/20 rounded">
                      <span class="flex items-center"><i class="fas fa-arrow-down mr-2 text-red-400"></i>Expenses</span>
                      <span class="font-bold text-red-400" id="monthlyExpenses">$0</span>
                    </div>
                    <div class="flex justify-between items-center p-3 bg-blue-500/20 rounded">
                      <span class="flex items-center"><i class="fas fa-piggy-bank mr-2 text-blue-400"></i>Savings</span>
                      <span class="font-bold text-blue-400" id="monthlySavings">$0</span>
                    </div>
                  </div>
                </div>

                <!-- Quick Actions -->
                <div class="glass rounded-lg p-6">
                  <h3 class="text-xl font-bold mb-4">
                    <i class="fas fa-bolt mr-2 text-yellow-400"></i>
                    Quick Actions
                  </h3>
                  <div class="grid grid-cols-2 gap-3">
                    <button class="bg-green-600 hover:bg-green-700 p-4 rounded-lg transition-all transform hover:scale-105" onclick="showAddEntryModal('income')">
                      <i class="fas fa-plus-circle text-2xl mb-2"></i>
                      <div class="text-sm font-medium">Add Income</div>
                    </button>
                    <button class="bg-red-600 hover:bg-red-700 p-4 rounded-lg transition-all transform hover:scale-105" onclick="showAddEntryModal('expense')">
                      <i class="fas fa-minus-circle text-2xl mb-2"></i>
                      <div class="text-sm font-medium">Add Expense</div>
                    </button>
                    <button class="bg-blue-600 hover:bg-blue-700 p-4 rounded-lg transition-all transform hover:scale-105" onclick="showAddEntryModal('savings')">
                      <i class="fas fa-piggy-bank text-2xl mb-2"></i>
                      <div class="text-sm font-medium">Save Money</div>
                    </button>
                    <button class="bg-purple-600 hover:bg-purple-700 p-4 rounded-lg transition-all transform hover:scale-105" onclick="showPayDebtModal()">
                      <i class="fas fa-credit-card text-2xl mb-2"></i>
                      <div class="text-sm font-medium">Pay Debt</div>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Recent Transactions -->
              <div class="glass rounded-lg p-6">
                <h3 class="text-xl font-bold mb-4">
                  <i class="fas fa-history mr-2 text-gray-400"></i>
                  Recent Activity
                </h3>
                <div class="space-y-3" id="recentTransactions">
                  <!-- Transactions will be loaded here -->
                </div>
              </div>
            </div>

            <!-- Budget Tab -->
            <div id="budget" class="tab-content hidden">
              <div class="glass rounded-lg p-6">
                <h3 class="text-xl font-bold mb-4">Budget Overview</h3>
                <p class="text-gray-300">Budget tracking interface will be implemented here...</p>
              </div>
            </div>

            <!-- Debts Tab -->
            <div id="debts" class="tab-content hidden">
              <div class="space-y-4" id="debtsList">
                <!-- Debts will be loaded here -->
              </div>
            </div>

            <!-- Achievements Tab -->
            <div id="achievements" class="tab-content hidden">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="achievementsList">
                <!-- Achievements will be loaded here -->
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