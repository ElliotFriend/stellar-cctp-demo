import * as env from '$app/env/public';
import { defineChain, type Chain } from 'viem';
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';

// Which network this build talks to. Everything that differs between testnet
// and mainnet comes from `.env.testnet` / `.env.mainnet` (declared in
// `src/env.ts`); everything below that isn't read from `env` is the same on both.
export const NETWORK = env.PUBLIC_NETWORK;
export const IS_MAINNET = NETWORK === 'mainnet';

export const STELLAR = {
    label: IS_MAINNET ? 'Stellar Mainnet' : 'Stellar Testnet',
    networkPassphrase: env.PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    rpcUrl: env.PUBLIC_STELLAR_RPC_URL,
    domain: 27,
    explorer: env.PUBLIC_STELLAR_EXPLORER,
    contracts: {
        tokenMessengerMinter: env.PUBLIC_STELLAR_TOKEN_MESSENGER_MINTER,
        messageTransmitter: env.PUBLIC_STELLAR_MESSAGE_TRANSMITTER,
        cctpForwarder: env.PUBLIC_STELLAR_CCTP_FORWARDER,
        usdc: env.PUBLIC_STELLAR_USDC_CONTRACT,
        // User-deployed wrapper that bundles approve + deposit_for_burn into
        // one atomic invocation, signed in a single Freighter prompt. Undefined
        // on networks where it isn't deployed (the outbound flow is then two-tx).
        bridgeWrapper: env.PUBLIC_STELLAR_BRIDGE_WRAPPER,
    },
    usdc: {
        code: 'USDC',
        issuer: env.PUBLIC_STELLAR_USDC_ISSUER,
        decimals: 7,
    },
} as const;

// Solana CCTP V2. Program IDs are deterministic (identical on devnet and
// mainnet), so only the cluster + USDC mint differ. Domain 5. This demo only
// bridges Solana <-> Stellar, so Solana is both a burn source and a mint
// destination but never pairs with the EVM chains.
export const SOLANA = {
    label: IS_MAINNET ? 'Mainnet' : 'Devnet',
    cluster: env.PUBLIC_SOLANA_CLUSTER,
    rpcUrl: env.PUBLIC_SOLANA_RPC_URL,
    domain: 5,
    explorer: 'https://explorer.solana.com',
    programs: {
        messageTransmitterV2: 'CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC',
        tokenMessengerMinterV2: 'CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe',
    },
    usdc: {
        mint: env.PUBLIC_SOLANA_USDC_MINT,
        decimals: 6,
    },
} as const;

// Solana Explorer defaults to mainnet-beta, so only other clusters need the
// query string.
export const solanaTxUrl = (signature: string) =>
    SOLANA.cluster === 'mainnet-beta'
        ? `${SOLANA.explorer}/tx/${signature}`
        : `${SOLANA.explorer}/tx/${signature}?cluster=${SOLANA.cluster}`;

// CCTP V2 deploys to the same addresses on every supported EVM chain via
// deterministic deployment, so one pair covers all of them. Testnets and
// mainnets use different pairs.
export const EVM_CCTP_CONTRACTS = {
    tokenMessengerV2: env.PUBLIC_EVM_TOKEN_MESSENGER_V2 as `0x${string}`,
    messageTransmitterV2: env.PUBLIC_EVM_MESSAGE_TRANSMITTER_V2 as `0x${string}`,
} as const;

// Arc is Circle's L1: EVM-compatible, ~2s blocks, gas paid in USDC, finality
// expected to be much faster than rollups (no L1 settlement dependency).
export const arcChain = defineChain({
    id: Number(env.PUBLIC_ARC_CHAIN_ID),
    name: IS_MAINNET ? 'Arc' : 'Arc Testnet',
    nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
    rpcUrls: { default: { http: [env.PUBLIC_ARC_RPC_URL] } },
    blockExplorers: { default: { name: 'Arc Explorer', url: env.PUBLIC_ARC_EXPLORER } },
    testnet: !IS_MAINNET,
});

// viem ships definitions (including default public RPCs) for Base and
// Ethereum, so the env files only pick which one by chain ID.
const KNOWN_CHAINS: Record<number, Chain> = Object.fromEntries(
    [base, baseSepolia, mainnet, sepolia].map((c) => [c.id, c]),
);
function knownChain(id: string): Chain {
    const chain = KNOWN_CHAINS[Number(id)];
    if (!chain) throw new Error(`No viem chain definition for chain ID ${id}`);
    return chain;
}
const evmAddress = (value: string | undefined) => value as `0x${string}` | undefined;

export type EvmChainConfig = {
    id: 'arc' | 'base' | 'ethereum';
    label: string;
    chain: Chain;
    domain: number;
    explorer: string;
    usdc: `0x${string}`;
    usdcDecimals: number;
    gasNote: string;
    /**
     * Approximate Circle attestation wait when this chain is the SOURCE of a
     * burn. Undefined means "fast enough that a wait UI isn't needed."
     */
    attestationEtaMs?: number;
    /**
     * User-deployed CctpWrapper contract. When present, the EVM→Stellar flow
     * can take the single-signature permit path instead of approve + burn.
     */
    bridgeWrapper?: `0x${string}`;
};

export const EVM_CHAINS: Record<'arc' | 'base' | 'ethereum', EvmChainConfig> = {
    arc: {
        id: 'arc',
        label: arcChain.name,
        chain: arcChain,
        domain: 26,
        explorer: env.PUBLIC_ARC_EXPLORER,
        usdc: env.PUBLIC_ARC_USDC as `0x${string}`,
        usdcDecimals: 6,
        gasNote: 'Gas paid in USDC.',
        bridgeWrapper: evmAddress(env.PUBLIC_ARC_BRIDGE_WRAPPER), // deployed from contracts/evm/cctp-wrapper
    },
    base: {
        id: 'base',
        label: IS_MAINNET ? 'Base' : 'Base Sepolia',
        chain: knownChain(env.PUBLIC_BASE_CHAIN_ID),
        domain: 6,
        explorer: env.PUBLIC_BASE_EXPLORER,
        usdc: env.PUBLIC_BASE_USDC as `0x${string}`,
        usdcDecimals: 6,
        gasNote: 'Gas paid in ETH.',
        attestationEtaMs: 15 * 60_000,
        bridgeWrapper: evmAddress(env.PUBLIC_BASE_BRIDGE_WRAPPER), // deployed from contracts/evm/cctp-wrapper
    },
    ethereum: {
        id: 'ethereum',
        label: IS_MAINNET ? 'Ethereum' : 'Ethereum Sepolia',
        chain: knownChain(env.PUBLIC_ETHEREUM_CHAIN_ID),
        domain: 0,
        explorer: env.PUBLIC_ETHEREUM_EXPLORER,
        usdc: env.PUBLIC_ETHEREUM_USDC as `0x${string}`,
        usdcDecimals: 6,
        gasNote: 'Gas paid in ETH.',
        // Ethereum L1 finality is the slowest of the demo chains for a Standard
        // (finalized) transfer. Without a CctpWrapper on a chain, the EVM→Stellar
        // permit / send-calls flows fall back to two-tx.
        attestationEtaMs: 19 * 60_000,
        bridgeWrapper: evmAddress(env.PUBLIC_ETHEREUM_BRIDGE_WRAPPER),
    },
};

export type EvmChainId = keyof typeof EVM_CHAINS;
export const DEFAULT_EVM_CHAIN: EvmChainId = 'arc';

export const IRIS_API = env.PUBLIC_IRIS_API;

// CCTP V2 finality thresholds for the burn.
//   STANDARD (2000) = wait for source-chain finality (~13 min on L2s,
//                     seconds on Arc). minimumFee is 0.
//   FAST     (1000) = mint before finality; Circle charges a fast fee
//                     (basis points of the amount) bounded by max_fee.
export const STANDARD_THRESHOLD = 2000;
export const FAST_THRESHOLD = 1000;

export type TransferSpeed = 'standard' | 'fast';
export const DEFAULT_SPEED: TransferSpeed = 'standard';

// Defensive max_fee buffers. The burn reverts with InsufficientMaxFee
// (#7105) if Circle's configured min_fee for the burn token exceeds this.
// Today min_fee is 0 on all CCTP V2 deployments; non-zero buffers match
// Circle's quickstart and leave headroom if Circle starts charging.
//
// Units differ by chain:
//   - STELLAR_MAX_FEE is in 7-decimal Stellar USDC subunits.
//       100_000  =  $0.01
//   - EVM_MAX_FEE is in the canonical 6-decimal CCTP unit (same as USDC
//     on every EVM chain).
//       500      =  $0.0005
export const STELLAR_MAX_FEE = 100_000n;
export const EVM_MAX_FEE = 500n;
// Solana USDC is 6-dp like EVM, so the same 500n (≈ $0.0005) buffer applies.
export const SOLANA_MAX_FEE = 500n;

// ─────────────────────────────────────────────────────────────────────
//  Direction vocabulary (used consistently across this repo)
// ─────────────────────────────────────────────────────────────────────
// Two orthogonal axes, and mixing them is what makes this confusing:
//
//  1. Route, relative to Stellar. `outbound` leaves Stellar (Stellar burns),
//     `inbound` arrives on Stellar (Stellar mints). Only meaningful because
//     Stellar is this repo's fixed vantage point, so never use these two words
//     in a sentence that isn't about Stellar.
//  2. Role within a single transfer. `source` and `destination`, chain-neutral,
//     matching CCTP's own field names (sourceDomain, destinationDomain). Attach
//     a chain with a clause ("when Stellar is the destination"), not a compound
//     ("Stellar-destination").
//
// `Direction` below is the third, fully explicit level: the concrete pair, used
// as a machine identifier where neither shorthand is wanted.
export type Direction =
    'stellar-to-evm' | 'evm-to-stellar' | 'solana-to-stellar' | 'stellar-to-solana';

// The right-side chain in the main-page selector: an EVM chain or Solana.
export type RightChain = EvmChainId | 'solana';

// On the Stellar→EVM side the user picks a transaction shape:
//  - 'wrapper'  : one Soroban tx via the bridge wrapper contract (combined
//                 approve + deposit_for_burn under one Freighter prompt)
//  - 'two-tx'   : separate `approve` and `deposit_for_burn` invocations,
//                 same as plain CCTP without the wrapper
// Mostly here so the demo can show the flows side-by-side.
export type OutboundFlow = 'wrapper' | 'two-tx';
// Default to the plain CCTP path so the demo opens on the typical
// `approve` → `deposit_for_burn` experience. Users can flip to the
// wrapper-contract flow from the StellarPanel toggle.
export const DEFAULT_OUTBOUND_FLOW: OutboundFlow = 'two-tx';

// Orthogonal to OutboundFlow: whether to tag the burn with the Circle
// Crosschain Forwarding Service magic hookData. When on, both the wrapper and
// two-tx shapes route through the *_with_hook variant so Circle's hosted relayer
// auto-mints on the EVM destination (Stellar is not a documented forwarding
// source; destination_caller stays zero so a manual mint can still recover the
// funds if the relayer ignores it). EXPERIMENTAL.
export const DEFAULT_FORWARDING = false;

// EVM→Stellar mirror of OutboundFlow. Values:
//   'two-tx'     plain CCTP: approve, then depositForBurnWithHook.
//   'wrapper'    CctpWrapper: EIP-2612 permit + bundled depositForBurnWithHook
//                in one user-submitted tx.
//   'send-calls' EIP-5792 wallet_sendCalls: the WALLET bundles approve +
//                depositForBurnWithHook into a single user confirmation. May
//                run atomically (smart wallets, EIP-7702) or sequentially.
export type InboundFlow = 'wrapper' | 'two-tx' | 'send-calls';
export const DEFAULT_INBOUND_FLOW: InboundFlow = 'two-tx';
