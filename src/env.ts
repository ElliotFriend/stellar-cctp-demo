import { defineEnvVars } from '@sveltejs/kit/env';

// Every value that differs between testnet and mainnet. Pick a network with
// Vite's `--mode` flag, which loads `.env.testnet` or `.env.mainnet` (see the
// `dev`, `dev:mainnet`, `build`, and `build:mainnet` scripts). All of these are
// public addresses and URLs, so they're inlined into the bundle at build time.

const required = (value: string | undefined) => {
    if (!value) throw new Error('missing; check .env.testnet / .env.mainnet');
    return value;
};
// Empty means "not deployed on this network".
const optional = (value: string | undefined) => value || undefined;

const pub = { public: true, static: true } as const;
const req = { ...pub, schema: required };
const opt = { ...pub, schema: optional };

export const variables = defineEnvVars({
    PUBLIC_NETWORK: {
        ...pub,
        description: '`testnet` or `mainnet`',
        schema: (value: string | undefined) => {
            if (value !== 'testnet' && value !== 'mainnet') {
                throw new Error(`expected testnet or mainnet, got "${value}"`);
            }
            return value;
        },
    },

    // Circle attestation service
    PUBLIC_IRIS_API: req,

    // Stellar
    PUBLIC_STELLAR_NETWORK_PASSPHRASE: req,
    PUBLIC_STELLAR_RPC_URL: req,
    PUBLIC_STELLAR_EXPLORER: req,
    PUBLIC_STELLAR_TOKEN_MESSENGER_MINTER: req,
    PUBLIC_STELLAR_MESSAGE_TRANSMITTER: req,
    PUBLIC_STELLAR_CCTP_FORWARDER: req,
    PUBLIC_STELLAR_USDC_CONTRACT: req,
    PUBLIC_STELLAR_USDC_ISSUER: req,
    PUBLIC_STELLAR_BRIDGE_WRAPPER: opt,

    // EVM (CCTP V2 shares one address pair across every EVM chain per network)
    PUBLIC_EVM_TOKEN_MESSENGER_V2: req,
    PUBLIC_EVM_MESSAGE_TRANSMITTER_V2: req,

    PUBLIC_ARC_CHAIN_ID: req,
    PUBLIC_ARC_RPC_URL: req,
    PUBLIC_ARC_EXPLORER: req,
    PUBLIC_ARC_USDC: req,
    PUBLIC_ARC_BRIDGE_WRAPPER: opt,

    PUBLIC_BASE_CHAIN_ID: req,
    PUBLIC_BASE_EXPLORER: req,
    PUBLIC_BASE_USDC: req,
    PUBLIC_BASE_BRIDGE_WRAPPER: opt,

    PUBLIC_ETHEREUM_CHAIN_ID: req,
    PUBLIC_ETHEREUM_EXPLORER: req,
    PUBLIC_ETHEREUM_USDC: req,
    PUBLIC_ETHEREUM_BRIDGE_WRAPPER: opt,

    // Solana (program IDs are the same on every cluster, so they stay in config.ts)
    PUBLIC_SOLANA_CLUSTER: req,
    PUBLIC_SOLANA_RPC_URL: req,
    PUBLIC_SOLANA_USDC_MINT: req,
});
