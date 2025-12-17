import supabase from '../lib/supabase.js';
import logger from '../lib/logger.js';

class GameManager {
  constructor() {
    this.activeGames = new Map(); // groupId -> gameData
    this.gameTimers = new Map(); // groupId -> timeoutId
  }

  //
  // Dice type configurations
  getDiceConfig(diceType) {
    const configs = {
      'D6': { min: 1, max: 6, name: '6-sided dice 🎲' },
      'D10': { min: 1, max: 10, name: '10-sided dice 🔟' },
      'D20': { min: 1, max: 20, name: '20-sided dice 🎯' },
      'D100': { min: 1, max: 100, name: '100-sided dice 💯' }
    };
    return configs[diceType] || configs['D6'];
  }

  // Start a new game
  async startGame(groupId, groupName, diceType, randomnessMethod) {
    // Check if there's already an active game
    if (this.activeGames.has(groupId)) {
      return { error: 'A game is already in progress in this group!' };
    }

    // Validate dice type
    const diceConfig = this.getDiceConfig(diceType);
    
    // Create game in database
    const { data: game, error } = await supabase
      .from('games')
      .insert({
        group_id: groupId,
        group_name: groupName,
        dice_type: diceType,
        randomness_method: randomnessMethod,
        status: 'waiting',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error(`Error creating game: ${error.message}`);
      return { error: 'Failed to create game' };
    }

    // Store in active games
    this.activeGames.set(groupId, {
      gameId: game.id,
      diceType,
      randomnessMethod,
      diceConfig,
      players: [],
      pot: { SOL: 0, USDC: 0 }
    });

    logger.info(`🎲 Game ${game.id} started in group ${groupId} with ${diceType} (${randomnessMethod})`);

    return { success: true, game };
  }

  // Join a game
  async joinGame(groupId, userId, username, amount, token, chosenNumber) {
    const gameData = this.activeGames.get(groupId);
    
    if (!gameData) {
      return { error: 'No active game in this group! Use /startgame first.' };
    }

    // Validate number is within dice range
    const { min, max } = gameData.diceConfig;
    if (chosenNumber < min || chosenNumber > max) {
      return { error: `Choose a number between ${min} and ${max}` };
    }

    // Check if user already joined
    if (gameData.players.some(p => p.userId === userId)) {
      return { error: 'You already joined this game!' };
    }

    // Get user's wallet and check balance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!wallet) {
      return { error: 'Wallet not found! Use /start first.' };
    }

    const balance = token === 'SOL' ? wallet.sol_balance : wallet.usdc_balance;
    if (balance < amount) {
      return { error: `Insufficient ${token} balance. You have ${balance} ${token}` };
    }

    // Create bet in database
    const { data: bet, error } = await supabase
      .from('bets')
      .insert({
        game_id: gameData.gameId,
        user_id: userId,
        chosen_number: chosenNumber,
        stake_amount: amount,
        token: token
      })
      .select()
      .single();

    if (error) {
      logger.error(`Error creating bet: ${error.message}`);
      return { error: 'Failed to place bet' };
    }

    // Deduct balance from wallet
    const newBalance = balance - amount;
    const updateField = token === 'SOL' ? 'sol_balance' : 'usdc_balance';
    await supabase
      .from('wallets')
      .update({ [updateField]: newBalance })
      .eq('user_id', userId);

    // Add player to game
    gameData.players.push({
      userId,
      username,
      amount,
      token,
      chosenNumber,
      betId: bet.id
    });

    // Update pot
    gameData.pot[token] += amount;

    // Update game in database
    await supabase
      .from('games')
      .update({
        num_players: gameData.players.length,
        pot_sol: gameData.pot.SOL,
        pot_usdc: gameData.pot.USDC
      })
      .eq('id', gameData.gameId);

    logger.info(`💰 ${username} joined game ${gameData.gameId} with ${amount} ${token} on number ${chosenNumber}`);

    return { success: true, bet };
  }

  // Calculate winners
  calculateWinners(players, diceResult) {
    // Calculate distance for each player
    const playersWithDistance = players.map(player => ({
      ...player,
      distance: Math.abs(player.chosenNumber - diceResult)
    }));

    // Find minimum distance
    const minDistance = Math.min(...playersWithDistance.map(p => p.distance));

    // Get all winners with minimum distance
    const winners = playersWithDistance.filter(p => p.distance === minDistance);

    return winners;
  }

  // Roll dice and finish game
  async rollDice(groupId, diceResult) {
    const gameData = this.activeGames.get(groupId);
    
    if (!gameData) {
      return { error: 'No active game found' };
    }

    if (gameData.players.length === 0) {
      await this.cancelGame(groupId);
      return { error: 'No players in game! Game cancelled.' };
    }

    // Update game status
    await supabase
      .from('games')
      .update({ status: 'rolling' })
      .eq('id', gameData.gameId);

    // Calculate winners
    const winners = this.calculateWinners(gameData.players, diceResult);

    // Calculate house fee (2%)
    const houseFeePercent = parseFloat(process.env.HOUSE_FEE_PERCENT || 2) / 100;
    const houseFeeSOL = gameData.pot.SOL * houseFeePercent;
    const houseFeeUSDC = gameData.pot.USDC * houseFeePercent;

    // Calculate payout per winner
    const payoutSOL = (gameData.pot.SOL - houseFeeSOL) / winners.length;
    const payoutUSDC = (gameData.pot.USDC - houseFeeUSDC) / winners.length;

    // Update winners' balances and bet records
    for (const winner of winners) {
      const payout = winner.token === 'SOL' ? payoutSOL : payoutUSDC;
      
      // Update bet record
      await supabase
        .from('bets')
        .update({
          won: true,
          payout: payout,
          distance_from_result: winner.distance
        })
        .eq('id', winner.betId);

      // Update wallet balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', winner.userId)
        .single();

      if (wallet) {
        const updateField = winner.token === 'SOL' ? 'sol_balance' : 'usdc_balance';
        const currentBalance = winner.token === 'SOL' ? wallet.sol_balance : wallet.usdc_balance;
        const newBalance = parseFloat(currentBalance) + payout;

        await supabase
          .from('wallets')
          .update({ [updateField]: newBalance })
          .eq('user_id', winner.userId);
      }

      // Update user stats
      await supabase
        .from('users')
        .update({
          total_games: supabase.sql`total_games + 1`,
          total_wins: supabase.sql`total_wins + 1`,
          [`total_won_${winner.token.toLowerCase()}`]: supabase.sql`total_won_${winner.token.toLowerCase()} + ${payout}`
        })
        .eq('id', winner.userId);
    }

    // Update losers
    const losers = gameData.players.filter(p => !winners.find(w => w.userId === p.userId));
    for (const loser of losers) {
      await supabase
        .from('bets')
        .update({
          won: false,
          distance_from_result: Math.abs(loser.chosenNumber - diceResult)
        })
        .eq('id', loser.betId);

      // Update user stats
      await supabase
        .from('users')
        .update({
          total_games: supabase.sql`total_games + 1`,
          [`total_wagered_${loser.token.toLowerCase()}`]: supabase.sql`total_wagered_${loser.token.toLowerCase()} + ${loser.amount}`
        })
        .eq('id', loser.userId);
    }

    // Finalize game
    await supabase
      .from('games')
      .update({
        status: 'finished',
        dice_result: diceResult,
        winner_ids: winners.map(w => w.userId),
        house_fee_sol: houseFeeSOL,
        house_fee_usdc: houseFeeUSDC,
        finished_at: new Date().toISOString()
      })
      .eq('id', gameData.gameId);

    // Clean up
    this.activeGames.delete(groupId);
    if (this.gameTimers.has(groupId)) {
      clearTimeout(this.gameTimers.get(groupId));
      this.gameTimers.delete(groupId);
    }

    logger.info(`🎉 Game ${gameData.gameId} finished! Result: ${diceResult}, Winners: ${winners.length}`);

    return {
      success: true,
      diceResult,
      winners,
      payoutSOL,
      payoutUSDC,
      totalPlayers: gameData.players.length,
      pot: gameData.pot
    };
  }

  // Cancel game
  async cancelGame(groupId) {
    const gameData = this.activeGames.get(groupId);
    if (!gameData) return;

    // Refund all players
    for (const player of gameData.players) {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', player.userId)
        .single();

      if (wallet) {
        const updateField = player.token === 'SOL' ? 'sol_balance' : 'usdc_balance';
        const currentBalance = player.token === 'SOL' ? wallet.sol_balance : wallet.usdc_balance;
        const newBalance = parseFloat(currentBalance) + player.amount;

        await supabase
          .from('wallets')
          .update({ [updateField]: newBalance })
          .eq('user_id', player.userId);
      }
    }

    // Update game status
    await supabase
      .from('games')
      .update({
        status: 'cancelled',
        finished_at: new Date().toISOString()
      })
      .eq('id', gameData.gameId);

    // Clean up
    this.activeGames.delete(groupId);
    if (this.gameTimers.has(groupId)) {
      clearTimeout(this.gameTimers.get(groupId));
      this.gameTimers.delete(groupId);
    }

    logger.info(`❌ Game ${gameData.gameId} cancelled`);
  }

  // Get active game
  getActiveGame(groupId) {
    return this.activeGames.get(groupId);
  }

  // Get pot info
  getPotInfo(groupId) {
    const gameData = this.activeGames.get(groupId);
    if (!gameData) return null;

    return {
      pot: gameData.pot,
      players: gameData.players.length,
      diceType: gameData.diceType
    };
  }
}

export default GameManager;


