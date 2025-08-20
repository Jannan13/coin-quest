# Budget Level Up - Gamified Mobile Finance App

## Project Overview
- **Name**: Budget Level Up
- **Goal**: A gamified mobile-first budget tracking app that motivates users to save money and pay off debt through a level-up system with video backgrounds
- **Features**: 
  - 📊 Budget tracking (income, expenses, savings)
  - 💳 Debt management and payoff tracking
  - 🎮 Gamification system with levels and achievements
  - 🎬 Dynamic video backgrounds that change as you level up
  - 📱 Mobile-responsive design with glass morphism UI
  - 🏆 Achievement system to reward financial milestones

## Live URLs
- **Development**: https://3000-iyzxp45g1y4nga25l9v59-6532622b.e2b.dev
- **GitHub**: (To be configured)
- **Production**: (To be deployed to Cloudflare Pages)

## Current Features

### ✅ Completed Features
1. **User Profile & Gamification**
   - Level tracking with experience points (XP)
   - Dynamic video backgrounds that change with user level
   - Progress bars and visual level indicators

2. **Budget Tracking**
   - Add income entries with categorization
   - Track expenses across different categories
   - Monitor savings with goal-oriented tracking
   - Real-time budget calculations and summaries

3. **Debt Management**
   - Track multiple debts with current balances
   - Record debt payments and visualize progress
   - Minimum payment reminders and quick pay buttons
   - Progress visualization with completion percentages

4. **Achievement System**
   - 7 different achievements to unlock
   - Requirements based on savings, debt payments, and levels
   - Visual achievement cards with lock/unlock states

5. **Dashboard & Analytics**
   - Monthly summary statistics
   - Recent transaction history
   - Quick action buttons for common tasks
   - Real-time data updates after transactions

### 🔄 Features In Progress
- Enhanced budget analysis and forecasting
- Savings goal progress tracking with timelines
- Additional achievement categories

### 📋 Functional Entry URIs

#### User Management
- `GET /api/user/:id` - Get user profile with stats and level info
- **Parameters**: User ID (integer)
- **Returns**: User data, current level, XP, achievements count, video background URL

#### Dashboard Data
- `GET /api/dashboard/:userId` - Get complete dashboard data
- **Parameters**: User ID (integer) 
- **Returns**: Monthly stats, recent transactions, active debts, savings goals

#### Budget Operations
- `POST /api/budget-entry` - Add new budget entry (income/expense/savings)
- **Body**: `{user_id, category_id, amount, description, entry_date, type}`
- **Returns**: Entry ID, level up status, new level (if applicable)

#### Debt Management
- `POST /api/pay-debt` - Make a debt payment
- **Body**: `{user_id, debt_id, amount}`
- **Returns**: Success status, new balance, paid off status

#### Reference Data
- `GET /api/categories` - Get all budget categories with icons and colors
- `GET /api/achievements/:userId` - Get user's achievement progress

## Data Architecture

### Database Schema (Cloudflare D1 SQLite)
- **users** - User profiles, levels, XP, total savings/debt paid
- **categories** - Budget categories (income, expense, savings, debt)
- **budget_entries** - All financial transactions with categorization
- **debts** - User debt tracking with original/current amounts
- **savings_goals** - Savings targets with progress tracking
- **achievements** - Available achievements with requirements
- **user_achievements** - Unlocked achievements per user
- **level_milestones** - Level definitions with XP requirements and rewards

### Storage Services Used
- **Cloudflare D1**: SQLite database for all relational data
- **Local Storage**: Session data and UI state management
- **Static Assets**: Video backgrounds, CSS, JavaScript files

### Data Flow
1. User performs financial action (save, spend, pay debt)
2. Transaction recorded in budget_entries table
3. Database triggers update user totals and calculate XP
4. System checks for level-ups and achievement unlocks
5. Frontend receives updates and shows animations/notifications
6. Video background changes if user leveled up

## User Guide

### Getting Started
1. **Dashboard**: View your financial overview and current level
2. **Quick Actions**: Use the four main buttons to quickly:
   - Add income (salary, freelance, etc.)
   - Record expenses (food, transport, entertainment)
   - Log savings deposits
   - Make debt payments

### Gamification System
- **Experience Points (XP)**: Earn XP for every financial action
  - Savings: 1 XP per $10 saved
  - Debt Payments: 1 XP per $5 paid toward debt
- **Levels**: Progress through 10 levels, each with unique video backgrounds
- **Achievements**: Unlock 7 achievements by hitting financial milestones

### Managing Your Money
1. **Budget Tab**: (Coming soon) Detailed budget analysis
2. **Debts Tab**: View all debts with progress bars and quick payment options
3. **Achievements Tab**: Track your progress toward financial goals

### Level Progression
- **Level 1**: Budget Beginner (0 XP) - Start your journey
- **Level 2**: Savings Starter (100 XP) - Building habits
- **Level 3**: Debt Fighter (300 XP) - Taking control
- **Level 4**: Budget Pro (600 XP) - Mastering money
- **Level 5**: Financial Warrior (1000 XP) - Outstanding discipline
- And more levels up to **Financial Legend** (Level 10)

## Technical Stack

### Frontend
- **Framework**: Mobile-first responsive design
- **Styling**: TailwindCSS with glass morphism effects
- **Icons**: Font Awesome for consistent iconography
- **JavaScript**: Vanilla JS with Axios for API calls
- **Features**: Real-time updates, smooth animations, modal dialogs

### Backend
- **Framework**: Hono (lightweight, fast)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **API**: RESTful JSON APIs

### Development
- **Build Tool**: Vite for fast development and building
- **Package Manager**: npm
- **Process Manager**: PM2 for development server
- **Database Migrations**: Wrangler D1 migrations system

## Deployment

### Current Status
- **Platform**: Cloudflare Pages (Ready for deployment)
- **Status**: ✅ Development Active
- **Local Development**: PM2 with wrangler pages dev
- **Database**: Local D1 SQLite for development

### Environment Setup
```bash
# Install dependencies
npm install

# Setup local database
npm run db:migrate:local
npm run db:seed

# Start development server
npm run clean-port
pm2 start ecosystem.config.cjs

# Test the application
npm run test
```

### Production Deployment
```bash
# Build for production
npm run build

# Deploy to Cloudflare Pages
npm run deploy:prod
```

## Recent Updates
- **2024-08-20**: Complete mobile app implementation with full gamification system
- **Features Added**: Video backgrounds, achievement system, debt tracking, mobile-responsive UI
- **Database**: Full D1 schema with triggers for automatic XP calculation
- **API**: Complete RESTful API for all budget operations

## Next Development Steps
1. **Enhanced Analytics**: Add spending category breakdowns and trends
2. **Video Content**: Replace placeholder videos with actual motivational content
3. **Social Features**: Add sharing achievements and comparing progress
4. **Notifications**: Push notifications for payment reminders and achievements
5. **Cloud Deployment**: Deploy to production Cloudflare Pages
6. **Advanced Goals**: Add custom savings goals with deadline tracking
7. **Export Features**: Allow users to export their financial data

---

**Note**: This app demonstrates modern web development with edge computing, real-time data, and engaging user experience design. The gamification elements make financial management fun and motivating! 🚀💰