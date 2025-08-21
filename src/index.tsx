import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { jwt, sign, verify } from 'hono/jwt'

type Bindings = {
  DB: D1Database;
  JWT_SECRET?: string;
}

type Variables = {
  user?: any;
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// JWT secret (in production, use environment variable)
const JWT_SECRET = 'medieval-coin-quest-secret-key-change-in-production'

// Middleware to check authentication for protected routes
const authMiddleware = async (c: any, next: any) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || 
                c.req.cookie('auth_token');

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const payload = await verify(token, JWT_SECRET);
    const { env } = c;
    
    // Get user from database
    const user = await env.DB.prepare(`
      SELECT * FROM users WHERE id = ? AND subscription_status != 'cancelled'
    `).bind(payload.sub).first();

    if (!user) {
      return c.json({ error: 'User not found or subscription inactive' }, 401);
    }

    // Check subscription status
    if (user.subscription_status === 'trial' && new Date() > new Date(user.trial_end_date)) {
      await env.DB.prepare(`
        UPDATE users SET subscription_status = 'expired' WHERE id = ?
      `).bind(user.id).run();
      return c.json({ error: 'Trial expired. Please subscribe to continue.' }, 402);
    }

    c.set('user', user);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
}

// Hash password utility
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Verify password utility
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashedPassword = await hashPassword(password);
  return hashedPassword === hash;
}

// ===============================
// AUTHENTICATION ROUTES
// ===============================

// Register new user
app.post('/api/auth/register', async (c) => {
  const { env } = c;
  const { email, password, name, character_name } = await c.req.json();

  if (!email || !password || !name) {
    return c.json({ error: 'Email, password, and name are required' }, 400);
  }

  try {
    // Check if user already exists
    const existingUser = await env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(email).first();

    if (existingUser) {
      return c.json({ error: 'User already exists with this email' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await env.DB.prepare(`
      INSERT INTO users (
        email, name, password_hash, character_class, character_title,
        subscription_status, subscription_plan, trial_start_date, trial_end_date
      ) VALUES (?, ?, ?, ?, ?, 'trial', 'trial', CURRENT_TIMESTAMP, datetime(CURRENT_TIMESTAMP, '+7 days'))
    `).bind(email, name, passwordHash, 'Peasant', character_name || 'Coin Seeker').run();

    // Create JWT token
    const token = await sign({ sub: result.meta.last_row_id, email }, JWT_SECRET);

    // Set cookie
    c.header('Set-Cookie', `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`);

    return c.json({ 
      success: true, 
      token,
      user: {
        id: result.meta.last_row_id,
        email,
        name,
        subscription_status: 'trial',
        trial_days_left: 7
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// Login user
app.post('/api/auth/login', async (c) => {
  const { env } = c;
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  try {
    // Get user
    const user = await env.DB.prepare(`
      SELECT * FROM users WHERE email = ?
    `).bind(email).first();

    if (!user || !await verifyPassword(password, user.password_hash)) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Check trial/subscription status
    let subscriptionStatus = user.subscription_status;
    let trialDaysLeft = 0;

    if (user.subscription_status === 'trial') {
      const trialEnd = new Date(user.trial_end_date);
      const now = new Date();
      trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      if (trialDaysLeft <= 0) {
        subscriptionStatus = 'expired';
        await env.DB.prepare(`
          UPDATE users SET subscription_status = 'expired' WHERE id = ?
        `).bind(user.id).run();
      }
    }

    // Create JWT token
    const token = await sign({ sub: user.id, email }, JWT_SECRET);

    // Set cookie
    c.header('Set-Cookie', `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`);

    return c.json({ 
      success: true, 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        character_name: user.character_title,
        subscription_status: subscriptionStatus,
        subscription_plan: user.subscription_plan,
        trial_days_left: trialDaysLeft
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

// Logout user
app.post('/api/auth/logout', (c) => {
  c.header('Set-Cookie', `auth_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  return c.json({ success: true });
});

// Get current user
app.get('/api/auth/me', authMiddleware, (c) => {
  const user = c.get('user');
  
  let trialDaysLeft = 0;
  if (user.subscription_status === 'trial') {
    const trialEnd = new Date(user.trial_end_date);
    const now = new Date();
    trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    character_name: user.character_title,
    subscription_status: user.subscription_status,
    subscription_plan: user.subscription_plan,
    trial_days_left: trialDaysLeft
  });
});

// ===============================
// SUBSCRIPTION ROUTES
// ===============================

// Get subscription plans
app.get('/api/subscription/plans', async (c) => {
  const { env } = c;
  
  try {
    const plans = await env.DB.prepare(`
      SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price_monthly ASC
    `).all();

    return c.json(plans.results);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return c.json({ error: 'Failed to fetch plans' }, 500);
  }
});

// Subscribe to plan (mock implementation - integrate with Stripe/PayPal in production)
app.post('/api/subscription/subscribe', authMiddleware, async (c) => {
  const { env } = c;
  const user = c.get('user');
  const { plan_id, billing_cycle = 'monthly' } = await c.req.json();

  try {
    // Get plan details
    const plan = await env.DB.prepare(`
      SELECT * FROM subscription_plans WHERE id = ?
    `).bind(plan_id).first();

    if (!plan) {
      return c.json({ error: 'Plan not found' }, 404);
    }

    const amount = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
    const startDate = new Date();
    const endDate = new Date();
    
    if (billing_cycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // In production, integrate with payment processor here
    // For demo, we'll simulate successful payment

    // Update user subscription
    await env.DB.prepare(`
      UPDATE users SET 
        subscription_status = 'active',
        subscription_plan = ?,
        subscription_start_date = ?,
        subscription_end_date = ?
      WHERE id = ?
    `).bind(plan.name, startDate.toISOString(), endDate.toISOString(), user.id).run();

    // Record subscription history
    const subscriptionResult = await env.DB.prepare(`
      INSERT INTO subscription_history (
        user_id, plan_id, status, amount, billing_cycle, starts_at, ends_at
      ) VALUES (?, ?, 'active', ?, ?, ?, ?)
    `).bind(user.id, plan_id, amount, billing_cycle, startDate.toISOString(), endDate.toISOString()).run();

    // Record payment transaction
    await env.DB.prepare(`
      INSERT INTO payment_transactions (
        user_id, subscription_history_id, amount, status, payment_provider, description
      ) VALUES (?, ?, ?, 'completed', 'demo', ?)
    `).bind(user.id, subscriptionResult.meta.last_row_id, amount, `${plan.display_name} - ${billing_cycle}`).run();

    return c.json({ 
      success: true, 
      message: 'Subscription activated successfully!',
      plan: plan.display_name,
      next_billing_date: endDate.toISOString()
    });
  } catch (error) {
    console.error('Subscription error:', error);
    return c.json({ error: 'Subscription failed' }, 500);
  }
});

// Get user's subscription status
app.get('/api/subscription/status', authMiddleware, async (c) => {
  const { env } = c;
  const user = c.get('user');

  try {
    const subscription = await env.DB.prepare(`
      SELECT sh.*, sp.display_name, sp.features 
      FROM subscription_history sh
      JOIN subscription_plans sp ON sh.plan_id = sp.id
      WHERE sh.user_id = ? AND sh.status = 'active'
      ORDER BY sh.created_at DESC
      LIMIT 1
    `).bind(user.id).first();

    return c.json({
      subscription_status: user.subscription_status,
      subscription_plan: user.subscription_plan,
      trial_end_date: user.trial_end_date,
      subscription_end_date: user.subscription_end_date,
      current_subscription: subscription
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return c.json({ error: 'Failed to fetch subscription status' }, 500);
  }
});

// ===============================
// PROTECTED API ROUTES
// ===============================

// Get user profile and stats
app.get('/api/user/:id', authMiddleware, async (c) => {
  const { env } = c;
  const currentUser = c.get('user');
  const requestedUserId = c.req.param('id');

  // Users can only access their own data
  if (currentUser.id.toString() !== requestedUserId) {
    return c.json({ error: 'Access denied' }, 403);
  }

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
    `).bind(requestedUserId).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Don't return sensitive information
    delete user.password_hash;
    delete user.verification_token;
    delete user.reset_token;

    return c.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get dashboard data
app.get('/api/dashboard/:userId', authMiddleware, async (c) => {
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
app.post('/api/budget-entry', authMiddleware, async (c) => {
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
app.get('/api/achievements/:userId', authMiddleware, async (c) => {
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
app.get('/api/character-rewards/:userId', authMiddleware, async (c) => {
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
app.post('/api/equip-reward', authMiddleware, async (c) => {
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
app.post('/api/check-rewards', authMiddleware, async (c) => {
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
app.post('/api/pay-debt', authMiddleware, async (c) => {
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
// MAIN APP ROUTES
// ===============================

// Public landing page with login/signup
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
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=MedievalSharp&display=swap');
          
          body {
            font-family: 'Cinzel', serif;
          }
          
          .medieval-title {
            font-family: 'MedievalSharp', cursive;
          }
          
          .medieval-background {
            background: linear-gradient(45deg, 
              rgba(139, 69, 19, 0.9) 0%,
              rgba(101, 67, 33, 0.9) 25%,
              rgba(160, 82, 45, 0.9) 50%,
              rgba(139, 69, 19, 0.9) 75%,
              rgba(101, 67, 33, 0.9) 100%);
            background-size: 400% 400%;
            animation: medievalGlow 20s ease infinite;
          }
          
          @keyframes medievalGlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          
          .glass {
            background: rgba(139, 69, 19, 0.15);
            backdrop-filter: blur(12px);
            border: 2px solid rgba(218, 165, 32, 0.3);
            box-shadow: 
              inset 0 1px 0 rgba(218, 165, 32, 0.2),
              0 8px 32px rgba(0, 0, 0, 0.4);
          }
          
          .gold-text {
            color: #DAA520;
            text-shadow: 0 0 10px rgba(218, 165, 32, 0.5);
          }
          
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
            transform: translateY(-2px);
          }
        </style>
    </head>
    <body class="medieval-background min-h-screen text-yellow-100">
        <!-- Landing Page -->
        <div class="min-h-screen flex items-center justify-center p-4">
          <div class="max-w-4xl w-full">
            <!-- Header -->
            <div class="text-center mb-12">
              <h1 class="medieval-title text-6xl md:text-8xl font-bold gold-text mb-4">
                ⚔️ Coin Quest RPG
              </h1>
              <p class="text-2xl md:text-3xl text-yellow-200 mb-6">
                Medieval Budget Adventure
              </p>
              <p class="text-lg text-yellow-300 max-w-2xl mx-auto">
                Transform your financial journey into an epic medieval RPG! Level up by saving gold, 
                slay debt dragons, and customize your character as you master the ancient arts of budgeting.
              </p>
            </div>

            <!-- Features Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div class="glass rounded-lg p-6 text-center">
                <div class="text-4xl mb-4">🏰</div>
                <h3 class="medieval-title text-xl font-bold gold-text mb-2">Epic Character System</h3>
                <p class="text-yellow-300 text-sm">Customize your character with 32+ equipment items from Peasant to Elder Master</p>
              </div>
              
              <div class="glass rounded-lg p-6 text-center">
                <div class="text-4xl mb-4">🐉</div>
                <h3 class="medieval-title text-xl font-bold gold-text mb-2">Debt Dragon Slaying</h3>
                <p class="text-yellow-300 text-sm">Transform debts into fearsome dragons and earn legendary equipment by defeating them</p>
              </div>
              
              <div class="glass rounded-lg p-6 text-center">
                <div class="text-4xl mb-4">👑</div>
                <h3 class="medieval-title text-xl font-bold gold-text mb-2">Level Progression</h3>
                <p class="text-yellow-300 text-sm">Progress from Peasant Coin-Counter to Elder Scrolls Master of Gold</p>
              </div>
            </div>

            <!-- Subscription Plans -->
            <div class="glass rounded-lg p-8 mb-8">
              <h2 class="medieval-title text-3xl font-bold gold-text text-center mb-8">Choose Your Adventure</h2>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Free Trial -->
                <div class="bg-gray-800/50 rounded-lg p-6 border-2 border-gray-600">
                  <div class="text-center">
                    <h3 class="medieval-title text-xl font-bold text-green-400 mb-2">🆓 Free Trial</h3>
                    <div class="text-3xl font-bold text-white mb-2">$0</div>
                    <div class="text-sm text-gray-400 mb-4">7 days free</div>
                    <ul class="text-sm text-gray-300 space-y-2 mb-6">
                      <li>✓ Basic character customization</li>
                      <li>✓ Up to 3 debt dragons</li>
                      <li>✓ Basic equipment tiers</li>
                      <li>✓ Standard achievements</li>
                    </ul>
                  </div>
                </div>

                <!-- Adventurer Plan -->
                <div class="bg-blue-800/50 rounded-lg p-6 border-2 border-blue-400 transform scale-105">
                  <div class="text-center">
                    <div class="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold mb-2">MOST POPULAR</div>
                    <h3 class="medieval-title text-xl font-bold text-blue-400 mb-2">⚔️ Adventurer Plan</h3>
                    <div class="text-3xl font-bold text-white mb-2">$9.99</div>
                    <div class="text-sm text-gray-400 mb-4">per month</div>
                    <ul class="text-sm text-gray-300 space-y-2 mb-6">
                      <li>✓ Full character customization</li>
                      <li>✓ Unlimited debt dragons</li>
                      <li>✓ All equipment tiers</li>
                      <li>✓ All achievements</li>
                      <li>✓ Monthly progress reports</li>
                    </ul>
                  </div>
                </div>

                <!-- Noble Plan -->
                <div class="bg-purple-800/50 rounded-lg p-6 border-2 border-purple-400">
                  <div class="text-center">
                    <h3 class="medieval-title text-xl font-bold text-purple-400 mb-2">👑 Noble Plan</h3>
                    <div class="text-3xl font-bold text-white mb-2">$19.99</div>
                    <div class="text-sm text-gray-400 mb-4">per month</div>
                    <ul class="text-sm text-gray-300 space-y-2 mb-6">
                      <li>✓ Everything in Adventurer</li>
                      <li>✓ Advanced analytics</li>
                      <li>✓ Goal tracking</li>
                      <li>✓ Custom categories</li>
                      <li>✓ Priority support</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <!-- Auth Buttons -->
            <div class="text-center space-y-4">
              <button onclick="showSignupModal()" class="medieval-btn px-8 py-4 rounded-lg text-lg font-bold mr-4">
                🏰 Start Your Quest (Free Trial)
              </button>
              <button onclick="showLoginModal()" class="bg-transparent border-2 border-yellow-600 text-yellow-400 px-8 py-4 rounded-lg text-lg font-bold hover:bg-yellow-600 hover:text-black transition-all">
                ⚔️ Continue Quest (Login)
              </button>
            </div>
          </div>
        </div>

        <!-- Login Modal -->
        <div id="loginModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/80">
          <div class="glass rounded-lg p-8 w-full max-w-md mx-4">
            <h2 class="medieval-title text-2xl font-bold gold-text text-center mb-6">Continue Your Quest</h2>
            <form id="loginForm" class="space-y-4">
              <div>
                <label class="block text-yellow-300 font-medium mb-2">Email</label>
                <input type="email" name="email" required 
                       class="w-full p-3 bg-gray-800 border border-yellow-600 rounded text-white focus:border-yellow-400 focus:outline-none">
              </div>
              <div>
                <label class="block text-yellow-300 font-medium mb-2">Password</label>
                <input type="password" name="password" required 
                       class="w-full p-3 bg-gray-800 border border-yellow-600 rounded text-white focus:border-yellow-400 focus:outline-none">
              </div>
              <button type="submit" class="w-full medieval-btn py-3 rounded font-bold">
                Enter the Realm
              </button>
              <div class="text-center">
                <button type="button" onclick="closeModal('loginModal')" class="text-yellow-400 hover:text-yellow-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Signup Modal -->
        <div id="signupModal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/80">
          <div class="glass rounded-lg p-8 w-full max-w-md mx-4">
            <h2 class="medieval-title text-2xl font-bold gold-text text-center mb-6">Begin Your Quest</h2>
            <form id="signupForm" class="space-y-4">
              <div>
                <label class="block text-yellow-300 font-medium mb-2">Your Name</label>
                <input type="text" name="name" required 
                       class="w-full p-3 bg-gray-800 border border-yellow-600 rounded text-white focus:border-yellow-400 focus:outline-none">
              </div>
              <div>
                <label class="block text-yellow-300 font-medium mb-2">Character Title</label>
                <input type="text" name="character_name" placeholder="e.g., Brave Coin Seeker" 
                       class="w-full p-3 bg-gray-800 border border-yellow-600 rounded text-white focus:border-yellow-400 focus:outline-none">
              </div>
              <div>
                <label class="block text-yellow-300 font-medium mb-2">Email</label>
                <input type="email" name="email" required 
                       class="w-full p-3 bg-gray-800 border border-yellow-600 rounded text-white focus:border-yellow-400 focus:outline-none">
              </div>
              <div>
                <label class="block text-yellow-300 font-medium mb-2">Password</label>
                <input type="password" name="password" required minlength="6"
                       class="w-full p-3 bg-gray-800 border border-yellow-600 rounded text-white focus:border-yellow-400 focus:outline-none">
              </div>
              <button type="submit" class="w-full medieval-btn py-3 rounded font-bold">
                🆓 Start Free Trial (7 Days)
              </button>
              <div class="text-center">
                <button type="button" onclick="closeModal('signupModal')" class="text-yellow-400 hover:text-yellow-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/auth.js"></script>
    </body>
    </html>
  `)
})

// Main app route (protected)
app.get('/app', (c) => {
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
                  <div class="text-center">
                    <button onclick="app.showAccountModal()" class="medieval-btn px-3 py-1 text-sm rounded transition-all hover:scale-105">
                      <i class="fas fa-user mr-1"></i>Account
                    </button>
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