-- Users table with gamification
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  current_level INTEGER DEFAULT 1,
  experience_points INTEGER DEFAULT 0,
  total_saved REAL DEFAULT 0,
  total_debt_paid REAL DEFAULT 0,
  avatar_video_level INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Budget categories
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('income', 'expense', 'savings', 'debt')) NOT NULL,
  icon TEXT,
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Budget entries (income, expenses, savings)
CREATE TABLE IF NOT EXISTS budget_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  entry_date DATE NOT NULL,
  type TEXT CHECK(type IN ('income', 'expense', 'savings', 'debt_payment')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Debt tracking
CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  original_amount REAL NOT NULL,
  current_amount REAL NOT NULL,
  minimum_payment REAL NOT NULL,
  interest_rate REAL DEFAULT 0,
  due_date DATE,
  status TEXT CHECK(status IN ('active', 'paid_off')) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Savings goals
CREATE TABLE IF NOT EXISTS savings_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL DEFAULT 0,
  target_date DATE,
  status TEXT CHECK(status IN ('active', 'completed', 'paused')) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Achievements and levels
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  level_requirement INTEGER DEFAULT 1,
  savings_requirement REAL DEFAULT 0,
  debt_payment_requirement REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  achievement_id INTEGER NOT NULL,
  earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id),
  UNIQUE(user_id, achievement_id)
);

-- Level milestones and rewards
CREATE TABLE IF NOT EXISTS level_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level INTEGER NOT NULL UNIQUE,
  experience_required INTEGER NOT NULL,
  reward_title TEXT,
  reward_description TEXT,
  video_background_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_budget_entries_user_id ON budget_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_entries_date ON budget_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Triggers to update user stats and experience
CREATE TRIGGER IF NOT EXISTS update_user_savings_trigger
AFTER INSERT ON budget_entries
WHEN NEW.type = 'savings'
BEGIN
  UPDATE users 
  SET total_saved = total_saved + NEW.amount,
      experience_points = experience_points + CAST(NEW.amount / 10 AS INTEGER),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.user_id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_debt_payment_trigger
AFTER INSERT ON budget_entries
WHEN NEW.type = 'debt_payment'
BEGIN
  UPDATE users 
  SET total_debt_paid = total_debt_paid + NEW.amount,
      experience_points = experience_points + CAST(NEW.amount / 5 AS INTEGER),
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.user_id;
END;