import { DynamicSvmWalletClient } from '@dynamic-labs-wallet/node-svm';
import { ThresholdSignatureScheme } from '@dynamic-labs-wallet/core';

/**
 * Create authenticated Dynamic Solana client
 */
export const authenticatedSolanaClient = async () => {
  if (!process.env.DYNAMIC_AUTH_TOKEN || !process.env.DYNAMIC_ENV_ID) {
    throw new Error("Missing DYNAMIC_AUTH_TOKEN or DYNAMIC_ENV_ID environment variables");
  }

  const client = new DynamicSvmWalletClient({
    authToken: process.env.DYNAMIC_AUTH_TOKEN,
    environmentId: process.env.DYNAMIC_ENV_ID,
  });

  await client.authenticateApiToken(process.env.DYNAMIC_AUTH_TOKEN);
  return client;
};

export { ThresholdSignatureScheme };


