import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import supabase from './src/lib/supabase.js';
import WalletManager from './src/managers/WalletManager.js';
import GameManager from './src/managers/GameManager.js';
import logger from './src/lib/logger.js';

dotenv.config();

class DiceItBot {
  constructor() {
    this.bot = null;
    this.walletManager = new WalletManager();
    this.gameManager = new GameManager();
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Bot is already running');
      return;
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.setupEventHandlers();

    this.isRunning = true;
    logger.info('🎲 DiceIt Bot started successfully!');
  }

  setupEventHandlers() {
    // Commands
    this.bot.onText(/^\/start$/i, (msg) => this.handleStart(msg));
    this.bot.onText(/^\/help$/i, (msg) => this.handleHelp(msg));
    this.bot.onText(/^\/balance$/i, (msg) => this.handleBalance(msg));
    this.bot.onText(/^\/deposit$/i, (msg) => this.handleDeposit(msg));
    this.bot.onText(/^\/startgame$/i, (msg) => this.handleStartGame(msg));
    this.bot.onText(/^\/dice ([\d.]+) (SOL|USDC) (\d+)$/i, (msg, match) => 
      this.handleDice(msg, parseFloat(match[1]), match[2], parseInt(match[3])));
    this.bot.onText(/^\/pot$/i, (msg) => this.handlePot(msg));
    this.bot.onText(/^\/stats$/i, (msg) => this.handleStats(msg));
    this.bot.onText(/^\/roll$/i, (msg) => this.handleRoll(msg));
    this.bot.onText(/^\/test$/i, (msg) => this.handleTest(msg));

    // Callback queries
    this.bot.on('callback_query', (query) => this.handleCallbackQuery(query));

    // Error handling
    this.bot.on('polling_error', (error) => logger.error('Polling error:', error));
    this.bot.on('error', (error) => logger.error('Bot error:', error));
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'User';

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (user) {
      await this.bot.sendMessage(chatId,
        `👋 Welcome back, ${username}!\n\n` +
        `🎲 Ready to roll some dice?\n\n` +
        `Use /help to see available commands.`
      );
      return;
    }

    // Create new user
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramId,
        username: username
      })
      .select()
      .single();

    if (userError) {
      await this.bot.sendMessage(chatId, '❌ Error creating account. Please try again.');
      return;
    }

    // Create wallet
    await this.bot.sendMessage(chatId, '🔄 Creating your Solana wallet...');

    const wallet = await this.walletManager.createUserWallet(newUser.id, telegramId, username);

    await this.bot.sendMessage(chatId,
      `✅ **Welcome to DiceIt!** 🎲\n\n` +
      `Your wallet has been created:\n` +
      `💼 Address: \`${wallet.address}\`\n\n` +
      `**How to Play:**\n` +
      `1. Deposit SOL or USDC to your wallet\n` +
      `2. Join a group with DiceIt bot\n` +
      `3. Someone starts a game with /startgame\n` +
      `4. Join with /dice <amount> <token> <number>\n` +
      `5. Winner takes all!\n\n` +
      `💡 Use /help for all commands`,
      { parse_mode: 'Markdown' }
    );

    logger.info(`✅ New user created: ${username} (${telegramId})`);
  }

  async handleHelp(msg) {
    const chatId = msg.chat.id;
    await this.bot.sendMessage(chatId,
      `🎲 **DiceIt - Help**\n\n` +
      `**Wallet Commands:**\n` +
      `/start - Create wallet and join bot\n` +
      `/balance - Check your SOL and USDC balance\n` +
      `/deposit - Show deposit address with QR code\n` +
      `/stats - View your game statistics\n\n` +
      `**Test Commands:**\n` +
      `/test - Test dice mechanics (single player)\n\n` +
      `**Game Commands (Groups Only):**\n` +
      `/startgame - Start a new dice game\n` +
      `/dice <amount> <token> <number> - Join game\n` +
      `  Example: /dice 0.5 USDC 4\n` +
      `/pot - Check current game pot\n` +
      `/roll - Force roll dice (admin only)\n\n` +
      `**How to Play:**\n` +
      `• Game creator chooses dice type (D6, D10, D20, D100)\n` +
      `• Players pick numbers and stake SOL/USDC\n` +
      `• After 30s, dice rolls automatically\n` +
      `• Closest number wins the pot!\n` +
      `• If tie, winners split the pot\n\n` +
      `💡 House fee: 2%`,
      { parse_mode: 'Markdown' }
    );
  }

  async handleBalance(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (!user) {
      await this.bot.sendMessage(chatId, '❌ Please use /start first!');
      return;
    }

    const balances = await this.walletManager.refreshBalance(user.id);

    if (!balances) {
      await this.bot.sendMessage(chatId, '❌ Wallet not found!');
      return;
    }

    await this.bot.sendMessage(chatId,
      `💰 **Your Balances**\n\n` +
      `🔵 SOL: ${balances.solBalance.toFixed(4)}\n` +
      `💵 USDC: ${balances.usdcBalance.toFixed(2)}\n\n` +
      `Use /deposit to add funds`,
      { parse_mode: 'Markdown' }
    );
  }

  async handleDeposit(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (!user) {
      await this.bot.sendMessage(chatId, '❌ Please use /start first!');
      return;
    }

    const wallet = await this.walletManager.getWallet(user.id);

    if (!wallet) {
      await this.bot.sendMessage(chatId, '❌ Wallet not found!');
      return;
    }

    const qrCode = await QRCode.toDataURL(wallet.address);

    await this.bot.sendPhoto(chatId, Buffer.from(qrCode.split(',')[1], 'base64'), {
      caption:
        `💾 **Deposit Address**\n\n` +
        `\`${wallet.address}\`\n\n` +
        `⚠️ **Devnet Only!**\n` +
        `Send SOL or USDC (devnet) to this address\n\n` +
        `⏰ Balance updates automatically`,
      parse_mode: 'Markdown'
    });
  }

  async handleStartGame(msg) {
    const chatId = msg.chat.id;

    // Check if in group
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
      await this.bot.sendMessage(chatId, '❌ This command only works in groups!');
      return;
    }

    // Show dice type selection
    await this.bot.sendMessage(chatId,
      '🎲 **Starting New Game**\n\nChoose dice type:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'D6 (1-6) 🎲', callback_data: 'start_D6_telegram' },
              { text: 'D10 (1-10) 🔟', callback_data: 'start_D10_chainlink' }
            ],
            [
              { text: 'D20 (1-20) 🎯', callback_data: 'start_D20_chainlink' },
              { text: 'D100 (1-100) 💯', callback_data: 'start_D100_chainlink' }
            ]
          ]
        }
      }
    );
  }

  async handleDice(msg, amount, token, number) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'User';

    // Check if in group
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
      await this.bot.sendMessage(chatId, '❌ This command only works in groups!');
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (!user) {
      await this.bot.sendMessage(chatId, '❌ Please use /start first in private chat!');
      return;
    }

    const result = await this.gameManager.joinGame(chatId, user.id, username, amount, token, number);

    if (result.error) {
      await this.bot.sendMessage(chatId, `❌ ${result.error}`);
      return;
    }

    const gameData = this.gameManager.getActiveGame(chatId);

    await this.bot.sendMessage(chatId,
      `✅ **${username} joined!**\n\n` +
      `💰 Stake: ${amount} ${token}\n` +
      `🎯 Chosen number: ${number}\n\n` +
      `**Current Pot:**\n` +
      `🔵 SOL: ${gameData.pot.SOL.toFixed(4)}\n` +
      `💵 USDC: ${gameData.pot.USDC.toFixed(2)}\n` +
      `👥 Players: ${gameData.players.length}`,
      { parse_mode: 'Markdown' }
    );
  }

  async handlePot(msg) {
    const chatId = msg.chat.id;

    const potInfo = this.gameManager.getPotInfo(chatId);

    if (!potInfo) {
      await this.bot.sendMessage(chatId, '❌ No active game in this group!');
      return;
    }

    await this.bot.sendMessage(chatId,
      `💰 **Current Pot**\n\n` +
      `🎲 Dice: ${potInfo.diceType}\n` +
      `🔵 SOL: ${potInfo.pot.SOL.toFixed(4)}\n` +
      `💵 USDC: ${potInfo.pot.USDC.toFixed(2)}\n` +
      `👥 Players: ${potInfo.players}\n\n` +
      `Use /dice to join!`,
      { parse_mode: 'Markdown' }
    );
  }

  async handleStats(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (!user) {
      await this.bot.sendMessage(chatId, '❌ Please use /start first!');
      return;
    }

    const winRate = user.total_games > 0 ? (user.total_wins / user.total_games * 100).toFixed(1) : 0;

    await this.bot.sendMessage(chatId,
      `📊 **Your Statistics**\n\n` +
      `🎮 Total Games: ${user.total_games}\n` +
      `🏆 Wins: ${user.total_wins}\n` +
      `📈 Win Rate: ${winRate}%\n\n` +
      `**Wagered:**\n` +
      `🔵 SOL: ${parseFloat(user.total_wagered_sol || 0).toFixed(4)}\n` +
      `💵 USDC: ${parseFloat(user.total_wagered_usdc || 0).toFixed(2)}\n\n` +
      `**Won:**\n` +
      `🔵 SOL: ${parseFloat(user.total_won_sol || 0).toFixed(4)}\n` +
      `💵 USDC: ${parseFloat(user.total_won_usdc || 0).toFixed(2)}`,
      { parse_mode: 'Markdown' }
    );
  }

  async handleRoll(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    // Check admin
    const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => parseInt(id.trim()));
    if (!adminIds.includes(telegramId)) {
      return;
    }

    const gameData = this.gameManager.getActiveGame(chatId);

    if (!gameData) {
      await this.bot.sendMessage(chatId, '❌ No active game!');
      return;
    }

    // Roll dice
    await this.executeRoll(chatId);
  }

  async handleTest(msg) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (!user) {
      await this.bot.sendMessage(chatId, '❌ Please use /start first!');
      return;
    }

    // Show test mode dice selection
    await this.bot.sendMessage(chatId,
      '🧪 **Test Mode**\n\nChoose dice type to test:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'D6 (1-6) 🎲', callback_data: 'test_D6' },
              { text: 'D10 (1-10) 🔟', callback_data: 'test_D10' }
            ],
            [
              { text: 'D20 (1-20) 🎯', callback_data: 'test_D20' },
              { text: 'D100 (1-100) 💯', callback_data: 'test_D100' }
            ]
          ]
        }
      }
    );
  }

  async executeRoll(chatId) {
    const gameData = this.gameManager.getActiveGame(chatId);

    if (!gameData) return;

    await this.bot.sendMessage(chatId, '🎲 Rolling dice...');

    // Use Telegram dice if D6 and telegram method
    if (gameData.diceType === 'D6' && gameData.randomnessMethod === 'telegram') {
      const diceMsg = await this.bot.sendDice(chatId, { emoji: '🎲' });
      const diceResult = diceMsg.dice.value;

      // Wait for animation
      setTimeout(async () => {
        await this.finishGame(chatId, diceResult);
      }, 4000);
    } else {
      // Generate random number
      const { min, max } = gameData.diceConfig;
      const diceResult = Math.floor(Math.random() * (max - min + 1)) + min;

      // Show dice animation (visual only for D6)
      await this.bot.sendDice(chatId, { emoji: '🎲' });

      setTimeout(async () => {
        await this.bot.sendMessage(chatId, `🎯 **Result: ${diceResult}**`, { parse_mode: 'Markdown' });
        await this.finishGame(chatId, diceResult);
      }, 4000);
    }
  }

  async executeTestRoll(chatId, diceType) {
    // Get dice configuration
    const diceConfigs = {
      'D6': { min: 1, max: 6, name: '6-sided dice 🎲' },
      'D10': { min: 1, max: 10, name: '10-sided dice 🔟' },
      'D20': { min: 1, max: 20, name: '20-sided dice 🎯' },
      'D100': { min: 1, max: 100, name: '100-sided dice 💯' }
    };

    const config = diceConfigs[diceType];
    if (!config) return;

    await this.bot.sendMessage(chatId, `🧪 **Testing ${config.name}**\n\n🎲 Rolling...`);

    // Use Telegram dice for D6, random for others
    if (diceType === 'D6') {
      const diceMsg = await this.bot.sendDice(chatId, { emoji: '🎲' });
      const diceResult = diceMsg.dice.value;

      setTimeout(async () => {
        await this.bot.sendMessage(chatId,
          `🎯 **Test Result: ${diceResult}**\n\n` +
          `📊 Dice: ${diceType} (${config.min}-${config.max})\n` +
          `🎲 Range: ${config.min} to ${config.max}\n\n` +
          `Use /test to try again!`,
          { parse_mode: 'Markdown' }
        );
      }, 4000);
    } else {
      // Generate random number for non-D6 dice
      const diceResult = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;

      // Show dice animation for visual effect
      await this.bot.sendDice(chatId, { emoji: '🎲' });

      setTimeout(async () => {
        await this.bot.sendMessage(chatId,
          `🎯 **Test Result: ${diceResult}**\n\n` +
          `📊 Dice: ${diceType} (${config.min}-${config.max})\n` +
          `🎲 Range: ${config.min} to ${config.max}\n\n` +
          `Use /test to try again!`,
          { parse_mode: 'Markdown' }
        );
      }, 4000);
    }
  }

  async finishGame(chatId, diceResult) {
    const result = await this.gameManager.rollDice(chatId, diceResult);

    if (result.error) {
      await this.bot.sendMessage(chatId, `❌ ${result.error}`);
      return;
    }

    const winnersText = result.winners.map(w => `@${w.username}`).join(', ');
    const payout = result.winners[0].token === 'SOL' ? 
      `${result.payoutSOL.toFixed(4)} SOL` : 
      `${result.payoutUSDC.toFixed(2)} USDC`;

    await this.bot.sendMessage(chatId,
      `🎉 **Game Finished!**\n\n` +
      `🎲 Result: **${diceResult}**\n` +
      `🏆 Winner(s): ${winnersText}\n` +
      `💰 Payout each: ${payout}\n\n` +
      `👥 Total players: ${result.totalPlayers}\n` +
      `💎 Total pot: ${result.pot.SOL.toFixed(4)} SOL + ${result.pot.USDC.toFixed(2)} USDC\n\n` +
      `Use /startgame to play again!`,
      { parse_mode: 'Markdown' }
    );
  }

  async handleCallbackQuery(query) {
    const chatId = query.message.chat.id;
    const data = query.data;

    // Handle game start with dice type selection
    if (data.startsWith('start_')) {
      const [, diceType, randomnessMethod] = data.split('_');
      const groupName = query.message.chat.title || 'Group';

      const result = await this.gameManager.startGame(chatId, groupName, diceType, randomnessMethod);

      if (result.error) {
        await this.bot.answerCallbackQuery(query.id, { text: result.error });
        return;
      }

      await this.bot.editMessageText(
        `🎲 **Game Started!**\n\n` +
        `📊 Dice: ${diceType}\n` +
        `🔐 Randomness: ${randomnessMethod}\n\n` +
        `Players have 30 seconds to join!\n` +
        `Use: /dice <amount> <SOL|USDC> <number>\n\n` +
        `Example: /dice 0.5 USDC 4`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown'
        }
      );

      // Start countdown timer
      const countdownSeconds = parseInt(process.env.GAME_COUNTDOWN_SECONDS || 30);
      setTimeout(() => {
        this.executeRoll(chatId);
      }, countdownSeconds * 1000);

      await this.bot.answerCallbackQuery(query.id);
    }

    // Handle test mode dice selection
    if (data.startsWith('test_')) {
      const diceType = data.replace('test_', '');
      await this.executeTestRoll(chatId, diceType);
      await this.bot.answerCallbackQuery(query.id);
    }
  }

  async stop() {
    if (this.bot) {
      await this.bot.stopPolling();
    }
    this.isRunning = false;
    logger.info('🛑 Bot stopped');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...');
  if (global.bot) {
    await global.bot.stop();
  }
  process.exit(0);
});

// Start bot
async function main() {
  global.bot = new DiceItBot();
  await global.bot.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DiceItBot };
