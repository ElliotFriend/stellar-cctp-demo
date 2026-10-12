import { createSolanaRpc } from '@solana/kit';
import { SOLANA } from '#lib/config.js';

// Solana JSON-RPC client for the configured cluster. Balance reads go
// through this, not through the wallet, so Phantom's own cluster selection can't cause a wrong-network read.
export const solanaRpc = createSolanaRpc(SOLANA.rpcUrl);
