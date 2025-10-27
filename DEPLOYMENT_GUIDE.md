# DiceIt Bot - Deployment Guide

## 🎯 Complete Setup Checklist

Follow these steps to get your DiceIt bot fully running and ready for demo!

### 1. **Set Up Your Database** (5 minutes)

#### Supabase Setup:
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **"New Query"**
4. Copy the entire contents of `schema.sql` from this repo
5. Paste into SQL Editor
6. Click **"Run"** or press `Cmd/Ctrl + Enter`
7. Verify success message
8. Check **Table Editor** to confirm tables exist:
   - ✅ users
   - ✅ wallets  
   - ✅ games
   - ✅ bets

#### Get Supabase Credentials:
1. Go to **Settings > API** (left sidebar)
2. Copy **"Project URL"** (looks like: `https://xxxxx.supabase.co`)
3. Copy **"anon public"** key (under Project API keys)
4. Save both for Step 3

### 2. **Get Your Telegram User ID** (2 minutes)

1. Open Telegram
2. Search for **@userinfobot**
3. Start a chat with the bot
4. Bot will reply with your user ID (a number like: `123456789`)
5. Copy this number for Step 3

### 3. **Update Your .env File** (3 minutes)

Edit your `.env` file with the following credentials:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Supabase Configuration (from Step 1)
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here

# Dynamic.xyz Configuration (get new credentials)
DYNAMIC_ENV_ID=your_dynamic_environment_id
DYNAMIC_AUTH_TOKEN=your_dynamic_auth_token

# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com

# Admin Configuration (from Step 2)
ADMIN_USER_IDS=your_telegram_user_id_here

# Game Configuration
HOUSE_FEE_PERCENT=2
GAME_COUNTDOWN_SECONDS=30
MIN_STAKE_SOL=0.01
MAX_STAKE_SOL=10
MIN_STAKE_USDC=1
MAX_STAKE_USDC=1000

# USDC SPL Token Address (Devnet)
USDC_MINT_ADDRESS=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# Chainlink VRF Configuration (Optional)
CHAINLINK_VRF_FEE=0.001
```

### 4. **Test the Bot Locally** (10 minutes)

```bash
# Navigate to project directory
cd /path/to/DiceIt

# Install dependencies (if not done)
npm install

# Start the bot
npm start
```

#### Test Commands:
1. **Message your bot** with `/start`
2. **Test dice mechanics** with `/test`
3. **Check balance** with `/balance`
4. **Get deposit address** with `/deposit`
5. **Create test group** and try `/startgame`

### 5. **Deploy to Production** (15 minutes)

Choose one hosting platform:

#### Option A: Railway (Recommended - Easiest)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy
railway up

# Set environment variables in Railway dashboard
```

#### Option B: Render (Free Tier)
1. Go to https://render.com
2. Connect your GitHub repository
3. Create new Web Service
4. Set environment variables
5. Deploy

#### Option C: DigitalOcean App Platform
1. Go to https://cloud.digitalocean.com/apps
2. Create new app from GitHub
3. Configure environment variables
4. Deploy

## 🎲 Ready to Demo!

Once all steps are complete, you'll have:

### ✅ **Working Features:**
- **Telegram bot** responding to commands
- **Dynamic.xyz wallets** for each user
- **Supabase database** storing all data
- **Group dice games** with real-time updates
- **Single player test mode** for demos
- **Crypto staking** with SOL/USDC
- **Winner calculation** and payouts

### 🏆 **Demo Flow:**
1. **Show test mode** - `/test` with different dice types
2. **Create group game** - `/startgame` with multiple players  
3. **Show wallet creation** - Dynamic.xyz integration
4. **Demonstrate betting** - Real crypto staking
5. **Show winner calculation** - Fair, transparent logic

### 📱 **Bot Commands:**
- `/start` - Create wallet and join bot
- `/test` - Test dice mechanics (single player)
- `/balance` - Check SOL and USDC balance
- `/deposit` - Show deposit address with QR code
- `/startgame` - Start a new dice game (groups)
- `/dice <amount> <token> <number>` - Join game
- `/pot` - Check current game pot
- `/stats` - View your game statistics
- `/help` - Show all commands

## 🚀 Total Time Needed: ~30 minutes

From code to live bot in just 30 minutes!

## 🔧 Troubleshooting

### Bot not responding?
- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify bot is running (`npm start`)
- Check console for errors

### Wallet creation fails?
- Check Dynamic.xyz credentials
- Verify `DYNAMIC_ENV_ID` and `DYNAMIC_AUTH_TOKEN`
- Check internet connection

### Database errors?
- Check Supabase is running
- Verify `SUPABASE_URL` and `SUPABASE_KEY`
- Check `schema.sql` was run successfully

### Game not starting?
- Bot must be in group
- Bot needs message permissions
- Try `/startgame` again

## 🎯 Success Indicators

You'll know it's working when:
- ✅ Bot responds to `/start` with wallet creation
- ✅ `/test` shows dice selection and rolls
- ✅ `/balance` shows SOL/USDC balances
- ✅ Group games work with `/startgame` and `/dice`
- ✅ Winners are calculated and announced

## 🏆 Hackathon Ready!

Your DiceIt bot is now ready to impress the judges with:
- **Technical complexity** (blockchain integration)
- **User experience** (simple Telegram interface)
- **Real functionality** (working crypto gaming)
- **Professional quality** (clean code, documentation)

Good luck with your hackathon presentation! 🎲