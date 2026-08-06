<script lang="ts">
    import type { Snippet } from "svelte";
    import { shortAddr } from "$lib/utils";

    interface Props {
        name: string,
        type: string,
        value?: string,
        note?: string | Snippet,
        placeholder?: string,
        truncate?: boolean,
        hex?: boolean,
    }

    let { name, type, value, note, placeholder, truncate, hex }: Props = $props();
    let valueToDisplay = $derived(truncate && value ? shortAddr(value) : value)
</script>

<li class="row">
    <span class="arg-name">{name}</span>
    <span class="arg-type">{type}</span>
    {#if value !== undefined}
        <code class="arg-value" class:hex title={truncate ? value : undefined}>{valueToDisplay}</code>
    {/if}
    {#if placeholder}
        <span class="arg-placeholder">{placeholder}</span>
    {/if}
    {#if typeof note === 'string'}
        <span class="arg-note">{note}</span>
    {:else if note}
        <span class="arg-note">{@render note()}</span>
    {/if}
</li>

<style>
    /* The third track must stay flexible: a `max-content` track would let the
       full-width `arg-note` / `arg-value.hex` children (which span every
       column) inflate the label and type tracks, blowing the row past the
       container instead of wrapping. `minmax(0, 1fr)` keeps that contribution
       out. */
    .row {
        display: grid;
        grid-template-columns: max-content max-content minmax(0, 1fr);
        align-items: baseline;
        border-radius: var(--radius);
        gap: var(--arg-gap, 0.2rem 0.6rem);
        padding: var(--arg-pad, 0.4rem 0.5rem);
        background: var(--arg-bg, var(--bg));
        border-left: var(--arg-rule, 2px solid var(--accent));
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

    .arg-note :global(code) {
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

    .arg-value.hex {
        grid-column: 1 / -1;
        font-size: 0.75rem;
        justify-self: start;
    }
</style>
