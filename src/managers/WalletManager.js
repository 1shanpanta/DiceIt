import { Connection, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import supabase from '../lib/supabase.js';
import { authenticatedSolanaClient, ThresholdSignatureScheme } from '../lib/dynamic.js';
import dotenv from 'dotenv';

dotenv.config();

class WalletManager {
  constructor() {
    this.solanaConnection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
    this.usdcMintAddress = new PublicKey(process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
    this.solanaClient = null;
  }

  async initializeDynamicClient() {
    if (!this.solanaClient) {
      this.solanaClient = await authenticatedSolanaClient();
    }
  }

  async createUserWallet(userId, telegramId, username) {
    await this.initializeDynamicClient();

    // Create Solana wallet via Dynamic.xyz
    const solanaWallet = await this.solanaClient.createWalletAccount({
      thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
      password: `user_${userId}_solana_${telegramId}`,
      onError: (error) => {
        console.error("Solana wallet creation error:", error);
      },
      backUpToClientShareService: true,
    });

    // Store wallet address and Dynamic ID in Supabase
    await this.storeWallet(userId, solanaWallet);

    return {
      address: solanaWallet.accountAddress,
      sol_balance: 0,
      usdc_balance: 0
    };
  }

  async storeWallet(userId, solanaWallet) {
    const { error } = await supabase
      .from('wallets')
      .insert({
        user_id: userId,
        chain: 'solana',
        address: solanaWallet.accountAddress,
        dynamic_wallet_id: solanaWallet.accountId || solanaWallet.accountAddress,
        sol_balance: 0,
        usdc_balance: 0
      });

    if (error) {
      console.error('Error storing Solana wallet:', error);
      throw new Error('Failed to store Solana wallet');
    }
  }

  async getWallet(userId) {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .eq('chain', 'solana')
      .single();

    if (error) {
      console.error(`Error getting wallet:`, error);
      return null;
    }
    return data;
  }

  async getSolBalance(address) {
    const publicKey = new PublicKey(address);
    const balance = await this.solanaConnection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  async getUSDCBalance(address) {
    const walletPublicKey = new PublicKey(address);
    const associatedTokenAddress = await getAssociatedTokenAddress(
      this.usdcMintAddress,
      walletPublicKey
    );

    const accountInfo = await this.solanaConnection.getAccountInfo(associatedTokenAddress);
    if (!accountInfo) {
      return 0;
    }

    const tokenAccount = await getAccount(
      this.solanaConnection,
      associatedTokenAddress
    );

    return Number(tokenAccount.amount) / 1e6; // USDC has 6 decimals
  }

  async updateBalance(userId, solBalance, usdcBalance) {
    const { error } = await supabase
      .from('wallets')
      .update({
        sol_balance: solBalance,
        usdc_balance: usdcBalance,
        last_balance_update: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('chain', 'solana');

    if (error) {
      console.error(`Error updating balance:`, error);
    }
  }

  async refreshBalance(userId) {
    const wallet = await this.getWallet(userId);
    if (!wallet) return null;

    const solBalance = await this.getSolBalance(wallet.address);
    const usdcBalance = await this.getUSDCBalance(wallet.address);

    await this.updateBalance(userId, solBalance, usdcBalance);

    return { solBalance, usdcBalance };
  }
}

export default WalletManager;
