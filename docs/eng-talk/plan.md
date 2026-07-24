# CCTP Eng-Talk — Remaining Work Plan

Handoff doc for finishing the talk prep. The **speaker script is done**
(`docs/eng-talk/script.md`, committed); this outlines what's left and the
context needed to build it without re-deriving decisions.

## Status

| Deliverable | State | File |
| ----------- | ----- | ---- |
| Speaker script | **done** (committed `02bb695`) | `docs/eng-talk/script.md` |
| Demo runbook | todo | `docs/eng-talk/runbook.md` |
| Q&A prep | todo | `docs/eng-talk/qa.md` |
| Slide deck | todo (build **after** script is final) | HTML artifact (self-contained) |

## Talk parameters (locked)

- **Length:** ~45 min talk + ~15 min Q&A. Talk is Friday **2026-07-31**.
- **Audience:** internal Stellar staff. Deep on Stellar internals; _not_
  uniformly deep on smart contracts-in-practice or other chains. Introduce EVM
  `approve`/allowance and Solana ATAs; assume G-accounts, trustlines, Soroban,
  `ScVal`.
- **Live demos:** Stellar↔Arc (raw vs wrapper), Solana both ways, forwarding
  (Stellar→EVM). **Base Sepolia is recording-only.** Record everything ahead as
  backup.
- **Decisions already made:** smart-contract primer cut (audience is fine);
  forwarding = concept + brief Circle-support story + live demo; EVM-wrapper
  walkthrough is a compressible aside (safe cut #1); Demo D is a safe cut #2.
- Script section map: 1 cold-open · 2 mental model · 3 Stellar realities
  (Forwarder + hook data) · 4 forwarding service · **5 Demo A** (5a raw / 5b
  Soroban wrapper walkthrough / 5c wrapper path) · 6 Demo B (EVM→Stellar) · 7
  Demo C (Solana) · 8 Demo D (forwarding live) · 9 recap.

## Deliverable 1 — Demo runbook (`runbook.md`)

Choreography + safety net for driving the demos live. The script says what to
_say_; the runbook says what to _click_ and what to do when it breaks.

Contents:
- **Pre-flight checklist (morning-of):**
  - Freighter on **Stellar Testnet**, funded XLM + USDC, **USDC trustline added**.
  - MetaMask with **Arc Testnet** (chainId 5042002) + USDC; Base Sepolia + a little
    ETH for the recording.
  - Phantom (or Wallet-Standard Solana wallet) on **devnet**, funded devnet USDC +
    SOL; recipient **USDC ATA** exists (or first-transfer will create it).
  - Faucets: XLM `lab.stellar.org/account/fund`; USDC `faucet.circle.com` (Stellar
    Testnet / Arc Testnet / Base Sepolia); Base ETH `alchemy.com/faucets/base-sepolia`.
  - Pre-quote/pre-check custody: a Solana receive can fail if Circle's devnet
    custody is underfunded — do a dry-run transfer the day before.
- **Per-demo click paths** (Demo A/B/C/D): direction picker → flow chip →
  amount → which wallet prompts appear → what to point at on screen (tie to the
  `(SLIDE)` arg tables in the script) → "done" signal.
- **Fallbacks:**
  - **Resume-by-burn-hash** — the app's resume flow (`ResumeForm`,
    `transfer.svelte.ts:resume()`) skips to attest+mint given a burn hash. Keep a
    few known-good burn hashes on hand to resume if a live burn stalls.
  - **Pre-recorded clips** for every flow; cut to the clip if a live attestation
    hangs (esp. anything Base).
  - Arc = seconds; Base Standard = ~15 min (never do Base live).
- **Reset between runs:** transfer history is in-memory (refresh wipes it);
  note starting balances so the "balance went up" beat reads clearly.
- **Timing cues:** target minutes per demo from the script's budget table.

## Deliverable 2 — Q&A prep (`qa.md`)

Likely audience questions + starter answers, grouped. Seed list (expand each
with a 2–4 sentence starter answer, honest about unknowns):
- **Trust model:** Is Circle a trusted third party? What if the attester(s) or
  Iris lie/go down? Can funds be stuck if Circle disappears?
- **vs anchors / classic USDC:** How is this different from a SEP-24 anchor or
  classic USDC + trustlines? When would you use CCTP vs an anchor?
- **Forwarder security:** Can anyone call `mint_and_forward`? Can the Forwarder
  steal/misroute funds? Why is it a separate contract vs in-protocol?
- **Wrapper:** Why a wrapper at all? Is it audited? What's the risk of passing
  `usdc`/`tmm` as args (see script §5b)?
- **Fees/economics:** Who pays the forward fee? Why does forwarding consume the
  full `maxFee`? What does a transfer cost end-to-end?
- **Fast vs Standard:** Why is Fast N/A from Stellar? When does Fast matter?
- **Solana custody:** If it's release-from-custody not mint, who funds custody,
  and what happens if it's dry on mainnet?
- **Failure/recovery:** What if the mint never lands? (resume flow; funds
  recoverable because `destinationCaller` is 0 on non-forwarded burns.)
- **Assets/chains:** EURC? Which chains are live? Mainnet readiness?
- **Why Arc** as the default demo chain.

## Deliverable 3 — Slide deck (HTML artifact)

- Build **after** the script is final — slides derive directly from the
  `(SLIDE)` cues already marked throughout `script.md` (diagrams, arg tables,
  code snippets, the domains table, the three-encodings table, the flow
  comparison tables).
- **Before writing the page, load the `artifact-design` skill** (required by the
  Artifact tool) to calibrate design effort; it's a technical talk deck, so lean
  legible/high-contrast, code-friendly monospace, dark-mode aware.
- Self-contained (inline CSS/JS, no external fetches). Theme-aware. Wide code
  blocks/tables scroll in their own container.
- Suggested slide count ≈ one per `(SLIDE)` cue (~18–22), plus section dividers.

## Grounded facts to reuse (already verified — don't re-fetch)

- **CCTP V2 live on Stellar:** 2025-09-18 (`stellar.org/blog/foundation-news/circle-cctp-is-live-on-stellar`).
- **Domains:** Ethereum 0, Solana 5, Base 6, Arc 26, **Stellar 27**. (Arc chainId
  5042002 ≠ its domain 26.)
- **Finality thresholds:** Standard 2000, Fast 1000. Stellar-source always
  attests at 2000 (Fast is N/A for a fast-finality chain).
- **Forwarding status:** works **out of** Stellar to EVM (Arc, Base) _and_ Solana
  (all verified end-to-end); **blocked into** Stellar ("destination does not
  support forwarding"). Circle's published destination list omits Solana but the
  sandbox relayer services it — docs lag reality. `destinationCaller` must be 0
  for forwarding; relayer consumes ~full `maxFee`.
- **Verified Stellar→Solana forward (2026-07-24):** burn (Stellar testnet)
  `0d4fcd21ce8cfbe98f3e2bc9441a472c7cf9e28e886e516fbabfd696dc0b09aa` → Iris
  `forwardState COMPLETE` → Solana devnet mint
  `3WertUfbKQA22CobQ7uh3mKDQegfw5ZKGKPsdpk45gRPq8PCiGZddfkgiKtpLFrkvcoYye9jnf5awRevKqfj1xqF`
  (`finalized`, `Ok`). Full write-up in
  `docs/experiments/2026-06-24-forwarder-stellar-source.md`.
- **Solana custody twist:** inbound receive is _not_ `mint_to` —
  `handle_receive_finalized_message` transfers from a shared
  `custody_token_account` (seed `["custody", mint]`, **one per USDC mint**, shared
  across all source domains). `token_pair(27,…)` / `remote_token_messenger(27)`
  are the per-domain registrations.
- **Stellar-destination requires `depositForBurnWithHook`:** G-address rides only
  in hook data; plain `deposit_for_burn` strands funds (TMM errors `HookDataEmpty`
  on empty hook). Muxed `M` addresses are G-flavored — can't be a direct
  `mintRecipient` either.
- **Hook layouts:** forwarder-recipient = 24 zero bytes + u32 version(0) + u32
  strkey-length + UTF-8 strkey; `cctp-forward` flag = 24-byte region with ASCII
  `cctp-forward` + version 0 + length 0.
- **Circle docs:** Stellar reference `developers.circle.com/cctp/references/stellar`;
  forwarding `developers.circle.com/cctp/concepts/forwarding-service`.
- **Iris:** sandbox `iris-api-sandbox.circle.com`; messages keyed by source domain
  + burn tx hash: `GET /v2/messages/{srcDomain}?transactionHash={hash}`; fee
  `GET /v2/burn/USDC/fees/{src}/{dst}` (+`?forward=true`).

## Key repo references (for snippets in runbook/deck)

- Soroban wrapper: `contracts/stellar/cctp-wrapper/src/lib.rs`
  (`approve_and_deposit`, `approve_and_deposit_with_hook`).
- EVM wrapper: `contracts/evm/cctp-wrapper/src/CctpWrapper.sol` (`bridgeWithPermit`).
- TMM/MT interfaces (exact sigs): `contracts/stellar/cctp-wrapper/src/{tmm,mtv2}_interface.rs`.
- Burn/mint call sites: `src/lib/stellar/cctp.ts`, `src/lib/evm/cctp.ts`,
  `src/lib/solana/cctp.ts`, `src/lib/solana/mint.ts`.
- Hook + recipient encoding: `src/lib/stellar/recipient.ts`.
- Orchestration + resume flow: `src/lib/stores/transfer.svelte.ts`.
- Iris/fees: `src/lib/circle/{iris,fees}.ts`. Config/addresses/domains:
  `src/lib/config.ts`.

## Notes for whoever picks this up

- Script may still get wording tweaks — re-read it before building the deck so
  slides match. Deck slides map 1:1 to `(SLIDE)` cues.
- TOC in `script.md` is auto-generated (Markdown All-in-One `<!-- omit in toc -->`
  markers); regenerate after any heading edits. `pnpm format` reflows prose.
- Voice: warm, second person, caveats-as-credibility (see script's "Voice
  reminders"). This is DevRel content — the `stellar-devrel-context` skill has the
  full voice spec.
