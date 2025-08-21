-- Add character customization fields to users table
ALTER TABLE users ADD COLUMN character_class TEXT DEFAULT 'Peasant';
ALTER TABLE users ADD COLUMN character_title TEXT DEFAULT 'Coin Seeker';
ALTER TABLE users ADD COLUMN equipped_helmet TEXT DEFAULT 'none';
ALTER TABLE users ADD COLUMN equipped_armor TEXT DEFAULT 'cloth_rags';
ALTER TABLE users ADD COLUMN equipped_weapon TEXT DEFAULT 'wooden_stick';
ALTER TABLE users ADD COLUMN equipped_shield TEXT DEFAULT 'none';
ALTER TABLE users ADD COLUMN equipped_accessory TEXT DEFAULT 'none';
ALTER TABLE users ADD COLUMN character_background TEXT DEFAULT 'tavern';

-- Create character rewards table
CREATE TABLE IF NOT EXISTS character_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('helmet', 'armor', 'weapon', 'shield', 'accessory', 'background', 'title')) NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  rarity TEXT CHECK(rarity IN ('common', 'rare', 'epic', 'legendary', 'mythic')) DEFAULT 'common',
  unlock_level INTEGER DEFAULT 1,
  unlock_savings_requirement REAL DEFAULT 0,
  unlock_debt_payment_requirement REAL DEFAULT 0,
  unlock_achievement_requirement TEXT,
  icon_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create user rewards table (what rewards each user has unlocked)
CREATE TABLE IF NOT EXISTS user_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reward_id INTEGER NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_equipped INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (reward_id) REFERENCES character_rewards(id),
  UNIQUE(user_id, reward_id)
);

-- Update level milestones with medieval titles and descriptions
UPDATE level_milestones SET 
  reward_title = 'Peasant Coin-Counter',
  reward_description = 'You begin your quest for financial freedom in humble cloth rags...',
  video_background_url = '/static/videos/medieval_village.mp4'
WHERE level = 1;

UPDATE level_milestones SET 
  reward_title = 'Apprentice Merchant',
  reward_description = 'Your coin purse grows heavier. The local blacksmith nods in approval.',
  video_background_url = '/static/videos/medieval_market.mp4'
WHERE level = 2;

UPDATE level_milestones SET 
  reward_title = 'Skilled Trader',
  reward_description = 'Word of your financial wisdom spreads through the village taverns.',
  video_background_url = '/static/videos/medieval_tavern.mp4'
WHERE level = 3;

UPDATE level_milestones SET 
  reward_title = 'Guild Treasurer',
  reward_description = 'The merchant guild offers you a position of trust and honor.',
  video_background_url = '/static/videos/medieval_guild.mp4'
WHERE level = 4;

UPDATE level_milestones SET 
  reward_title = 'Noble Financier',
  reward_description = 'Lords seek your counsel on matters of gold and treasure.',
  video_background_url = '/static/videos/medieval_castle.mp4'
WHERE level = 5;

UPDATE level_milestones SET 
  reward_title = 'Royal Advisor',
  reward_description = 'The king himself values your wisdom in matters of the realm treasury.',
  video_background_url = '/static/videos/royal_throne.mp4'
WHERE level = 6;

UPDATE level_milestones SET 
  reward_title = 'Dragon Slayer of Debt',
  reward_description = 'You have conquered the fiercest debt dragons that plagued your coffers.',
  video_background_url = '/static/videos/dragon_lair.mp4'
WHERE level = 7;

UPDATE level_milestones SET 
  reward_title = 'Archmage of Assets',
  reward_description = 'Your mastery over gold rivals the ancient wizards of legend.',
  video_background_url = '/static/videos/wizard_tower.mp4'
WHERE level = 8;

UPDATE level_milestones SET 
  reward_title = 'Legendary Coin Lord',
  reward_description = 'Bards sing songs of your legendary financial conquests across the land.',
  video_background_url = '/static/videos/legendary_vault.mp4'
WHERE level = 9;

UPDATE level_milestones SET 
  reward_title = 'Elder Scrolls Master of Gold',
  reward_description = 'You have achieved financial mastery spoken of only in the Elder Scrolls.',
  video_background_url = '/static/videos/elder_scrolls.mp4'
WHERE level = 10;

-- Insert character rewards
INSERT OR IGNORE INTO character_rewards (type, name, display_name, description, rarity, unlock_level, unlock_savings_requirement, unlock_debt_payment_requirement, icon_path) VALUES 

-- HELMETS
('helmet', 'leather_cap', 'Leather Cap', 'A simple cap worn by village merchants', 'common', 2, 100, 0, '/static/icons/leather_cap.png'),
('helmet', 'iron_helm', 'Iron Helm', 'Sturdy protection for the aspiring trader', 'rare', 4, 500, 0, '/static/icons/iron_helm.png'),
('helmet', 'steel_crown', 'Steel Crown', 'A crown befitting a master of coin', 'epic', 6, 2000, 0, '/static/icons/steel_crown.png'),
('helmet', 'dragon_helm', 'Dragonbone Helm', 'Forged from the bones of debt dragons', 'legendary', 8, 0, 5000, '/static/icons/dragon_helm.png'),
('helmet', 'elder_circlet', 'Elder Circlet of Wisdom', 'Ancient headpiece of the coin masters', 'mythic', 10, 10000, 10000, '/static/icons/elder_circlet.png'),

-- ARMOR
('armor', 'cloth_rags', 'Cloth Rags', 'Humble beginnings for every financial hero', 'common', 1, 0, 0, '/static/icons/cloth_rags.png'),
('armor', 'leather_vest', 'Merchant Leather Vest', 'Practical armor for handling coins', 'common', 2, 200, 0, '/static/icons/leather_vest.png'),
('armor', 'chainmail', 'Chainmail of Saving', 'Protection against financial temptation', 'rare', 4, 1000, 0, '/static/icons/chainmail.png'),
('armor', 'plate_armor', 'Plate Armor of Prosperity', 'Heavy armor for serious coin warriors', 'epic', 6, 3000, 0, '/static/icons/plate_armor.png'),
('armor', 'dragon_scale', 'Dragonscale Hauberk', 'Armor made from debt dragon scales', 'legendary', 8, 0, 7000, '/static/icons/dragon_scale.png'),
('armor', 'elder_robes', 'Elder Robes of Mastery', 'Mystical robes of the coin archmages', 'mythic', 10, 15000, 15000, '/static/icons/elder_robes.png'),

-- WEAPONS  
('weapon', 'wooden_stick', 'Wooden Stick', 'Every hero starts with humble tools', 'common', 1, 0, 0, '/static/icons/wooden_stick.png'),
('weapon', 'copper_dagger', 'Copper Counting Dagger', 'Sharp enough to cut through bad spending habits', 'common', 2, 50, 50, '/static/icons/copper_dagger.png'),
('weapon', 'iron_sword', 'Iron Sword of Budgeting', 'A reliable blade for financial battles', 'rare', 4, 500, 500, '/static/icons/iron_sword.png'),
('weapon', 'steel_axe', 'Steel Axe of Debt Cleaving', 'Cleaves through debts like timber', 'epic', 6, 0, 2000, '/static/icons/steel_axe.png'),
('weapon', 'dragon_blade', 'Dragonbone Greatsword', 'Legendary weapon of debt slayers', 'legendary', 8, 0, 8000, '/static/icons/dragon_blade.png'),
('weapon', 'elder_staff', 'Elder Staff of Gold Mastery', 'Channel the ancient powers of coin magic', 'mythic', 10, 20000, 20000, '/static/icons/elder_staff.png'),

-- SHIELDS
('shield', 'wooden_buckler', 'Wooden Buckler', 'Basic protection against overspending', 'common', 3, 300, 0, '/static/icons/wooden_buckler.png'),
('shield', 'iron_shield', 'Iron Shield of Saving', 'Deflects the arrows of impulse purchases', 'rare', 5, 1500, 0, '/static/icons/iron_shield.png'),
('shield', 'dragon_shield', 'Dragonscale Shield', 'Ultimate protection against financial dragons', 'legendary', 9, 0, 12000, '/static/icons/dragon_shield.png'),

-- ACCESSORIES
('accessory', 'coin_pouch', 'Enchanted Coin Pouch', 'Holds more coins than physically possible', 'rare', 3, 500, 0, '/static/icons/coin_pouch.png'),
('accessory', 'golden_ring', 'Golden Ring of Prosperity', 'Attracts wealth like a magnet', 'epic', 7, 5000, 0, '/static/icons/golden_ring.png'),
('accessory', 'elder_amulet', 'Elder Amulet of Infinite Wealth', 'The ultimate symbol of financial mastery', 'mythic', 10, 25000, 25000, '/static/icons/elder_amulet.png'),

-- BACKGROUNDS
('background', 'tavern', 'Village Tavern', 'Where your financial adventure begins', 'common', 1, 0, 0, '/static/backgrounds/tavern.jpg'),
('background', 'market', 'Bustling Market', 'The heart of commerce and trade', 'common', 3, 500, 0, '/static/backgrounds/market.jpg'),
('background', 'castle', 'Noble Castle', 'Home of the financially successful', 'epic', 6, 3000, 0, '/static/backgrounds/castle.jpg'),
('background', 'dragon_lair', 'Dragon Lair Treasury', 'Where the greatest treasures are kept', 'legendary', 9, 0, 15000, '/static/backgrounds/dragon_lair.jpg'),

-- TITLES
('title', 'coin_seeker', 'Coin Seeker', 'One who seeks the path to financial wisdom', 'common', 1, 0, 0, null),
('title', 'penny_pincher', 'Penny Pincher Supreme', 'Master of frugal living', 'rare', 3, 1000, 0, null),
('title', 'debt_slayer', 'Slayer of Debt Dragons', 'Vanquisher of financial burdens', 'epic', 5, 0, 3000, null),
('title', 'gold_hoarder', 'Legendary Gold Hoarder', 'Accumulator of vast treasures', 'legendary', 7, 10000, 0, null),
('title', 'coin_master', 'Elder Master of All Coins', 'Ultimate authority over all currency', 'mythic', 10, 50000, 50000, null);

-- Update achievements with medieval theme
UPDATE achievements SET 
  name = 'First Copper Earned',
  description = 'Earn your first coins in the realm of finance',
  icon = '🪙'
WHERE id = 1;

UPDATE achievements SET 
  name = 'Debt Dragon Wounded',
  description = 'Strike your first blow against the debt dragons',
  icon = '⚔️'
WHERE id = 2;

UPDATE achievements SET 
  name = 'Seven Day Quest',
  description = 'Maintain your saving quest for seven consecutive days',
  icon = '🗡️'
WHERE id = 3;

UPDATE achievements SET 
  name = 'Guild Master Status',
  description = 'Achieve the rank of Guild Master (Level 5)',
  icon = '👑'
WHERE id = 4;

UPDATE achievements SET 
  name = 'Dragon Slayer',
  description = 'Slay a mighty debt dragon worth 1000 gold',
  icon = '🐉'
WHERE id = 5;

UPDATE achievements SET 
  name = 'Emergency Vault Guardian',
  description = 'Build an emergency treasure vault of 500 gold',
  icon = '🛡️'
WHERE id = 6;

UPDATE achievements SET 
  name = 'Elder Scrolls Legend',
  description = 'Achieve legendary status by conquering all debt dragons',
  icon = '📜'
WHERE id = 7;

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_character_rewards_type ON character_rewards(type);
CREATE INDEX IF NOT EXISTS idx_character_rewards_unlock_level ON character_rewards(unlock_level);
CREATE INDEX IF NOT EXISTS idx_user_rewards_user_id ON user_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_equipped ON user_rewards(is_equipped);