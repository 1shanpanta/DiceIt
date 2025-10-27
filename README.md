# DiceIt 🎲

A Telegram group dice game bot with crypto staking on Solana. Players bet SOL or USDC on dice rolls, and the closest number wins the pot!

## Features

- 🎲 Multiple dice types (D6, D10, D20, D100)
- 💰 Stake SOL or USDC
- 🔐 Dynamic.xyz managed wallets
- 👥 Group-based gameplay
- 🎯 Closest number wins
- 💎 Winner takes all (minus 2% house fee)
- 📊 Player statistics tracking
- 🧪 Single player test mode

## How to Play

1. **Start**: Use `/start` in private chat to create your wallet
2. **Deposit**: Use `/deposit` to get your Solana address
3. **Join Group**: Add bot to your Telegram group
4. **Start Game**: Someone uses `/startgame` to choose dice type
5. **Place Bet**: Use `/dice <amount> <token> <number>` to join
6. **Wait**: After 30 seconds, dice rolls automatically
7. **Win**: Closest number wins the entire pot!

## Setup

### Prerequisites

- Node.js 18+
- Supabase account
- Dynamic.xyz account
- Telegram Bot Token

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Environment Variables

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here

# Dynamic.xyz Configuration
DYNAMIC_ENV_ID=your_dynamic_environment_id_here
DYNAMIC_AUTH_TOKEN=your_dynamic_auth_token_here

# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com

# Admin Configuration
ADMIN_USER_IDS=your_telegram_user_id_here
```

### Database Setup

1. Go to your Supabase SQL editor
2. Run the contents of `schema.sql`
3. Verify tables are created

### Run Bot

```bash
# Development
npm run dev

# Production
npm start
```

## Commands

### Wallet Commands
- `/start` - Create wallet and join bot
- `/balance` - Check your SOL and USDC balance
- `/deposit` - Show deposit address with QR code
- `/stats` - View your game statistics

### Test Commands
- `/test` - Test dice mechanics (single player)

### Game Commands (Groups Only)
- `/startgame` - Start a new dice game
- `/dice <amount> <token> <number>` - Join game
- `/pot` - Check current game pot
- `/roll` - Force roll dice (admin only)
- `/help` - Show all commands

## Game Rules

### Dice Types
- **D6** - Standard 6-sided dice (1-6)
- **D10** - Ten-sided dice (1-10)
- **D20** - Twenty-sided dice (1-20)
- **D100** - Hundred-sided dice (1-100)

### Winning Logic
- **Distance**: Closest number to dice result wins
- **Tie**: If multiple players have same distance, they split the pot equally
- **House Fee**: 2% of pot goes to bot maintenance
- **Payout**: Winner(s) get their share immediately to wallet balance

## Technical Stack

- **Telegram Bot API** - node-telegram-bot-api
- **Blockchain** - Solana (@solana/web3.js, @solana/spl-token)
- **Wallet Management** - Dynamic.xyz
- **Database** - Supabase (PostgreSQL)
- **Logging** - Winston

## Project Structure

```
DiceIt/
├── index.js                  # Main bot entry point
├── package.json              # Dependencies
├── .env.example              # Environment template
├── .gitignore                # Git ignore rules
├── src/
│   ├── lib/
│   │   ├── supabase.js      # Database client
│   │   ├── dynamic.js       # Dynamic.xyz client
│   │   └── logger.js        # Winston logger
│   └── managers/
│       ├── WalletManager.js # Wallet operations
│       └── GameManager.js   # Game logic
└── README.md
```

## License

MIT

---

Made with 🎲 by the DiceIt Team