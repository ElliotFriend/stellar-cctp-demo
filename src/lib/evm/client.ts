import { createPublicClient, http, type PublicClient } from 'viem';
import { EVM_CHAINS, type EvmChainId } from '$lib/config';

const cache = new Map<EvmChainId, PublicClient>();

// Arc's testnet RPC intermittently fails the CORS preflight. The same OPTIONS
// request usually gets 200 with `access-control-allow-origin`, but every so
// often it falls through to the node itself, which answers a bare JSON-RPC
// `invalid params` 400 with no CORS headers at all — and failures come in
// bursts, so viem's retries land on the same bad path and the read surfaces as
// `Failed to fetch`. Sending `text/plain` keeps the POST inside the CORS
// "simple request" rules, so the browser issues no preflight and the broken
// OPTIONS path is never touched. Arc's node ignores the request content type
// and still replies `application/json`, which is what viem parses coming back.
const NO_PREFLIGHT_HEADERS = { 'Content-Type': 'text/plain;charset=UTF-8' };

// Arc's RPC also caps in-flight requests per IP at about four and answers the
// rest with a 429 that carries no `retry-after`. Arc supports JSON-RPC batching,
// so coalescing everything issued within a short window into one array request
// keeps us under the cap no matter how many reads a panel fires at once. The
// window is short enough to stay invisible; the cost is shared fate, since a
// single 429 now fails every call merged into that batch.
const ARC_BATCH = { wait: 16 };

export function getPublicClient(chainId: EvmChainId): PublicClient {
    const cached = cache.get(chainId);
    if (cached) return cached;
    const cfg = EVM_CHAINS[chainId];
    const isArc = chainId === 'arc';
    const client = createPublicClient({
        chain: cfg.chain,
        transport: http(undefined, {
            fetchOptions: isArc ? { headers: NO_PREFLIGHT_HEADERS } : undefined,
            batch: isArc ? ARC_BATCH : undefined,
        }),
    }) as PublicClient;
    cache.set(chainId, client);
    return client;
}
