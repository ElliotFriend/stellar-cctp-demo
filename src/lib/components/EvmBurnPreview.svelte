<script lang="ts">
    import {
        EVM_CCTP_CONTRACTS,
        EVM_CHAINS,
        EVM_MAX_FEE,
        STELLAR,
        type EvmChainId,
        type InboundFlow,
        type TransferSpeed,
    } from '$lib/config';
    import { fetchBurnFee, feeBpsFor, thresholdFor, computeMaxFee } from '$lib/circle/fees';
    import { encodeStellarForwarderHookData, strkeyToBytes32 } from '$lib/stellar/recipient';
    import {
        fetchUsdcEip712Domain,
        formatEvmUsdc,
        parseEvmUsdc,
        type EvmUsdcEip712Domain,
    } from '$lib/evm/usdc';
    import type { SendCallsCapability } from '$lib/evm/capabilities';
    import { shortAddr } from '$lib/utils';
    import ContractArg from '$lib/components/ui/ContractArg.svelte';

    let {
        evmAddress,
        evmChainId,
        stellarRecipient,
        amount,
        inboundFlow,
        sendCallsCap,
        speed,
    }: {
        evmAddress: `0x${string}`;
        evmChainId: EvmChainId;
        stellarRecipient: string;
        amount: string;
        inboundFlow: InboundFlow;
        sendCallsCap: SendCallsCapability;
        speed: TransferSpeed;
    } = $props();

    let cfg = $derived(EVM_CHAINS[evmChainId]);

    // Route-keyed fee promise, re-runs when evmChainId changes, NOT per keystroke.
    let srcDomain = $derived(EVM_CHAINS[evmChainId].domain);
    let feePromise = $derived(fetchBurnFee(srcDomain, STELLAR.domain));
    let threshold = $derived(thresholdFor(speed));

    type Parsed = { ok: true; raw: bigint } | { ok: false };

    // parseEvmUsdc throws on invalid input; surface as a typed result so the
    // template can show a placeholder for empty/invalid values without
    // rendering an error.
    let parsedAmount = $derived<Parsed>(
        (() => {
            const trimmed = amount.trim();
            if (trimmed === '') return { ok: false };
            try {
                return { ok: true, raw: parseEvmUsdc(evmChainId, trimmed) };
            } catch {
                return { ok: false };
            }
        })(),
    );

    // bytes32-padded forwarder address. The same value goes into BOTH
    // `mintRecipient` and `destinationCaller`. CCTPv2 uses the raw 32-byte
    // pubkey, not the strkey string.
    let forwarderBytes32 = $derived(strkeyToBytes32(STELLAR.contracts.cctpForwarder));

    // hookData encoding: 24 zero bytes + uint32 version + uint32 length + UTF-8
    // strkey. Validated in encodeStellarForwarderHookData; we wrap with a typed
    // result here too so an invalid recipient surfaces inline.
    type Hookdata = { ok: true; hex: string } | { ok: false; error: string };
    let hookData = $derived<Hookdata>(
        (() => {
            try {
                return { ok: true, hex: encodeStellarForwarderHookData(stellarRecipient) };
            } catch (err) {
                return { ok: false, error: err instanceof Error ? err.message : String(err) };
            }
        })(),
    );

    let isWrapper = $derived(inboundFlow === 'wrapper');
    let isSendCalls = $derived(inboundFlow === 'send-calls');

    let contractAddress = $derived(
        isWrapper ? cfg.bridgeWrapper : EVM_CCTP_CONTRACTS.tokenMessengerV2,
    );
    let contractLabel = $derived(isWrapper ? 'CctpWrapper (user-deployed)' : 'TokenMessengerV2');
    let functionName = $derived(isWrapper ? 'bridgeWithPermit' : 'depositForBurnWithHook');

    // Memoized EIP-712 domain fetch per chain. The (name, version) pair is
    // immutable for a deployed FiatToken proxy so we read once per chain and
    // share across instances. Re-runs only when evmChainId changes (the
    // {#await} block in the template keys on the returned Promise identity).
    // Plain object cache to keep this non-reactive. Svelte's SvelteMap would
    // also work but adds reactivity we don't need for a pure memo.
    const domainCache: Partial<Record<EvmChainId, Promise<EvmUsdcEip712Domain>>> = {};
    function getDomain(chainId: EvmChainId): Promise<EvmUsdcEip712Domain> {
        let p = domainCache[chainId];
        if (!p) {
            p = fetchUsdcEip712Domain(chainId);
            domainCache[chainId] = p;
        }
        return p;
    }

    // Row props for the amount, which appears three times with different notes:
    // the burn argument, the permit `value`, and the bundled `approve` amount.
    let amountArg = $derived(
        parsedAmount.ok
            ? {
                  value: parsedAmount.raw.toString(),
                  note: `${formatEvmUsdc(evmChainId, parsedAmount.raw)} USDC (canonical 6 decimals)`,
              }
            : { placeholder: 'Enter an amount above' },
    );

    let hookDataArg = $derived(
        hookData.ok
            ? {
                  value: hookData.hex,
                  note: "The forwarder's routing payload. The hook data preview below breaks it down byte by byte.",
              }
            : { placeholder: hookData.error },
    );

    let maxFeeArg = $derived.by(async () => {
        // Read every reactive dependency up front: anything read after an `await`
        // in an async $derived.by body is NOT tracked, so it would go stale.
        // `speed` really does toggle on this side, so this matters.
        const currentSpeed = speed;
        const amount = parsedAmount.ok ? parsedAmount.raw : 0n;
        const burnFees = feePromise;

        try {
            const bps = feeBpsFor(await burnFees, currentSpeed);
            return {
                value: computeMaxFee(amount, bps, EVM_MAX_FEE).toString(),
                note:
                    bps > 0
                        ? `${bps} bps fast fee on top of the floor, in canonical 6-decimal units.`
                        : 'Floor only (this speed carries no fee), in canonical 6-decimal units.',
            };
        } catch {
            return {
                value: EVM_MAX_FEE.toString(),
                note: "Floor only (the fee API didn't answer), in canonical 6-decimal units.",
            };
        }
    });
</script>

<section class="burn-preview">
    <header class="head">
        <h4 class="title">Burn invocation preview</h4>
        <span class="sub">
            What you're about to sign in MetaMask, decoded into human-readable args.
        </span>
    </header>

    <div class="meta">
        <div class="meta-row">
            <span class="meta-label">Contract</span>
            <code class="meta-value" title={contractAddress ?? ''}>
                {contractAddress ? shortAddr(contractAddress) : 'n/a'}
            </code>
            <span class="meta-aside">{contractLabel}</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Function</span>
            <code class="meta-value">{functionName}</code>
        </div>
        <div class="meta-row">
            <span class="meta-label">Caller</span>
            <code class="meta-value" title={evmAddress}>{shortAddr(evmAddress)}</code>
            <span class="meta-aside">
                The <code>msg.sender</code>. Your EVM wallet pays the gas, and in the wrapper flow
                it is also the permit <code>owner</code>.
            </span>
        </div>
    </div>

    {#if isWrapper}
        <p class="flow-note">
            Wrapper flow: one EIP-712 signature (off-chain, so no gas) plus one transaction. The
            wrapper runs <code>usdc.permit → transferFrom → approve → depositForBurnWithHook</code>
            atomically.
        </p>
    {:else if isSendCalls}
        <p class="flow-note">
            Batched flow: the wallet bundles <code>usdc.approve(...)</code> and
            <code>depositForBurnWithHook(...)</code> behind one confirmation using EIP-5792's
            <code>wallet_sendCalls</code>.
            {#if sendCallsCap.atomic}
                Your wallet reports <strong>atomic</strong> execution, so this lands as one on-chain transaction.
            {:else if sendCallsCap.supported}
                Your wallet reports <strong>sequential</strong> execution, so you get one prompt and two
                on-chain transactions.
            {:else}
                Your wallet doesn't advertise this capability on this chain, so your mileage may
                vary.
            {/if}
        </p>
    {:else}
        <p class="flow-note">
            Two-transaction flow: a separate <code>usdc.approve(...)</code> goes first, and it's skipped
            when your existing allowance already covers the amount.
        </p>
    {/if}

    {#if isWrapper}
        <details class="signed-block" open>
            <summary>EIP-712 permit signature (off-chain, so no gas)</summary>
            <div class="signed-body">
                <h6 class="block-section">Domain</h6>
                {#await getDomain(evmChainId)}
                    <p class="loading">Reading USDC name + version…</p>
                {:then domain}
                    <ul class="rows tight">
                        <ContractArg
                            name="name"
                            type="string"
                            value={`"${domain.name}"`}
                            note="read from usdc.name()"
                        />
                        <ContractArg
                            name="version"
                            type="string"
                            value={`"${domain.version}"`}
                            note="read from usdc.version()"
                        />
                        <ContractArg
                            name="chainId"
                            type="uint256"
                            value={domain.chainId.toString()}
                            note={cfg.label}
                        />
                        <ContractArg
                            name="verifyingContract"
                            type="address"
                            value={domain.verifyingContract}
                            note={`USDC on ${cfg.label}`}
                            truncate
                        />
                    </ul>
                {:catch err}
                    <p class="error">Couldn't read USDC domain: {err.message}</p>
                {/await}

                <h6 class="block-section">Permit message</h6>
                <ul class="rows tight">
                    <ContractArg
                        name="owner"
                        type="address"
                        value={evmAddress}
                        note="caller"
                        truncate
                    />
                    <ContractArg
                        name="spender"
                        type="address"
                        value={cfg.bridgeWrapper ?? 'n/a'}
                        note="CctpWrapper"
                        truncate={!!cfg.bridgeWrapper}
                    />
                    <ContractArg
                        name="value"
                        type="uint256"
                        {...amountArg}
                        note={parsedAmount.ok
                            ? `same as the burn amount (${formatEvmUsdc(evmChainId, parsedAmount.raw)} USDC)`
                            : undefined}
                    />
                    <ContractArg
                        name="nonce"
                        type="uint256"
                        placeholder="read at sign time from usdc.nonces(owner)"
                    />
                    <ContractArg
                        name="deadline"
                        type="uint256"
                        placeholder="set at sign time to now + 30 min"
                    />
                </ul>
            </div>
        </details>
    {/if}

    {#if isSendCalls}
        <details class="signed-block" open>
            <summary>
                wallet_sendCalls bundle
                <span class="badge {sendCallsCap.atomic ? 'atomic' : 'sequential'}">
                    {sendCallsCap.atomic
                        ? 'atomic'
                        : sendCallsCap.supported
                          ? 'sequential'
                          : 'unsupported'}
                </span>
            </summary>
            <div class="signed-body">
                <p class="block-blurb">
                    The wallet receives two encoded calls and routes them according to the
                    capabilities it reported. Receipts come back in the same order as the calls, so
                    the burn (call 2) is always the last receipt, and that's the hash we poll Iris
                    with for the attestation.
                </p>

                <div class="bundle-call">
                    <div class="bundle-head">
                        <span class="bundle-num">1</span>
                        <code class="bundle-target" title={cfg.usdc}>
                            {shortAddr(cfg.usdc)}
                        </code>
                        <span class="bundle-dot">·</span>
                        <code class="bundle-fn">approve</code>
                    </div>
                    <ul class="rows tight">
                        <ContractArg
                            name="spender"
                            type="address"
                            value={EVM_CCTP_CONTRACTS.tokenMessengerV2}
                            note="TokenMessengerV2"
                            truncate
                        />
                        <ContractArg
                            name="amount"
                            type="uint256"
                            {...amountArg}
                            note={parsedAmount.ok ? 'same as the burn amount' : undefined}
                        />
                    </ul>
                </div>

                <div class="bundle-call">
                    <div class="bundle-head">
                        <span class="bundle-num">2</span>
                        <code class="bundle-target" title={EVM_CCTP_CONTRACTS.tokenMessengerV2}>
                            {shortAddr(EVM_CCTP_CONTRACTS.tokenMessengerV2)}
                        </code>
                        <span class="bundle-dot">·</span>
                        <code class="bundle-fn">depositForBurnWithHook</code>
                    </div>
                    <p class="bundle-note">
                        The same eight-argument payload as the table below. The wallet just hands
                        that encoded calldata to the chain.
                    </p>
                </div>
            </div>
        </details>
    {/if}

    <h5 class="section-title">
        {isWrapper ? 'bridgeWithPermit arguments' : 'depositForBurnWithHook arguments'}
    </h5>
    <ul class="rows">
        <ContractArg name="amount" type="uint256" {...amountArg} />

        <ContractArg
            name="destinationDomain"
            type="uint32"
            value={STELLAR.domain.toString()}
            note="Stellar Testnet"
        />

        <ContractArg
            name="mintRecipient"
            type="bytes32"
            value={forwarderBytes32}
            note={`The CctpForwarder contract (${STELLAR.contracts.cctpForwarder}), which every inbound Stellar transfer has to mint to.`}
            hex
        />

        {#if !isWrapper}
            <ContractArg
                name="burnToken"
                type="address"
                value={cfg.usdc}
                note={`USDC on ${cfg.label}`}
                truncate
            />
        {/if}

        <ContractArg name="destinationCaller" type="bytes32" value={forwarderBytes32} hex>
            {#snippet note()}
                This one <em>must</em> match <code>mintRecipient</code>, since only the forwarder
                can call <code>mint_and_forward</code> on Stellar.
            {/snippet}
        </ContractArg>

        {#await maxFeeArg}
            <ContractArg name="maxFee" type="uint256" placeholder="Calculating maximum fee..." />
        {:then arg}
            <ContractArg name="maxFee" type="uint256" {...arg} />
        {/await}

        <ContractArg
            name="minFinalityThreshold"
            type="uint32"
            value={threshold.toString()}
            note={speed === 'fast'
                ? 'Fast Transfer, so Circle attests before finality.'
                : 'Standard, so Circle waits for source-chain finality.'}
        />

        <ContractArg name="hookData" type="bytes" hex {...hookDataArg} />

        {#if isWrapper}
            <ContractArg
                name="permitDeadline"
                type="uint256"
                placeholder="set at sign time to now + 30 min"
            />
            <ContractArg name="permitV" type="uint8" placeholder="27 or 28 (ECDSA recovery id)" />
            <ContractArg
                name="permitR"
                type="bytes32"
                placeholder="first 32 bytes of the signature"
            />
            <ContractArg
                name="permitS"
                type="bytes32"
                placeholder="middle 32 bytes of the signature"
            />
        {/if}
    </ul>
</section>

<style>
    .burn-preview {
        background: var(--bg-elev-2);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .head {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .title {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text);
    }

    .sub {
        font-size: 0.8rem;
        color: var(--text-muted);
        line-height: 1.4;
    }

    .meta {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.5rem 0.6rem;
        background: var(--bg);
        border-radius: var(--radius);
    }

    .meta-row {
        display: grid;
        grid-template-columns: max-content max-content minmax(0, 1fr);
        align-items: baseline;
        gap: 0.5rem;
    }

    .meta-label {
        font-size: 0.75rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .meta-value {
        font-family: var(--mono);
        font-size: 0.78rem;
        color: var(--text);
    }

    .meta-aside {
        font-size: 0.78rem;
        color: var(--text-muted);
        line-height: 1.4;
        overflow-wrap: anywhere;
    }

    .meta-aside code {
        font-family: var(--mono);
        color: var(--text);
    }

    .flow-note {
        margin: 0;
        font-size: 0.78rem;
        color: var(--text-muted);
        line-height: 1.4;
    }

    .flow-note code {
        font-family: var(--mono);
        font-size: 0.75rem;
        color: var(--text);
    }

    .flow-note strong {
        color: var(--text);
        font-weight: 600;
    }

    .section-title {
        margin: 0.2rem 0 0;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .rows {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    /* Denser rows inside the signature / bundle blocks. Custom properties are
       how the container reaches ContractArg: a `.rows.tight .row` selector
       can't, since the row's `<li>` carries ContractArg's scope hash. */
    .rows.tight {
        gap: 0.25rem;
        --arg-pad: 0.3rem 0.45rem;
        --arg-bg: var(--bg-elev-2);
    }

    .signed-block {
        margin-top: 0.25rem;
        background: var(--bg);
        border-radius: var(--radius);
        padding: 0.5rem 0.6rem;
        border-left: 2px solid var(--accent);
    }

    .signed-block summary {
        cursor: pointer;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text);
        list-style: none;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .signed-block summary::-webkit-details-marker {
        display: none;
    }

    .signed-block summary::before {
        content: '▸';
        display: inline-block;
        width: 1em;
        color: var(--text-muted);
        transition: transform 120ms;
    }

    .signed-block[open] summary::before {
        transform: rotate(90deg);
    }

    .signed-body {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }

    .block-section {
        margin: 0.25rem 0 0;
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--text-dim);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .block-blurb {
        margin: 0;
        font-size: 0.78rem;
        color: var(--text-muted);
        line-height: 1.4;
    }

    .loading {
        margin: 0;
        font-size: 0.78rem;
        color: var(--text-dim);
        font-style: italic;
    }

    .error {
        margin: 0;
        color: var(--error);
        font-size: 0.8rem;
        font-family: var(--mono);
        word-break: break-word;
    }

    .badge {
        font-size: 0.65rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 0.15rem 0.45rem;
        border-radius: 999px;
        font-family: var(--mono);
    }

    .badge.atomic {
        background: color-mix(in srgb, var(--success) 18%, transparent);
        color: var(--success);
    }

    .badge.sequential {
        background: color-mix(in srgb, var(--warning) 18%, transparent);
        color: var(--warning);
    }

    .bundle-call {
        background: var(--bg-elev-2);
        border-radius: var(--radius);
        padding: 0.4rem 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        border-left: 2px solid var(--border-strong);
    }

    .bundle-head {
        display: flex;
        align-items: baseline;
        gap: 0.4rem;
        flex-wrap: wrap;
    }

    .bundle-num {
        font-family: var(--mono);
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--accent);
        background: var(--bg);
        border-radius: 999px;
        padding: 0.05rem 0.4rem;
    }

    .bundle-target {
        font-family: var(--mono);
        font-size: 0.78rem;
        color: var(--text-muted);
    }

    .bundle-dot {
        color: var(--text-dim);
    }

    .bundle-fn {
        font-family: var(--mono);
        font-size: 0.78rem;
        color: var(--text);
        font-weight: 600;
    }

    .bundle-note {
        margin: 0;
        font-size: 0.75rem;
        color: var(--text-muted);
        line-height: 1.4;
    }
</style>
