# 🗄️ Production Database Setup for cointquest.org

## CRITICAL: You MUST set up the production database!

Your Coin Quest RPG needs a D1 database with all 180+ rewards and subscription plans.

### Step 1: Create Production Database
In your Cloudflare Dashboard:
1. Go to **D1** (in left sidebar)
2. Click **"Create database"**
3. Database name: **`cointquest-production`**
4. Click **Create**
5. **Copy the Database ID** (you'll need this)

### Step 2: Update wrangler.jsonc
In your project folder, update `wrangler.jsonc`:

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "cointquest-org",
  "compatibility_date": "2024-01-01",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "cointquest-production",
      "database_id": "YOUR_ACTUAL_DATABASE_ID_HERE"
    }
  ]
}
```

### Step 3: Apply All Migrations
Run these commands in your project folder:

```bash
# Apply all 5 migrations to production database
npx wrangler d1 migrations apply cointquest-production --remote

# Verify the setup - should show 180 rewards
npx wrangler d1 execute cointquest-production --remote --command="SELECT COUNT(*) FROM character_rewards;"

# Verify subscription plans - should show 2 plans
npx wrangler d1 execute cointquest-production --remote --command="SELECT name, price_monthly FROM subscription_plans;"
```

### Expected Results:
- ✅ 180 character rewards
- ✅ 7 achievements  
- ✅ 2 subscription plans (Free Trial + $4.99 Premium)
- ✅ All database tables created

### Step 4: Redeploy Pages Project
After updating wrangler.jsonc:
1. Rebuild: `npm run build`
2. Upload new `dist/` contents to Cloudflare Pages
3. Your database will be connected!

## 🚨 WITHOUT THIS DATABASE SETUP:
- Users can't register
- No character rewards will show
- Subscription system won't work
- App will show errors

## ✅ WITH PROPER DATABASE SETUP:
- ✅ Full user registration/login
- ✅ 180+ rewards system working
- ✅ $4.99/month subscriptions active
- ✅ Medieval budget tracking functional
- ✅ Ready to generate revenue!

**This database setup is CRITICAL for your site to work!**