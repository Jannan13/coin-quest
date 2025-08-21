-- Add authentication and subscription fields to users table (fixed version)
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN verification_token TEXT;
ALTER TABLE users ADD COLUMN reset_token TEXT;
ALTER TABLE users ADD COLUMN reset_token_expires DATETIME;
ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'trial';
ALTER TABLE users ADD COLUMN subscription_plan TEXT DEFAULT 'trial';
ALTER TABLE users ADD COLUMN subscription_id TEXT;
ALTER TABLE users ADD COLUMN subscription_start_date DATETIME;
ALTER TABLE users ADD COLUMN subscription_end_date DATETIME;
ALTER TABLE users ADD COLUMN trial_start_date DATETIME;
ALTER TABLE users ADD COLUMN trial_end_date DATETIME;
ALTER TABLE users ADD COLUMN last_login DATETIME;
ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;

-- Update trial dates for existing users
UPDATE users SET 
  trial_start_date = CURRENT_TIMESTAMP,
  trial_end_date = datetime(CURRENT_TIMESTAMP, '+7 days')
WHERE trial_start_date IS NULL;

-- Create sessions table for user authentication
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly REAL NOT NULL,
  price_yearly REAL,
  features TEXT, -- JSON string of features
  max_debts INTEGER DEFAULT -1, -- -1 for unlimited
  max_categories INTEGER DEFAULT -1,
  max_goals INTEGER DEFAULT -1,
  character_customization INTEGER DEFAULT 1,
  advanced_analytics INTEGER DEFAULT 0,
  priority_support INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create subscription history table
CREATE TABLE IF NOT EXISTS subscription_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('active', 'cancelled', 'expired', 'failed')) NOT NULL,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  billing_cycle TEXT CHECK(billing_cycle IN ('monthly', 'yearly')) DEFAULT 'monthly',
  payment_provider TEXT,
  payment_id TEXT,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

-- Create payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subscription_history_id INTEGER,
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT CHECK(status IN ('pending', 'completed', 'failed', 'refunded')) NOT NULL,
  payment_provider TEXT,
  provider_transaction_id TEXT,
  provider_customer_id TEXT,
  payment_method TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subscription_history_id) REFERENCES subscription_history(id)
);

-- Insert default subscription plans
INSERT OR IGNORE INTO subscription_plans (
  name, display_name, description, price_monthly, price_yearly, features, 
  max_debts, max_categories, max_goals, character_customization, advanced_analytics, priority_support
) VALUES 
-- Free Trial (7 days)
('trial', '🆓 Free Trial', 'Try Coin Quest RPG for 7 days', 0.00, 0.00, 
 '["Basic character customization", "Up to 3 debt dragons", "Basic equipment", "Standard achievements"]',
 3, 10, 3, 1, 0, 0),

-- Basic Plan
('basic', '⚔️ Adventurer Plan', 'Perfect for starting your financial quest', 9.99, 99.99,
 '["Full character customization", "Unlimited debt dragons", "All equipment tiers", "All achievements", "Monthly progress reports"]',
 -1, -1, -1, 1, 1, 0),

-- Premium Plan  
('premium', '👑 Noble Plan', 'Advanced features for financial nobles', 19.99, 199.99,
 '["Everything in Adventurer", "Advanced analytics", "Goal tracking", "Custom categories", "Priority support", "Early access to new features"]',
 -1, -1, -1, 1, 1, 1),

-- Ultimate Plan
('ultimate', '🏰 Elder Master Plan', 'Ultimate financial mastery for true legends', 29.99, 299.99,
 '["Everything in Noble", "Personal financial coaching", "Custom achievement creation", "API access", "White-label options", "1-on-1 support calls"]',
 -1, -1, -1, 1, 1, 1);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_status ON subscription_history(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Update existing demo user with trial subscription
UPDATE users SET 
  subscription_status = 'trial',
  subscription_plan = 'trial',
  trial_start_date = CURRENT_TIMESTAMP,
  trial_end_date = datetime(CURRENT_TIMESTAMP, '+7 days')
WHERE id = 1;

-- Create triggers for subscription management
CREATE TRIGGER IF NOT EXISTS update_user_login_trigger
AFTER INSERT ON user_sessions
BEGIN
  UPDATE users 
  SET last_login = CURRENT_TIMESTAMP,
      login_count = login_count + 1
  WHERE id = NEW.user_id;
END;

-- Clean up expired sessions trigger
CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions_trigger
AFTER INSERT ON user_sessions
BEGIN
  DELETE FROM user_sessions 
  WHERE expires_at < CURRENT_TIMESTAMP;
END;