<script lang="ts">
    import { SOLANA, STELLAR, SOLANA_MAX_FEE, type TransferSpeed } from '$lib/config';
    import { fetchBurnFee, feeBpsFor, computeMaxFee, thresholdFor } from '$lib/circle/fees';
    import { parseUsdcSolana } from '$lib/solana/usdc';
    import { strkeyToBytes32, encodeStellarForwarderHookData } from '$lib/stellar/recipient';
    import { shortAddr } from '$lib/utils';

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
    const short = (a: string) => shortAddr(a, 6, 6);
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
                {short(SOLANA.programs.tokenMessengerMinterV2)}
            </code>
            <span class="meta-aside">TokenMessengerMinterV2 · deposit_for_burn_with_hook</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">Owner</span>
            <code class="meta-value" title={solanaAddress}>{short(solanaAddress)}</code>
            <span class="meta-aside">signs + pays the burn (Phantom)</span>
        </div>
    </div>

    <h5 class="section-title">Arguments</h5>
    <ul class="rows">
        <li class="row">
            <span class="arg-name">amount</span>
            <span class="arg-type">u64</span>
            {#if parsedAmount.ok}
                <code class="arg-value">{parsedAmount.raw.toString()}</code>
                <span class="arg-note">6-decimal USDC subunits.</span>
            {:else}
                <span class="arg-placeholder">Enter an amount above</span>
            {/if}
        </li>
        <li class="row">
            <span class="arg-name">destinationDomain</span>
            <span class="arg-type">u32</span>
            <code class="arg-value">{STELLAR.domain}</code>
            <span class="arg-note">Stellar</span>
        </li>
        <li class="row">
            <span class="arg-name">mintRecipient = destinationCaller</span>
            <span class="arg-type">Pubkey</span>
            <code class="arg-hex">{forwarderHex}</code>
            <span class="arg-note">
                The Stellar CctpForwarder. Your real recipient rides along in the
                <code>hookData</code> below.
            </span>
        </li>
        <li class="row">
            <span class="arg-name">maxFee</span>
            <span class="arg-type">u64</span>
            {#await feePromise then rows}
                {@const bps = feeBpsFor(rows, speed)}
                <code class="arg-value">
                    {computeMaxFee(
                        parsedAmount.ok ? parsedAmount.raw : 0n,
                        bps,
                        SOLANA_MAX_FEE,
                    ).toString()}
                </code>
                <span class="arg-note">
                    {bps > 0
                        ? `${bps} bps fast fee on top of the floor.`
                        : 'Floor only (this speed carries no fee).'}
                </span>
            {:catch}
                <code class="arg-value">{SOLANA_MAX_FEE.toString()}</code>
                <span class="arg-note">Floor only (the fee API didn't answer).</span>
            {/await}
        </li>
        <li class="row">
            <span class="arg-name">minFinalityThreshold</span>
            <span class="arg-type">u32</span>
            <code class="arg-value">{threshold}</code>
            <span class="arg-note">
                {speed === 'fast'
                    ? 'Fast Transfer, so Circle attests before finality.'
                    : 'Standard, so Circle waits for finality.'}
            </span>
        </li>
        <li class="row">
            <span class="arg-name">hookData</span>
            <span class="arg-type">bytes</span>
            {#if hookHex}
                <code class="arg-hex">{hookHex}</code>
                <span class="arg-note">
                    Routing for the Stellar forwarder, pointing at {short(stellarRecipient)}. The
                    full byte layout is below.
                </span>
            {:else}
                <span class="arg-placeholder">Connect a Stellar recipient</span>
            {/if}
        </li>
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
    /* The third track must stay flexible: a `max-content` track would let the
       full-width `arg-note` / `arg-hex` children (which span every column)
       inflate the label and type tracks, blowing the row past the container
       instead of wrapping. `minmax(0, 1fr)` keeps that contribution out. */
    .row {
        display: grid;
        grid-template-columns: max-content max-content minmax(0, 1fr);
        align-items: baseline;
        gap: 0.2rem 0.6rem;
        padding: 0.4rem 0.5rem;
        background: var(--bg);
        border-radius: var(--radius);
        border-left: 2px solid var(--accent);
    }
    .arg-name {
        font-family: var(--mono);
        font-size: 0.78rem;
        color: var(--text);
        font-weight: 500;
    }
    .arg-type {
        font-family: var(--mono);
        font-size: 0.72rem;
        color: var(--accent);
        font-weight: 600;
    }
    .arg-value {
        font-family: var(--mono);
        font-size: 0.78rem;
        color: var(--text);
        word-break: break-all;
        justify-self: end;
    }
    .arg-note {
        grid-column: 1 / -1;
        font-size: 0.75rem;
        color: var(--text-muted);
        line-height: 1.4;
        overflow-wrap: anywhere;
    }
    .arg-note code {
        font-family: var(--mono);
        color: var(--text);
    }
    .arg-placeholder {
        grid-column: 3 / -1;
        font-size: 0.75rem;
        color: var(--text-dim);
        font-style: italic;
        justify-self: end;
        overflow-wrap: anywhere;
    }
    .arg-hex {
        grid-column: 1 / -1;
        font-family: var(--mono);
        font-size: 0.75rem;
        color: var(--text);
        word-break: break-all;
    }
</style>
