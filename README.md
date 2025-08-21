# ⚔️ Coin Quest RPG - Medieval Budget Adventure

## Project Overview
- **Name**: Coin Quest RPG
- **Theme**: Elder Scrolls-inspired medieval fantasy budget management
- **Goal**: Transform financial management into an epic RPG adventure where you level up by saving gold and slaying debt dragons
- **Features**: 
  - 🏰 Medieval fantasy theme with Elder Scrolls-style progression
  - ⚔️ Character customization with unlockable armor, weapons, and titles
  - 🐉 Debt dragons to slay for experience and rewards
  - 👑 Epic level progression from Peasant to Elder Master
  - 🎬 Medieval-themed video backgrounds that evolve with your journey
  - 📱 Mobile-responsive design with glass morphism medieval UI
  - 🏆 Achievement system with fantasy rewards and titles

## Live URLs
- **Development**: https://3000-iyzxp45g1y4nga25l9v59-6532622b.e2b.dev
- **GitHub**: (To be configured)
- **Production**: (To be deployed to Cloudflare Pages)

## 🏰 Medieval Fantasy Features

### ✅ Character Progression System
1. **Epic Level Titles**
   - Level 1: Peasant Coin-Counter
   - Level 2: Apprentice Merchant
   - Level 3: Skilled Trader
   - Level 4: Guild Treasurer
   - Level 5: Noble Financier
   - Level 6: Royal Advisor
   - Level 7: Dragon Slayer of Debt
   - Level 8: Archmage of Assets
   - Level 9: Legendary Coin Lord
   - Level 10: Elder Scrolls Master of Gold

2. **Character Customization**
   - **Helmets**: From Leather Cap to Elder Circlet of Wisdom
   - **Armor**: From Cloth Rags to Elder Robes of Mastery
   - **Weapons**: From Wooden Stick to Elder Staff of Gold Mastery
   - **Shields**: From Wooden Buckler to Dragonscale Shield
   - **Accessories**: Enchanted Coin Pouches, Golden Rings, Elder Amulets
   - **Titles**: From Coin Seeker to Elder Master of All Coins

3. **Equipment Rarity System**
   - **Common** (Gray): Basic starting equipment
   - **Rare** (Blue): Improved equipment for dedicated adventurers
   - **Epic** (Purple): Powerful gear for serious financial warriors
   - **Legendary** (Gold): Mighty equipment forged from dragon parts
   - **Mythic** (Red): Ultimate Elder Scrolls-level legendary items

### 🐉 Debt Dragon Slaying System
- Transform debts into fearsome dragons to battle
- Different dragon types based on debt size (small dragons to ancient wyrms)
- Visual health bars showing dragon strength
- Epic combat messages and victory celebrations
- Unlock dragon-themed equipment by slaying debt beasts

### 🏆 Medieval Achievement System
- **First Copper Earned** 🪙 - Begin your financial quest
- **Debt Dragon Wounded** ⚔️ - Strike your first blow against debt
- **Seven Day Quest** 🗡️ - Maintain saving discipline
- **Guild Master Status** 👑 - Achieve leadership rank
- **Dragon Slayer** 🐉 - Vanquish mighty debt dragons
- **Emergency Vault Guardian** 🛡️ - Build protective treasure reserves
- **Elder Scrolls Legend** 📜 - Achieve ultimate mastery

## 📋 Functional Entry URIs

### User & Character Management
- `GET /api/user/:id` - Get user profile with medieval character stats
- **Returns**: Character class, title, equipped items, level, XP, medieval titles

### Character Customization
- `GET /api/character-rewards/:userId` - Get all available character rewards
- **Returns**: Equipment by type (helmet, armor, weapon, shield, accessory), unlock requirements, rarity
- `POST /api/equip-reward` - Equip character customization item
- **Body**: `{user_id, reward_id}`
- `POST /api/check-rewards` - Check for newly unlocked rewards
- **Returns**: List of newly available equipment

### Quest & Combat System
- `GET /api/dashboard/:userId` - Get complete quest hall data
- **Returns**: Monthly treasury report, recent quest activity, active debt dragons
- `POST /api/budget-entry` - Complete financial quest (earn/spend/save gold)
- **Body**: `{user_id, category_id, amount, description, entry_date, type}`
- **Returns**: XP gained, level up status, newly unlocked rewards
- `POST /api/pay-debt` - Attack debt dragon
- **Body**: `{user_id, debt_id, amount}`
- **Returns**: Dragon damage dealt, slaying status, victory rewards

### Reference Data
- `GET /api/categories` - Get quest categories with medieval theming
- `GET /api/achievements/:userId` - Get medieval achievement progress

## 🎮 Character Customization System

### Equipment Categories

#### 🛡️ **Helmets** (5 items)
- **Leather Cap** (Common, Level 2) - Simple merchant headwear
- **Iron Helm** (Rare, Level 4) - Sturdy trader protection
- **Steel Crown** (Epic, Level 6) - Crown of coin mastery
- **Dragonbone Helm** (Legendary, Level 8) - Forged from debt dragon bones
- **Elder Circlet of Wisdom** (Mythic, Level 10) - Ancient headpiece of masters

#### ⚔️ **Weapons** (6 items)  
- **Wooden Stick** (Common, Level 1) - Humble hero beginnings
- **Copper Counting Dagger** (Common, Level 2) - Cuts through bad habits
- **Iron Sword of Budgeting** (Rare, Level 4) - Reliable financial blade
- **Steel Axe of Debt Cleaving** (Epic, Level 6) - Cleaves through debts
- **Dragonbone Greatsword** (Legendary, Level 8) - Legendary debt slayer weapon
- **Elder Staff of Gold Mastery** (Mythic, Level 10) - Channel ancient coin magic

#### 🛡️ **Armor** (6 items)
- **Cloth Rags** (Common, Level 1) - Humble financial hero beginnings
- **Merchant Leather Vest** (Common, Level 2) - Practical coin handling gear
- **Chainmail of Saving** (Rare, Level 4) - Protection against temptation
- **Plate Armor of Prosperity** (Epic, Level 6) - Heavy armor for coin warriors
- **Dragonscale Hauberk** (Legendary, Level 8) - Armor from dragon scales
- **Elder Robes of Mastery** (Mythic, Level 10) - Mystical archmage robes

#### 🛡️ **Shields** (3 items)
- **Wooden Buckler** (Common, Level 3) - Basic overspending protection
- **Iron Shield of Saving** (Rare, Level 5) - Deflects impulse purchases
- **Dragonscale Shield** (Legendary, Level 9) - Ultimate financial protection

#### 💍 **Accessories** (3 items)
- **Enchanted Coin Pouch** (Rare, Level 3) - Holds infinite coins
- **Golden Ring of Prosperity** (Epic, Level 7) - Attracts wealth
- **Elder Amulet of Infinite Wealth** (Mythic, Level 10) - Ultimate mastery symbol

## Data Architecture

### Enhanced Database Schema (Cloudflare D1 SQLite)
**Core Tables:**
- **users** - Enhanced with character_class, character_title, equipped items
- **categories** - Quest categories with medieval theming
- **budget_entries** - Financial quests and adventures
- **debts** - Debt dragons to slay
- **achievements** - Medieval honor system

**Character System Tables:**
- **character_rewards** - All available equipment and customization items
- **user_rewards** - User's unlocked and equipped items
- **level_milestones** - Medieval level progression with titles and descriptions

### Medieval Data Flow
1. User completes financial quest (earn gold, spend gold, store treasure, slay dragons)
2. Experience points awarded based on quest type and value
3. System checks for level progression and new rank titles
4. Character rewards system evaluates newly unlocked equipment
5. User receives notifications for new gear, titles, and achievements
6. Character avatar updates with new equipment and visual progression

## 🎮 User Guide

### Starting Your Adventure
1. **Quest Hall**: Your main hub for viewing financial adventures and character stats
2. **Character Creation**: Begin as a humble Peasant with cloth rags and wooden stick
3. **Quest System**: Complete four types of financial quests:
   - 🪙 **Earn Gold** - Record income from various sources
   - 🛒 **Spend Gold** - Track expenses across categories
   - 💎 **Store Treasure** - Build savings for future adventures
   - ⚔️ **Slay Dragons** - Attack and defeat debt dragons

### Character Progression
- **Experience Points**: Gain XP for every financial action
  - Treasure Storage: 1 XP per 10 gold saved
  - Dragon Slaying: 1 XP per 5 gold of debt defeated
- **Level Up**: Progress through 10 epic ranks with medieval titles
- **Equipment Unlocks**: Unlock new gear based on level, savings, and dragon slaying

### Equipment System
1. **Character Tab**: View your character with all equipment slots
2. **Equipment Categories**: Browse helmets, armor, weapons, shields, accessories
3. **Rarity System**: Equipment ranges from Common to Mythic rarity
4. **Equip Items**: Click unlocked equipment to equip and customize your character
5. **Visual Updates**: Watch your character avatar transform with new gear

### Dragon Combat System
1. **Dragons Tab**: View all debt dragons that threaten your financial realm
2. **Dragon Types**: Different dragons based on debt size and danger level
3. **Combat Actions**: Attack dragons with gold payments
4. **Victory Rewards**: Unlock dragon-themed equipment and titles
5. **Health Bars**: Watch dragons weaken as you make payments

## Technical Stack

### Frontend Enhancements
- **Fonts**: Medieval-themed fonts (Cinzel, MedievalSharp)
- **Color Scheme**: Gold, brown, amber medieval palette
- **Animations**: Equipment equipping, level-up celebrations, dragon combat
- **Icons**: Medieval fantasy icons for all equipment and actions

### Backend Features
- **Character System API**: Complete equipment and customization management
- **Reward Unlocking**: Automatic checking and notification of new rewards
- **Equipment Management**: Equip/unequip system with visual updates
- **Medieval Theming**: All text and messaging transformed to fantasy theme

## Deployment

### Current Status
- **Platform**: Cloudflare Pages (Ready for deployment)
- **Status**: ✅ Medieval Transformation Complete
- **Features**: Full character customization, equipment system, medieval theming
- **Database**: Enhanced with complete character reward system

### Environment Setup
```bash
# Install dependencies and apply medieval updates
npm install

# Setup enhanced database with character system
npm run db:migrate:local
npm run db:seed

# Start medieval adventure server
npm run clean-port
pm2 start ecosystem.config.cjs

# Test your medieval adventure
npm run test
```

## Recent Updates
- **2024-08-21**: Complete medieval transformation with Elder Scrolls-style theming
- **Character System**: 32 unique equipment items across 6 categories with 5 rarity levels
- **Medieval UI**: Complete visual overhaul with fantasy fonts, colors, and animations
- **Dragon Combat**: Debt dragons with health bars, combat messages, and victory celebrations
- **Equipment Visualization**: Character avatar with equipment slots and visual updates
- **Achievement Overhaul**: Medieval-themed achievements with fantasy descriptions
- **Level Progression**: Epic titles from Peasant to Elder Scrolls Master

## Next Development Steps
1. **Video Content**: Add actual medieval fantasy video backgrounds
2. **Sound Effects**: Medieval music and combat sounds
3. **Enhanced Animations**: Equipment transformation effects and level-up celebrations
4. **Social Features**: Guild system for sharing achievements
5. **Advanced Combat**: Special attacks and dragon boss battles
6. **Crafting System**: Combine materials to create custom equipment
7. **Realm Expansion**: Additional zones and higher level content

---

**⚔️ Welcome to Coin Quest RPG! Transform your financial journey into an epic medieval adventure where every gold coin saved and every debt dragon slain brings you closer to becoming an Elder Scrolls Master of Gold! 🏰💰**