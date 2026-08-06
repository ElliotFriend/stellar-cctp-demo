<script lang="ts">
    import { SOLANA, STELLAR, SOLANA_MAX_FEE, type TransferSpeed } from '$lib/config';
    import { fetchBurnFee, feeBpsFor, computeMaxFee, thresholdFor } from '$lib/circle/fees';
    import { parseUsdcSolana } from '$lib/solana/usdc';
    import { strkeyToBytes32, encodeStellarForwarderHookData } from '$lib/stellar/recipient';
    import { shortAddr } from '$lib/utils';
    import ContractArg from '$lib/components/ui/ContractArg.svelte';

    let {
        solanaAddress,
        stellarRecipient,
        amount,
        speed = 'standard',
    }: {
        solanaAddress: string;
        stellarRecipient: string;
        amount: string;
        speed?: TransferSpeed;
    } = $props();

    let threshold = $derived(thresholdFor(speed));

    type Parsed = { ok: true; raw: bigint } | { ok: false };
    let parsedAmount = $derived<Parsed>(
        (() => {
            const t = amount.trim();
            if (t === '') return { ok: false };
            try {
                return { ok: true, raw: parseUsdcSolana(t) };
            } catch {
                return { ok: false };
            }
        })(),
    );

    let forwarderHex = $derived(strkeyToBytes32(STELLAR.contracts.cctpForwarder));
    let hookHex = $derived(
        (() => {
            try {
                return encodeStellarForwarderHookData(stellarRecipient);
            } catch {
                return null;
            }
        })(),
    );
    let feePromise = $derived(fetchBurnFee(SOLANA.domain, STELLAR.domain));

    let amountArg = $derived(
        parsedAmount.ok
            ? { value: parsedAmount.raw.toString(), note: '6-decimal USDC subunits.' }
            : { placeholder: 'Enter an amount above' },
    );

    let hookDataArg = $derived(
        hookHex
            ? {
                  value: hookHex,
                  note: `Routing for the Stellar forwarder, pointing at ${shortAddr(stellarRecipient)}. The full byte layout is below.`,
              }
            : { placeholder: 'Connect a Stellar recipient' },
    );

    let maxFeeArg = $derived.by(async () => {
        // Read every reactive dependency up front: anything read after an `await`
        // in an async $derived.by body is NOT tracked, so it would go stale.
        // `speed` really does toggle here, unlike the outbound preview.
        const currentSpeed = speed;
        const amount = parsedAmount.ok ? parsedAmount.raw : 0n;
        const burnFees = feePromise;

        try {
            const bps = feeBpsFor(await burnFees, currentSpeed);
            return {
                value: computeMaxFee(amount, bps, SOLANA_MAX_FEE).toString(),
                note:
                    bps > 0
                        ? `${bps} bps fast fee on top of the floor.`
                        : 'Floor only (this speed carries no fee).',
            };
        } catch {
            return {
                value: SOLANA_MAX_FEE.toString(),
                note: "Floor only (the fee API didn't answer).",
            };
        }
    });
</script>

<section class="burn-preview">
    <header class="head">
        <h4 class="title">Burn invocation preview</h4>
        <span class="sub"
            >What you're about to sign in Phantom, decoded into human-readable args.</span
        >
    </header>

    <div class="meta">
        <div class="meta-row">
            <span class="meta-label">Program</span>
            <code class="meta-value" title={SOLANA.programs.tokenMessengerMinterV2}>
                {shortAddr(SOLANA.programs.tokenMessengerMinterV2)}
            </code>
            <span class="meta-aside">TokenMessengerMinterV2 · deposit_for_burn_with_hook</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Owner</span>
            <code class="meta-value" title={solanaAddress}>{shortAddr(solanaAddress)}</code>
            <span class="meta-aside">signs + pays the burn (Phantom)</span>
        </div>
    </div>

    <h5 class="section-title">Arguments</h5>
    <ul class="rows">
        <ContractArg name="amount" type="u64" {...amountArg} />

        <ContractArg
            name="destinationDomain"
            type="u32"
            value={STELLAR.domain.toString()}
            note="Stellar"
        />

        <ContractArg
            name="mintRecipient = destinationCaller"
            type="Pubkey"
            value={forwarderHex}
            hex
        >
            {#snippet note()}
                The Stellar CctpForwarder. Your real recipient rides along in the
                <code>hookData</code> below.
            {/snippet}
        </ContractArg>

        {#await maxFeeArg}
            <ContractArg name="maxFee" type="u64" placeholder="Calculating maximum fee..." />
        {:then arg}
            <ContractArg name="maxFee" type="u64" {...arg} />
        {/await}

        <ContractArg
            name="minFinalityThreshold"
            type="u32"
            value={threshold.toString()}
            note={speed === 'fast'
                ? 'Fast Transfer, so Circle attests before finality.'
                : 'Standard, so Circle waits for finality.'}
        />

        <ContractArg name="hookData" type="bytes" hex {...hookDataArg} />
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
</style>
