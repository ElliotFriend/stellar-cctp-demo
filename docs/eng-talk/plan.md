# CCTP Eng-Talk: Remaining Work Plan

Handoff doc for finishing the talk prep. The **speaker script is done**
(`docs/eng-talk/script.md`, committed); this outlines what's left and the
context needed to build it without re-deriving decisions.

## Status

| Deliverable | State | File |
| ----------- | ----- | ---- |
| Speaker script | **done** (committed `02bb695`) | `docs/eng-talk/script.md` |
| Slide deck | **done** (31 slides) | `docs/eng-talk/deck.html` |
| Demo runbook | todo | `docs/eng-talk/runbook.md` |
| Q&A prep | todo | `docs/eng-talk/qa.md` |

Deck artifact URL (private):
<https://claude.ai/code/artifact/8f7d4ba8-8b3b-4593-a3b7-20451c5e3b00> Republish
by passing that `url` to the Artifact tool to keep the same link.

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

## Deliverable 1: Demo runbook (`runbook.md`)

Choreography + safety net for driving the demos live. The script says what to
_say_; the runbook says what to _click_ and what to do when it breaks.

Contents:

- **Pre-flight checklist (morning-of):**
  - Freighter on **Stellar Testnet**, funded XLM + USDC, **USDC trustline
    added**.
  - MetaMask with **Arc Testnet** (chainId 5042002) + USDC; Base Sepolia + a
    little ETH for the recording.
  - Phantom (or Wallet-Standard Solana wallet) on **devnet**, funded devnet USDC
    and SOL; recipient **USDC ATA** exists (or first-transfer will create it).
  - Faucets: XLM `lab.stellar.org/account/fund`; USDC `faucet.circle.com`
    (Stellar Testnet / Arc Testnet / Base Sepolia); Base ETH
    `alchemy.com/faucets/base-sepolia`.
  - Pre-quote/pre-check custody: a Solana receive can fail if Circle's devnet
    custody is underfunded, so do a dry-run transfer the day before.
- **Per-demo click paths** (Demo A/B/C/D): direction picker → flow chip → amount
  → which wallet prompts appear → what to point at on screen (tie to the
  `(SLIDE)` arg tables in the script) → "done" signal.
- **Fallbacks:**
  - **Resume-by-burn-hash**: the app's resume flow (`ResumeForm`,
    `transfer.svelte.ts:resume()`) skips to attest+mint given a burn hash. Keep
    a few known-good burn hashes on hand to resume if a live burn stalls.
  - **Pre-recorded clips** for every flow; cut to the clip if a live attestation
    hangs (esp. anything Base).
  - Arc = seconds; Base Standard = ~15 min (never do Base live).
- **Reset between runs:** transfer history is in-memory (refresh wipes it); note
  starting balances so the "balance went up" beat reads clearly.
- **Timing cues:** target minutes per demo from the script's budget table.

## Deliverable 2: Q&A prep (`qa.md`)

Likely audience questions + starter answers, grouped. Seed list (expand each
with a 2 to 4 sentence starter answer, honest about unknowns):

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

## Deliverable 3: Slide deck (`deck.html`), DONE

31 slides: a cover, the running order, 24 content slides carrying the script's
29 `(SLIDE)` cues (a few closely related cues share a slide, e.g. both of §3a's
and all four of §4's front half), four demo dividers, and a Q&A/references
closer. Self-contained; no external fetches.

**Resynced to the script on 2026-07-30.** The deck was built before the script
revision, so it had drifted. What changed, in case any of it needs revisiting:

- **The launch date was wrong on-slide:** it said "18 Sept 2025", now **May
  2026**. This is the exact error the grounded-facts note below warns about, and
  it had already reached the deck.
- **Contract naming** is now per-chain (`TokenMessengerMinter` on Stellar,
  `TokenMessengerV2` on EVM, `TokenMessengerMinterV2` on Solana) with the
  three-names aside in the §2 notes.
- **Forwarder ownership** corrected. `CctpForwarder` is Circle's, not ours; the
  only deployed-by-us contracts are the two `CctpWrapper`s.
- **`expiration_ledger` renamed** to `live_until_ledger`, matching `322a372`.
- **Removed** the §5a `deposit_for_burn` args slide. That section is now pure
  live-demo narration, since §2 already shows the signature.
- **Added** a §9 "What's next for this demo?" slide.
- **Cold open** now shows all three ways to move a dollar (lock-and-wrap,
  liquidity pool, burn-and-mint), naming Wormhole and Allbridge Core.
- **Dropped** the docs-lag-reality block, the custody-scoping detail, and the
  EURC / not-a-bridge-product caveats, per decisions recorded in the script.
- **All prose em dashes removed** (89 of them). The only remaining `—` are four
  UI glyph placeholders: a CSS `content`, the rail number, and two JS fallbacks.
- **Arrows spelled out** in slide titles, the running-order table, and the JS
  `SECTIONS` map. Arrows inside flow diagrams and code annotations stay.
- Running order now reads §9 = 2 min, total 46 against a ~45 budget, flagged
  as unrehearsed.

**Presentation medium is Google Meet screenshare, not a projector.** That drove
several build decisions, so keep them in mind before editing:

- Hairlines and low-contrast greys mush under VP9 compression. Rules are 2 to
  6px, ground-vs-panel luma separation is wide, `--muted` is lifted.
- Smallest type is the risk, not the largest. Nothing is below ~1.3cqi, and
  code-dense slides carry `class="slide--code"` to trade title size for content
  room.
- No per-slide entrance animation, because each advance would cost the encoder a
  keyframe and smear text. Only two motion moments remain (the cover rule and
  the attest crossing).
- Share **the tab**, window near 16:9, so the fixed 16:9 stage fills the frame
  without double letterboxing.

The footer carries a persistent pointer to the repo and the deployed demo (inline
GitHub mark, then `stellar-cctp-demo · cctp27.vercel.app`) just left of the nav
buttons. Both are real links, styled to inherit the footer colour with no
underline; only a hover/focus shift to `--accent` marks them as clickable. The
mark is inside the repo anchor, so the icon is part of the hit area. The owner prefix is deliberately omitted: with `ElliotFriend/` included
the credit ate 55% of the footer and truncated the section label on 6 of the 9
sections. As shipped, the longest label ("Demo A: Stellar and Arc") clears its box
with ~25% slack at every viewport. The full owner/repo path is on the Q&A slide.

Driving it: `→`/`space` next, `←` prev, `home`/`end`, `n` speaker notes, `o`
jump list, `?` keys, `f` fullscreen. The footer has prev/next/list buttons only:
the notes button and the safe-cut indicator were both removed on request, though
`n` still toggles notes from the keyboard. Deep links are `#/N`. **Speaker notes live
in the same tab, so they're shared if you share the deck.** Keep them off while
presenting and read from `script.md` on a second screen.

Layout invariants worth not breaking:

- Never put `display: grid` on an `li` or any element with mixed inline children
  (it promotes each `<strong>`, `<em>`, or `<code>` to its own grid item and
  shreds the text). `ul.points` and the notes drawer use `position: relative` +
  absolutely positioned `::before` markers for this reason.
- Every slide must fit the stage with no clipping. There's an audit harness for
  this: build a probe wrapper around `deck.html`, force each slide current, and
  measure `.body` / `.code` / `.tablewrap` for `scrollHeight > clientHeight` and
  overflow past the slide box.

  **Audit against the footer, not the slide box.** The `.foot` bar sits _inside_
  `.slide`, so content can stay within the slide box and still land underneath the
  section label and the nav buttons. Measure every `.body` descendant's `bottom`
  against `.foot`'s `top`. An earlier version of this note said to ignore
  `scrollHeight > clientHeight` on `.body` as a soft signal; that was wrong. When
  `.body` overflows, its children spill into the footer band, which is exactly the
  defect. Audit both, plus sibling `.cols` / `.codecols` children for equal height.

  **Do not zero default block margins in the probe.** The Artifact skeleton's
  "minimal CSS reset" leaves `<p>` / `<h2>` / `<ul>` margins in place, and the deck
  has no reset of its own, so those margins are real layout. A probe that zeroes
  them under-reports height and reports a clean deck that clips in production. Use
  only `*{box-sizing:border-box}` + `body{margin:0}`. (As of the 2026-07-30 layout
  pass the deck fits under both assumptions, so either probe now passes; keep the
  faithful one as the gate.)

  Run it with **real Chrome** (`chromium.launch({ channel: 'chrome' })`), not the
  bundled headless shell. The shell has none of the Charter / Iowan / Palatino
  stack, falls back to different metrics, and inflates every measurement by ~30%,
  which makes the whole deck look broken.

  Last run (2026-07-30, after the layout pass): 31 slides, **0 failures** at
  1100×900, 1440×810, and 1920×1080, both themes, on both probe variants.

  Before that pass, 23 of 31 slides had a problem: 14 with content under the
  footer, 5 code blocks scrolling, 7 with mismatched sibling card heights, and 2
  scrolling tables. Fixed structurally rather than slide by slide:

  - `.slide` padding-bottom 6.6cqi → 7.2cqi, and the vertical rhythm tightened
    across `.title`, `.body`, `ul.points`, `.card`, `.flag`, `.code`, and table
    rows. Nothing dropped below ~1.3cqi, which is the Meet legibility floor.
  - `.cols` went `align-items: start` → `stretch`. That single change fixed every
    "the boxes are different heights" complaint; `.codecols` matches it.
  - New primitives: `.codecols` (two code blocks side by side, used by §2's
    entrypoint pair so neither scrolls), `.flag--stack` (tag on its own line so
    prose uses the full width, used by §2's chainId callout), and `ul.links`
    (the Q&A reference list).
  - Reference-only chips on the §3b encoder and §5b wrapper slides moved into
    speaker notes to buy the code blocks room.
  1440×810, and 1920×1080, both themes.
- Type sizes are all `cqi` against a `container-type: inline-size` stage, so the
  deck scales identically at any window size. Don't introduce `px` type.

## Grounded facts to reuse

Treat these as a cache, not as gospel. Each one names how it was established. If
a fact matters to something public-facing, re-check it against the source rather
than trusting this list. (An earlier version of this file asserted these were
"already verified, don't re-fetch", and that framing propagated a wrong launch
date into the deck. See the CCTP-live entry below.)

- **CCTP V2 live on Stellar:** **May 2026**, per Elliot (2026-07-29), which is
  the publish date of
  `stellar.org/blog/foundation-news/circle-cctp-is-live-on-stellar`. This file
  previously claimed 2025-09-18, which was wrong and unsourced. Note that the
  blog page itself renders **no visible date**, so the date can't be confirmed
  by fetching that URL. Get it from the CMS or a dated announcement if you ever
  need to cite it precisely.
- **Domains:** Ethereum 0, Solana 5, Base 6, Arc 26, **Stellar 27**. (Arc
  chainId 5042002 ≠ its domain 26.)
- **Finality thresholds:** Standard 2000, Fast 1000. Stellar-source always
  attests at 2000 (Fast is N/A for a fast-finality chain).
- **Forwarding status:** works **out of** Stellar to EVM (Arc, Base) _and_
  Solana (all verified end-to-end); **blocked into** Stellar ("destination does
  not support forwarding"). Circle's published destination list omits Solana but
  the sandbox relayer services it (docs lag reality). `destinationCaller` must
  be 0 for forwarding; relayer consumes ~full `maxFee`.
- **Verified Stellar→Solana forward (2026-07-24):** burn (Stellar testnet)
  `0d4fcd21ce8cfbe98f3e2bc9441a472c7cf9e28e886e516fbabfd696dc0b09aa` → Iris
  `forwardState COMPLETE` → Solana devnet mint
  `3WertUfbKQA22CobQ7uh3mKDQegfw5ZKGKPsdpk45gRPq8PCiGZddfkgiKtpLFrkvcoYye9jnf5awRevKqfj1xqF`
  (`finalized`, `Ok`). Full write-up in
  `docs/experiments/2026-06-24-forwarder-stellar-source.md`.
- **Solana custody twist:** inbound receive is _not_ `mint_to`,
  `handle_receive_finalized_message` transfers from a shared
  `custody_token_account` (seed `["custody", mint]`, **one per USDC mint**,
  shared across all source domains). `token_pair(27,…)` /
  `remote_token_messenger(27)` are the per-domain registrations.
- **Stellar-destination requires `depositForBurnWithHook`:** G-address rides
  only in hook data; plain `deposit_for_burn` strands funds (TMM errors
  `HookDataEmpty` on empty hook). Muxed `M` addresses are G-flavored, so they can't be
  a direct `mintRecipient` either.
- **Hook layouts:** forwarder-recipient = 24 zero bytes + u32 version(0) + u32
  strkey-length + UTF-8 strkey; `cctp-forward` flag = 24-byte region with ASCII
  `cctp-forward` + version 0 + length 0.
- **Circle docs:** Stellar reference
  `developers.circle.com/cctp/references/stellar`; forwarding
  `developers.circle.com/cctp/concepts/forwarding-service`.
- **Iris:** sandbox `iris-api-sandbox.circle.com`; messages keyed by source
  domain + burn tx hash: `GET /v2/messages/{srcDomain}?transactionHash={hash}`;
  fee `GET /v2/burn/USDC/fees/{src}/{dst}` (+`?forward=true`).

## Key repo references (for snippets in runbook/deck)

- Soroban wrapper: `contracts/stellar/cctp-wrapper/src/lib.rs`
  (`approve_and_deposit`, `approve_and_deposit_with_hook`).
- EVM wrapper: `contracts/evm/cctp-wrapper/src/CctpWrapper.sol`
  (`bridgeWithPermit`).
- TMM/MT interfaces (exact sigs):
  `contracts/stellar/cctp-wrapper/src/{tmm,mtv2}_interface.rs`.
- Burn/mint call sites: `src/lib/stellar/cctp.ts`, `src/lib/evm/cctp.ts`,
  `src/lib/solana/cctp.ts`, `src/lib/solana/mint.ts`.
- Hook + recipient encoding: `src/lib/stellar/recipient.ts`.
- Orchestration + resume flow: `src/lib/stores/transfer.svelte.ts`.
- Iris/fees: `src/lib/circle/{iris,fees}.ts`. Config/addresses/domains:
  `src/lib/config.ts`.

## Notes for whoever picks this up

- Script may still get wording tweaks, so re-read it before building the deck so
  slides match. Deck slides map 1:1 to `(SLIDE)` cues.
- TOC in `script.md` is auto-generated (Markdown All-in-One `<!-- omit in toc
  -->` markers); regenerate after any heading edits. `pnpm format` reflows
  prose.
- Voice: warm, second person, caveats-as-credibility (see script's "Voice
  reminders"). This is DevRel content, and the `stellar-devrel-context` skill has
  the full voice spec.
