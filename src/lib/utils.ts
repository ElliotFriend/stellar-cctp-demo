export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Truncate a long address-like string for display. Works for any opaque
// identifier: Stellar G-/C-addresses (56 chars), Solana base58 pubkeys (44),
// EVM 0x-addresses (42), transaction hashes (64-66).
//
// `head` and `tail` count *meaningful* characters, so a leading `0x` is paid
// for on top of the budget rather than out of it. Without that, the same 6/6
// call renders 6+6 for a Stellar address but only 4+6 for an EVM one, which
// looks lopsided and shows less of the part that actually distinguishes two
// addresses. Every caller can therefore use the defaults.
export function shortAddr(addr: string, head = 6, tail = 6): string {
    const prefix = addr.startsWith('0x') ? 2 : 0;
    if (addr.length <= prefix + head + tail + 1) return addr;
    return `${addr.slice(0, prefix + head)}…${addr.slice(-tail)}`;
}
