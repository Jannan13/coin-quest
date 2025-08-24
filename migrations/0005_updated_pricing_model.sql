-- Update subscription plans to single $4.99/month pricing model
-- Remove multiple tiers and simplify to one comprehensive plan

-- Clear existing subscription plans
DELETE FROM subscription_plans;

-- Insert the new single subscription plan
INSERT INTO subscription_plans (
  name, display_name, description, price_monthly, price_yearly, features, 
  max_debts, max_categories, max_goals, character_customization, advanced_analytics, priority_support,
  is_active
) VALUES 
-- Free Trial (7 days) - Keep this for onboarding
('trial', '🆓 Free Trial', 'Try Coin Quest RPG for 7 days with full access', 0.00, 0.00, 
 '[
   "Complete budget tracking system", 
   "180+ character rewards & equipment", 
   "Unlimited debt dragon battles", 
   "All achievement & collection systems", 
   "Progress analytics & insights", 
   "Goal tracking & milestones"
 ]',
 -1, -1, -1, 1, 1, 0, 1),

-- Single Premium Plan - Everything included at affordable price
('premium', '⚔️ Coin Quest RPG Premium', 'Complete financial adventure with all features unlocked', 4.99, 49.99,
 '[
   "Complete budget tracking system", 
   "180+ character rewards & equipment", 
   "Unlimited debt dragon battles", 
   "All achievement & collection systems", 
   "Progress analytics & insights", 
   "Monthly financial reports", 
   "Goal tracking & milestones", 
   "Premium customer support",
   "All future updates included"
 ]',
 -1, -1, -1, 1, 1, 1, 1);

-- Update any existing users to the new premium plan if they had paid plans
-- This ensures no service disruption for existing customers
UPDATE users 
SET subscription_status = 'premium'
WHERE subscription_status IN ('basic', 'adventurer', 'noble');

-- Note: subscription_history uses plan_id (foreign key), not plan_name
-- Existing history records will maintain their plan_id references

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_price ON subscription_plans(price_monthly);