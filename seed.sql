-- Insert default user
INSERT OR IGNORE INTO users (id, email, name, current_level, experience_points) VALUES 
  (1, 'demo@budgetapp.com', 'Demo User', 1, 0);

-- Insert default categories
INSERT OR IGNORE INTO categories (id, name, type, icon, color) VALUES 
  (1, 'Salary', 'income', '💰', '#10B981'),
  (2, 'Freelance', 'income', '💻', '#059669'),
  (3, 'Food', 'expense', '🍔', '#EF4444'),
  (4, 'Transport', 'expense', '🚗', '#F59E0B'),
  (5, 'Housing', 'expense', '🏠', '#8B5CF6'),
  (6, 'Entertainment', 'expense', '🎬', '#EC4899'),
  (7, 'Emergency Fund', 'savings', '🛡️', '#06B6D4'),
  (8, 'Vacation', 'savings', '✈️', '#84CC16'),
  (9, 'Credit Card', 'debt', '💳', '#DC2626'),
  (10, 'Student Loan', 'debt', '🎓', '#7C3AED');

-- Insert achievements
INSERT OR IGNORE INTO achievements (id, name, description, icon, level_requirement, savings_requirement, debt_payment_requirement) VALUES 
  (1, 'First Save', 'Save your first $10', '🎯', 1, 10, 0),
  (2, 'Debt Warrior', 'Pay off $100 in debt', '⚔️', 1, 0, 100),
  (3, 'Savings Streak', 'Save money for 7 consecutive days', '🔥', 2, 50, 0),
  (4, 'Budget Master', 'Reach Level 5', '👑', 5, 0, 0),
  (5, 'Debt Slayer', 'Pay off $1000 in debt', '🗡️', 3, 0, 1000),
  (6, 'Emergency Ready', 'Save $500 for emergency fund', '🛡️', 4, 500, 0),
  (7, 'Financial Freedom', 'Pay off all debts', '🆓', 10, 0, 5000);

-- Insert level milestones
INSERT OR IGNORE INTO level_milestones (level, experience_required, reward_title, reward_description, video_background_url) VALUES 
  (1, 0, 'Budget Beginner', 'Welcome to your financial journey!', '/static/videos/level1.mp4'),
  (2, 100, 'Savings Starter', 'You are building good habits!', '/static/videos/level2.mp4'),
  (3, 300, 'Debt Fighter', 'Taking control of your debt!', '/static/videos/level3.mp4'),
  (4, 600, 'Budget Pro', 'You are mastering your money!', '/static/videos/level4.mp4'),
  (5, 1000, 'Financial Warrior', 'Outstanding financial discipline!', '/static/videos/level5.mp4'),
  (6, 1500, 'Money Manager', 'Your finances are on track!', '/static/videos/level6.mp4'),
  (7, 2100, 'Wealth Builder', 'Building serious wealth!', '/static/videos/level7.mp4'),
  (8, 2800, 'Financial Expert', 'Expert-level money management!', '/static/videos/level8.mp4'),
  (9, 3600, 'Prosperity Master', 'You have achieved financial mastery!', '/static/videos/level9.mp4'),
  (10, 4500, 'Financial Legend', 'Legendary financial achievement!', '/static/videos/level10.mp4');

-- Insert sample budget data for demo
INSERT OR IGNORE INTO budget_entries (user_id, category_id, amount, description, entry_date, type) VALUES 
  (1, 1, 3000, 'Monthly salary', '2024-01-01', 'income'),
  (1, 3, -50, 'Groceries', '2024-01-02', 'expense'),
  (1, 7, 200, 'Emergency fund deposit', '2024-01-03', 'savings'),
  (1, 9, 100, 'Credit card payment', '2024-01-04', 'debt_payment');

-- Insert sample debt
INSERT OR IGNORE INTO debts (user_id, name, original_amount, current_amount, minimum_payment, interest_rate) VALUES 
  (1, 'Credit Card Debt', 2000, 1900, 100, 18.9),
  (1, 'Student Loan', 15000, 12000, 200, 4.5);

-- Insert sample savings goal
INSERT OR IGNORE INTO savings_goals (user_id, name, target_amount, current_amount, target_date) VALUES 
  (1, 'Emergency Fund', 5000, 200, '2024-12-31'),
  (1, 'Vacation Fund', 2000, 0, '2024-08-01');