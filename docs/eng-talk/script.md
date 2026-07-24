# CCTP on Stellar — Speaker Script <!-- omit in toc -->

**Talk:** Circle's Cross-Chain Transfer Protocol (CCTP V2) between Stellar and
other chains **Audience:** Internal Stellar staff. Deep on Stellar
internals/data structures; _not_ uniformly deep on smart contracts-in-practice
or other chains. Assume they know what a G-account, a trustline, a Soroban
contract, and an `ScVal` are. Do _not_ assume they know what an EVM `approve`
allowance or a Solana ATA is — introduce those. **Budget:** ~45 min talk + ~15
min Q&A. **Direction of demos we run live:** Stellar↔Arc (raw vs wrapper),
Solana both ways, forwarding (Stellar→EVM). Base Sepolia is recording-only.

> **How to read this doc.** Each section has a time box, the _point_ (the one
> thing they should walk away with), talking points (hit these, don't read
> them), and — where relevant — the exact code/args to put on screen. Lines in
> quotes are suggested phrasings you can lean on; everything else is a cue.
> `(SLIDE)` marks a slide cue, `(DEMO)` a live-demo handoff, `(CAVEAT)` an
> honesty beat worth not skipping.

## Running order & time budget  <!-- omit in toc -->

| #   | Section                                               | Min | Cumulative |
| --- | ----------------------------------------------------- | --- | ---------- |
| 1   | Cold open — the problem                               | 2   | 2          |
| 2   | CCTP mental model: burn → attest → mint               | 6   | 8          |
| 3   | Stellar realities: the Forwarder & hook data          | 6   | 14         |
| 4   | The forwarding service                                | 4   | 18         |
| 5   | **Demo A** — Stellar↔Arc: raw → walkthrough → wrapper | 12  | 30         |
| 6   | **Demo B** — EVM→Stellar, three burn flows            | 7   | 37         |
| 7   | **Demo C** — Solana both ways + the custody twist     | 5   | 42         |
| 8   | **Demo D** — forwarding live (Stellar→EVM)            | 2   | 44         |
| 9   | Recap + honest limitations                            | 1   | 45         |
| n/a | Q&A                                                   | 15  | 60         |

_If you're running long, the two safest cuts are the EVM-wrapper comparison in
§5b and Demo D (§8) — you'll have already shown the forwarding concept in §4 and
the wrapper concept on Stellar in §5b/§5c._

- [1. Cold open — the problem (2 min)](#1-cold-open--the-problem-2-min)
- [2. CCTP mental model: burn → attest → mint (6 min)](#2-cctp-mental-model-burn--attest--mint-6-min)
- [3. Stellar realities: the Forwarder \& hook data (6 min)](#3-stellar-realities-the-forwarder--hook-data-6-min)
  - [3a. Why inbound-to-Stellar needs a Forwarder](#3a-why-inbound-to-stellar-needs-a-forwarder)
  - [3b. Hook data — the most important bytes in the repo](#3b-hook-data--the-most-important-bytes-in-the-repo)
  - [3c. Three address encodings, one concept](#3c-three-address-encodings-one-concept)
- [4. The forwarding service (4 min)](#4-the-forwarding-service-4-min)
- [5. Demo A — Stellar ↔ Arc: raw, walkthrough, wrapper (12 min)](#5-demo-a--stellar--arc-raw-walkthrough-wrapper-12-min)
  - [5a. The raw path — "2 tx (direct)"](#5a-the-raw-path--2-tx-direct)
  - [5b. Wrapper walkthrough — the Soroban contract](#5b-wrapper-walkthrough--the-soroban-contract)
  - [5c. The wrapper path — "1 tx (wrapper)"](#5c-the-wrapper-path--1-tx-wrapper)
- [6. Demo B — EVM → Stellar, three burn flows (7 min)](#6-demo-b--evm--stellar-three-burn-flows-7-min)
  - [6a. The invariant, up front](#6a-the-invariant-up-front)
  - [6b. Three burn flows (show at least two live)](#6b-three-burn-flows-show-at-least-two-live)
- [7. Demo C — Solana both ways + the custody twist (5 min)](#7-demo-c--solana-both-ways--the-custody-twist-5-min)
  - [7a. Solana → Stellar (burn on Solana)](#7a-solana--stellar-burn-on-solana)
  - [7b. Stellar → Solana, and the custody twist](#7b-stellar--solana-and-the-custody-twist)
  - [7c. Fast vs Standard, honestly](#7c-fast-vs-standard-honestly)
- [8. Demo D — forwarding live (Stellar → EVM) (2 min)](#8-demo-d--forwarding-live-stellar--evm-2-min)
- [9. Recap + honest limitations (1 min)](#9-recap--honest-limitations-1-min)
- [Voice reminders (for you, not the slides)](#voice-reminders-for-you-not-the-slides)

## 1. Cold open — the problem (2 min)

**Point:** Moving a stablecoin between chains often means wrapped tokens and
liquidity pools. CCTP does it with a _burn-and-mint_ model. That means there is
no wrapper asset, no pool, no bridge TVL to get drained.

Talking points:

- "You've got USDC on chain A. You want USDC on chain B. Today the common answer
  is a bridge: lock your USDC on A, mint a _wrapped_ representation on B, and
  hope the bridge's liquidity and multisig hold up. That's where most of the big
  bridge hacks came from."
- CCTP's model: **burn** the real USDC on the source chain, and Circle
  authorizes a **mint** of _native, canonical_ USDC on the destination. Same
  issuer, same asset, both sides. No wrapped-USDC.dead-end token, no pool that
  can run dry or be compromised.
- Why this room cares: as of **September 2025**, Stellar is _finally_ a CCTP V2
  destination _and_ source (domain 27) — [Circle CCTP went live on
  Stellar](https://stellar.org/blog/foundation-news/circle-cctp-is-live-on-stellar)
  on Sept 18, 2025. This is how canonical USDC moves on and off Stellar to the
  rest of the stablecoin world — EVM chains, Solana — without an anchor or a
  third-party bridge in the middle.
- (SLIDE) One line: **"Burn here. Mint there. Same asset."**

Transition: "So how does chain B know it's allowed to mint? That's the whole
trick, and it's three moving parts."

## 2. CCTP mental model: burn → attest → mint (6 min)

**Point:** Three actors, three steps. A burn emits a message; Circle _attests_
to it off-chain; anyone can carry that attestation to the destination and
trigger the mint.

(SLIDE) The three-box diagram: **Source chain → Circle (Iris) → Destination
chain**, with the message + attestation flowing across.

The three steps:

1. **Burn.** On the source chain you call `depositForBurn` (EVM/Solana) /
   `deposit_for_burn` (Stellar) on the **TokenMessengerMinter**. It burns your
   USDC and emits a structured **message** into the **MessageTransmitter** —
   think of it as a generic cross-chain message bus. The message says, in
   effect: _"N units were burned on domain X, destined for recipient R on domain
   Y."_
2. **Attest.** Circle's off-chain service (its API is called **Iris**) watches
   for that burn, waits for the source chain to reach the required finality, and
   then issues a signed **attestation** — Circle's cryptographic say-so that the
   burn really happened and is final. You poll for it. On Arc that's _seconds_;
   on Base Sepolia Standard transfers it's ~15 minutes (finality wait, not
   Circle being slow).
3. **Mint.** You hand the `(message, attestation)` pair to the
   **MessageTransmitter** on the _destination chain_, which verifies Circle's
   signature and calls into the local TokenMessengerMinter to **mint** native
   USDC to the recipient.

(SLIDE) **The two burn entrypoints — `deposit_for_burn` vs
`deposit_for_burn_with_hook`.** They're identical except the hook variant takes
one extra trailing field (Soroban signatures shown):

```rust
// TokenMessengerMinter — the plain burn
fn deposit_for_burn(
    caller: Address, amount: i128, destination_domain: u32,
    mint_recipient: BytesN<32>, burn_token: Address,
    destination_caller: BytesN<32>, max_fee: i128, min_finality_threshold: u32,
);

// ...and the burn that carries a payload to the destination
fn deposit_for_burn_with_hook(
    caller: Address, amount: i128, destination_domain: u32,
    mint_recipient: BytesN<32>, burn_token: Address,
    destination_caller: BytesN<32>, max_fee: i128, min_finality_threshold: u32,
    hook_data: Bytes,   // ← arbitrary bytes delivered alongside the mint
);
```

- "The hook variant is a strict superset — same eight args, plus `hook_data`.
  That payload is how you say something to the destination: it's what carries a
  Stellar recipient, or the `cctp-forward` flag we'll see later. Hold onto this;
  on Stellar it turns out to be mandatory, not optional." (The contract even
  _rejects_ empty hook data on this path — a `HookDataEmpty` error — so you
  reach for it precisely when you have something to deliver.)

(SLIDE) **The mint side is the same shape everywhere: `(message,
attestation)`.**

```text
EVM      MessageTransmitterV2.receiveMessage(bytes message, bytes attestation)
Solana   MessageTransmitterV2.receiveMessage(...)   // CPIs into TMM to release funds
Stellar  MessageTransmitter.receive_message(caller, message, attestation) -> bool

// ...but INTO Stellar we don't call receive_message directly. We call our
// forwarder, which calls it for us and pays out to the G-account:
Stellar  CctpForwarder.mint_and_forward(message, attestation)
```

- "Every destination takes the message plus Circle's attestation, verifies the
  signature, and mints. The only twist is Stellar inbound, where we wrap that in
  `mint_and_forward` so the same call also does the last hop to a G-account —
  which is the next section."

Two vocabulary items that might help us, because they can trip up developers:

- (SLIDE) **Domains, not chain IDs.** CCTP has its own address space for chains
  called _domains_. Ethereum is 0, Solana is 5, Base is 6, Arc is 26, **Stellar
  is 27.** A domain is _not_ an EVM chainId (Arc's chainId is 5,042,002; its
  domain is 26). Every "which chain" field in a CCTP message is a domain.
- (SLIDE) **Fast vs Standard.** CCTP V2 lets you trade finality for speed via a
  `minFinalityThreshold`: **2000 = Standard** (wait for hard finality), **1000 =
  Fast** (Circle attests earlier, for a small fee, backed by Circle's
  guarantee). We'll see the actual number go over the wire in the demos.
  (CAVEAT) Fast is only meaningful when the _source_ is a slow-finality chain —
  hold that thought for the Solana demo.

Transition: "That's the protocol in the abstract. The moment you point it at
Stellar, two Stellar-specific realities show up that you _have_ to design around
— and one of them will happily torch your funds if you get it wrong."

## 3. Stellar realities: the Forwarder & hook data (6 min)

**Point:** Two things could bite you on Stellar specifically: (1) a CCTP mint
can't safely target a G address directly, so inbound transfers route through a
**Forwarder contract**; (2) the recipient's real address rides in **hook data**,
and its byte layout is unforgiving.

### 3a. Why inbound-to-Stellar needs a Forwarder

- On EVM chains, a mint recipient is just a 20-byte address — could be an EOA or
  a contract, the mint doesn't care. On Stellar, CCTP's contracts mint to a
  **contract address (C...)**, and the `mintRecipient` field is a raw 32-byte
  key.
- The problem: a CCTP message **can't distinguish a G address from a C
  address**, and the mint path expects a contract it can call into. If you
  naïvely put a bare **G address** in `mintRecipient`, the funds land somewhere
  that can't receive them — (CAVEAT) **you brick the transfer.** This is the
  single most dangerous mistake in the whole integration.
- The fix: every inbound-to-Stellar transfer mints to a **`CctpForwarder`**
  contract (`CA66...4VSZ`), and the _real_ G address recipient travels in the
  message's **hook data**. The Forwarder mints to itself and then pays out to
  the G address atomically. On Stellar that's a single call:
  `mint_and_forward(message, attestation)` — it's permissionless, the caller
  just pays the Stellar transaction fee.
- Mental model for this room: it's the same reason you can't `payment` an asset
  to a G address without a trustline — the destination has to be _prepared_ to
  receive. The Forwarder is the thing that's already prepared, and it does the
  last hop for you.

### 3b. Hook data — the most important bytes in the repo

(SLIDE) Show the layout with the comment straight from
`src/lib/stellar/recipient.ts`:

```text
mint_recipient  = CctpForwarder contract        (32 bytes)
hook_data:
  bytes 0–23   : 24 reserved "magic" bytes (zeros)
  bytes 24–27  : version   (uint32, currently 0)
  bytes 28–31  : length of the recipient strkey (uint32)
  bytes 32+    : the G-address, as a UTF-8 strkey  ("GB...")
```

```ts
// src/lib/stellar/recipient.ts — encodeStellarForwarderHookData()
export function encodeStellarForwarderHookData(stellarStrkey: string): Hex {
    if (!StrKey.isValidEd25519PublicKey(stellarStrkey)) {
        throw new Error(`Invalid Stellar account: ${stellarStrkey}`);
    }
    const magic = pad('0x', { size: 24 });
    const version = pad(toHex(0), { size: 4 });
    const recipientHex = stringToHex(stellarStrkey);          // the "GB..." strkey, as UTF-8
    const lengthField = pad(toHex((recipientHex.length - 2) / 2), { size: 4 });
    return concatHex([magic, version, lengthField, recipientHex]);
}
```

- "Note it's the strkey _as UTF-8 text_ — the literal `GB...` string — not the
  decoded 32-byte key. That surprised me. It's Circle's chosen convention for
  Stellar, and if you send the decoded bytes instead, the Forwarder can't parse
  it and the funds are stuck." (CAVEAT) "I validate the strkey _before_ building
  the burn, because there's no undo."
- (CAVEAT) **This is why a Stellar-destination burn MUST use the _with-hook_
  variant.** The G-address exists _only_ in the hook — a plain
  `deposit_for_burn` has nowhere to carry it. Your two hookless options both
  lose funds: put a G-address in `mintRecipient` and it bricks (§3a); put the
  Forwarder in `mintRecipient` with no hook and the Forwarder has no recipient
  to pay out to (the Soroban TMM literally errors `HookDataEmpty`). So: **into
  Stellar, always `depositForBurnWithHook`.** We'll see this hold on both the
  EVM and Solana sources.
- (SLIDE / link) Circle's own writeup of this — the Stellar
  recipient-in-hookData convention, and the "set `mintRecipient` to a user
  account and funds are permanently stuck" warning — is at
  [developers.circle.com/cctp/references/stellar](https://developers.circle.com/cctp/references/stellar).
  (Their docs also note **muxed `M` addresses** are a flavor of G account — same
  rule applies, they can't be a direct `mintRecipient`.)

### 3c. Three address encodings, one concept

(SLIDE) A small table — this is a great "other chains are weird" moment for a
Stellar audience:

| Destination | What goes in `mintRecipient` | Encoding |
| ----------- | ---------------------------- | -------- |
| EVM | the 20-byte EOA/contract address | **right-aligned** in 32 bytes (`leftPad32FromHex`) |
| Solana | the recipient's **USDC ATA**, not the wallet | raw 32 bytes, **left-aligned** (a Solana pubkey already fills 32) |
| Stellar | the **Forwarder contract**, real recipient in hook data | strkey decoded to raw 32 bytes (`strkeyToBytes32`) |

- One-liner for the room: "Every chain has a 32-byte slot and its own opinion
  about how to fill it. EVM right-pads a short address, Solana hands you a token
  account, Stellar makes you go through a forwarder. Same field, three
  conventions."
- The Solana one is worth flagging now: on Solana you don't own USDC at your
  wallet address — you own it in an **Associated Token Account (ATA)** derived
  from your wallet + the mint. The burn's recipient must be that **ATA**, not
  the wallet. We'll see that later on.

Transition: "There's one more piece Circle offers that makes the destination
side transaction disappear entirely — the forwarding service — and it's the
thing I spent a week bugging Circle support about."

## 4. The forwarding service (4 min)

(SLIDE / link) The forwarding service, in Circle's words, plus the docs URL:
[developers.circle.com/cctp/concepts/forwarding-service](https://developers.circle.com/cctp/concepts/forwarding-service).

**Point:** Circle's optional **Crosschain Forwarding Service** is a _relayer_:
you flag a burn as forwarded, and Circle performs the destination mint for you.
The recipient needs nothing on the destination chain — no gas, no manual
`receiveMessage`.

Talking points:

- Recap the plain flow's friction: normally _someone_ has to take the
  attestation to the destination and pay to submit the mint.
  - For a recipient who has no gas token on the destination chain, that's a real
    onboarding wall.
  - For a developer trying to provide a frictionless experience for their users,
    that's also something to consider and perhaps engineer around.
- The forwarding service removes it: you set a small forward fee on the burn and
  tag the message with a **`cctp-forward` marker in the hook data**, and
  Circle's relayer watches for the attestation and submits the mint itself. From
  the recipient's side, USDC just _appears_ on the destination chain.
- **Who receives it doesn't change.** The recipient is still the ordinary
  **`mint_recipient`** from the  burn arguments — the same field as any transfer
  (padded EVM address, Solana ATA, etc.). The relayer just delivers to that
  `mint_recipient`, minus its fee. The `cctp-forward` hook carries _no
  additional information_. It's purely a flag that says "please forward this for
  me."
- In the code that's my `encodeCctpForwardHookData()` function — a 24-byte
  reserved region carrying the ASCII tag `cctp-forward`, then version 0, length
  0, plus a slightly larger `maxFee` to cover the relayer cost.
  `fetchForwardFee` gets that fee from the Iris fee endpoint with
  `?forward=true`. On the app side there's _no_ destination step at all — we
  just poll the `mint_recipient`'s balance until the relayer's mint lands.
  (CAVEAT) One gotcha: the relayer consumes ~the _full_ `maxFee` (unlike plain
  CCTP, where it usually takes less), so size `maxFee` to the quote — padding is
  paid, not refunded. Also `destinationCaller` **must be zero**: setting it
  _disables_ forwarding.

(CAVEAT) **The honest status — say this plainly, it's the point of the story:**

- **Forwarding works for Stellar as a _source_ (origin), to both EVM and
  Solana.** Verified end-to-end: **Stellar→Arc** and **Stellar→Base** (via both
  the raw `deposit_for_burn_with_hook` and the wrapper
  `approve_and_deposit_with_hook` paths), and **Stellar→Solana** (burn
  `0d4fcd21…dc0b09aa` → Iris `forwardState: COMPLETE` → relayer mint finalized
  on Solana devnet, no user tx). Stellar-source is the piece that had to get
  fixed.
- **Forwarding does _not_ work for Stellar as a _destination_.**
  Inbound-to-Stellar transfers still return a _"destination does not support
  forwarding"_ error. So inbound always uses our own `CctpForwarder` contract
  and `mint_and_forward` function; the two "forwarders" are unrelated — one is
  Circle's hosted relayer service, one is our Stellar smart contract.
- (CAVEAT) **Docs lag reality on which routes forward.** Circle's published
  destination list (Arbitrum, Avalanche, Base, Ethereum, and a dozen more EVM
  chains) doesn't yet name Solana — but the sandbox relayer _does_ service
  Stellar→Solana, as the verified transfer above shows. Same story as
  Stellar-source itself before 2026-07-09: the route worked before the docs
  admitted it. So trust an end-to-end test over the published table — and the
  one direction that genuinely doesn't work is forwarding _into_ Stellar.

Transition: "Enough concept. Let's make money move. First one: Stellar out to
Arc — the plain, unbundled version, so we can read the actual burn arguments."

## 5. Demo A — Stellar ↔ Arc: raw, walkthrough, wrapper (12 min)

> Full click-by-click choreography + fallback is in `runbook.md`. This section
> is what to _say_ while you drive.

**Point (the whole of Demo A):** One burn, shown three ways — first the plain
unbundled version so we can read the real `deposit_for_burn` args (5a), then the
~40-line Soroban contract that bundles it (5b), then the same burn through that
contract as a single Freighter prompt (5c). The arc is: _here are the args →
here's the trick → here's the payoff._

### 5a. The raw path — "2 tx (direct)"

**Point:** The plain, unbundled CCTP burn — two Freighter prompts — is the
clearest place to read the real `deposit_for_burn` arguments off the wire.

- (DEMO) Pick **Stellar → Arc**, flow **2 tx (direct)**, small amount.
- Narrate the two prompts: "First Freighter prompt is an **`approve`** — I'm
  giving the **TokenMessengerMinter** contract an allowance to pull my USDC.
  Second prompt is the actual **`deposit_for_burn`**." Note _why_ the approve is
  even needed: "the CCTP contract pulls the funds with `transfer_from` on the
  USDC SAC, not `transfer` — so, just like an EVM ERC-20, I have to grant an
  allowance first. That's the whole reason there are two steps here, and the
  whole thing the wrapper is going to collapse."
- (SLIDE) Put the `deposit_for_burn` args on screen and read them off as the tx
  builds. This is the "in-depth arg description" the room asked for:

```rust
// deposit_for_burn on the TokenMessengerMinter — the values this Stellar→Arc burn sends
// (mint_recipient / usdc / destination_caller are prepared just above as typed bindings)
tmm.deposit_for_burn(
    &caller,               // Address    — your G-account (the depositor)
    &50_000_000,           // i128, 7 dp — amount: 5.00 USDC in Stellar subunits
    &26,                   // u32        — destination_domain: Arc (NOT chainId 5_042_002)
    &mint_recipient,       // BytesN<32> — your EVM address, right-aligned into 32 bytes
    &usdc,                 // Address    — burn_token: the USDC SAC (CBIE…DAMA)
    &destination_caller,   // BytesN<32> — 0x00…00 = anyone may submit the mint (permissionless)
    &100_000,              // i128, 7 dp — max_fee: $0.01 ceiling (Fast only; unused at Standard)
    &2_000,                // u32        — min_finality_threshold: 2000 = Standard
);
```

- Points to make while it's on screen:
  - **`destination_caller = 0`** → "I'm not restricting who submits the mint on
    the far side. Anyone with the attestation can. That's what makes the raw
    `receiveMessage` permissionless."
  - **`mint_recipient`** → "That's my EVM address, right-padded into 32 bytes."
  - **`amount` decimals** → "7 decimals here on Stellar; USDC is 6 decimals on
    EVM and Solana. The protocol carries an integer; the demo handles the dp
    conversion. Easy to get wrong."
- (DEMO) Burn submits → **attestation poll** (call out the Iris URL shape:
  `/v2/messages/26?transactionHash=...` — keyed by _source domain + burn tx
  hash_, not a nonce) → **`receiveMessage`** on Arc's MessageTransmitter → USDC
  lands. On Arc this is seconds.

Transition: "That was two prompts. To get it down to one, I lean on a wrapper
contract — and it's only ~40 lines of Rust, so before we run the one-prompt
version, let's actually read it."

### 5b. Wrapper walkthrough — the Soroban contract

**Point:** The wrapper is small, and every line maps to a concept we've already
covered. It's also the clearest illustration of Soroban's auth model vs the EVM
`approve` dance.

(SLIDE) The whole function — `contracts/stellar/cctp-wrapper/src/lib.rs`:

```rust
pub fn approve_and_deposit(
    env: Env,
    caller: Address,
    usdc: Address,
    tmm: Address,
    amount: i128,
    destination_domain: u32,
    mint_recipient: BytesN<32>,
    destination_caller: BytesN<32>,
    max_fee: i128,
    min_finality_threshold: u32,
) {
    caller.require_auth();

    // approve an allowance so the TokenMessengerMinter can transfer_from our caller
    let expiration_ledger = (env.ledger().sequence() + 50).next_multiple_of(50);
    token::Client::new(&env, &usdc).approve(&caller, &tmm, &amount, &expiration_ledger);

    let tmm_client = TmmClient::new(&env, &tmm);
    tmm_client.deposit_for_burn(
        &caller, &amount, &destination_domain, &mint_recipient,
        &usdc, &destination_caller, &max_fee, &min_finality_threshold,
    );
}
```

Walk it line by line (this is where the room's Stellar fluency pays off):

- **`caller.require_auth()`** → "One auth assertion. Because the inner `approve`
  and the inner `deposit_for_burn` both act _on behalf of_ `caller`, Soroban's
  auth framework requires `caller`'s signature to cover this whole tree — and
  Freighter collects it in one prompt. On EVM there's no equivalent; `approve`
  and the burn are two separate transactions from the EOA, full stop, unless you
  add a contract or use a newer wallet batching standard. Which we can cover in
  a second."
- **`token::Client::new(&env, &usdc).approve(...)`** → "Standard SEP-41
  `approve`. I set the allowance's `expiration_ledger` to the next multiple of
  50 ledgers out, this is mainly to avoid any weird mismatches between the
  current ledger number between simulation and submission of the transaction.
  The exact ledger expiration doesn't matter so much here, since the entirety of
  the allowance will be used up in the burn, anyway."
- **`TmmClient::new(&env, &tmm).deposit_for_burn(...)`** → "A cross-contract
  call into Circle's **TokenMessengerMinter**. `TmmClient` is a typed interface
  I generated from the contract — same idea as `stellar contract bindings
  typescript`, but Rust-to-Rust. The args are exactly the ones we just read off
  the page in the demo."
- Design notes worth stating out loud (this room appreciates the _why_):
  - "The USDC only ever passes _through_ the wrapper within this one call — it
    holds no balance between invocations. Nothing to drain."
  - "`usdc` is an argument here because I'm just following the pattern the
    TokenMessengerMinter contract itself uses — the USDC SAC address is one of
    _its_ arguments too. `tmm` I passed through because I'm honestly not sure
    how _permanent_ Circle's contract addresses are; if the TMM address ever
    changes, I didn't want to either redeploy this wrapper or bake in a
    `set_tmm(...)` function for the contract. Passing it per-call sidesteps
    both." (CAVEAT) "The flip side is the frontend has to supply trusted
    addresses, so for mainnet you'd probably want to pin or govern these rather
    than trust the caller. For a testnet demo, passing them like this is just me
    being pragmattic."
  - There's a second method, `approve_and_deposit_with_hook`, identical but with
    a trailing `hook_data: Bytes` — that's what the forwarding demo uses.

**If time — the EVM wrapper comparison**
(`contracts/evm/cctp-wrapper/src/CctpWrapper.sol`):

- (SLIDE) Its one function `bridgeWithPermit(...)` bundles **four** calls:
  `usdc.permit(...)` → `transferFrom` → `approve` → `depositForBurnWithHook`.
- The contrast is the story: "On Stellar, one signature authorizes a sub-tree —
  no extra primitive needed. On EVM, to get to one signature I need **EIP-2612
  `permit`**: the user signs a _typed message_ off-chain granting the allowance,
  and the contract redeems that signature on-chain. Same UX goal — one
  signature, one tx — but Stellar gets there much easier while EVM needs a
  signed-permit dance baked into both the token and the wrapper." (CAVEAT) "And
  `permit` only works because USDC implements EIP-2612. Not every ERC-20 token
  does."

Transition: "So that's the contract. Now watch what those ~40 lines do to the
user experience — same burn, one prompt."

### 5c. The wrapper path — "1 tx (wrapper)"

**Point:** Same burn, same args as 5a — but routed through the wrapper we just
read, it collapses to a single signature. This is the UX payoff, and a showcase
of what Soroban's auth model buys you.

- (DEMO) Same direction (**Stellar → Arc**), flip to **1 tx (wrapper)**, same
  amount.
- "Watch the prompt count." → **One** Freighter signature. Done.
- "Same two operations happened on-chain — the `approve` _and_ the
  `deposit_for_burn`. But they're now inner calls inside one invocation of my
  wrapper contract's `approve_and_deposit`. Soroban's authorization tree lets me
  authorize the whole sub-tree from a single signature, so the user sees one
  prompt and pays one network fee."
- (CAVEAT) "To be clear about what this is and isn't: it's not cheaper _gas_ in
  the EVM sense, and it's not doing anything cryptographically clever — it's
  bundling. But for a wallet UX, one prompt vs two is the difference between
  'this feels like an app' and 'this feels like a blockchain.'"
- (DEMO) The destination side is identical to 5a — attest, then `receiveMessage`
  on Arc. Nothing new here; the whole delta was the burn.

Transition: "So that's the outbound-from-Stellar story. Let's turn it around —
come _into_ Stellar from EVM — where we get to see the Forwarder do its job and
see three different ways to make one burn happen."

## 6. Demo B — EVM → Stellar, three burn flows (7 min)

**Point:** Coming _into_ Stellar, the destination side is always
`mint_and_forward` through our Forwarder. The interesting variation is on the
_burn_ side, where we have three ways to bundle `approve` + burn — a nice tour
of the EVM UX ladder.

### 6a. The invariant, up front

(SLIDE) From `src/lib/evm/cctp.ts` — the burn tuple for _any_ Stellar-bound
transfer:

```ts
burnArgs = [
  amount,             // uint256, 6 dp
  27,                 // destinationDomain = Stellar
  forwarderBytes32,   // mintRecipient    = CctpForwarder  ← must be the forwarder
  cfg.usdc,           // burnToken (per-chain USDC)
  forwarderBytes32,   // destinationCaller = CctpForwarder ← MUST equal mintRecipient
  maxFee,
  finalityThreshold,
  hookData,           // encodeStellarForwarderHookData(yourGAddress)
]
```

- "Two things must be true or funds are lost: `mintRecipient` is the
  **Forwarder** (not your G address), and `destinationCaller` **equals**
  `mintRecipient`. Setting `destinationCaller` to the Forwarder means _only the
  Forwarder_ can submit the mint — which is what guarantees the
  `mint_and_forward` payout logic actually runs, instead of someone minting to
  the Forwarder and stranding the funds there."
- "And your real recipient (your G address) is in `hookData`, encoded the way we
  saw." Which is also why this is `depositForBurn**WithHook**` and never the
  plain variant — same rule as §3b, now from the EVM side: no hook, no
  recipient, lost funds.

### 6b. Three burn flows (show at least two live)

(SLIDE) The comparison table:

| Flow | User sees | On-chain txs | Needs |
| ------ | ----------- | -------------- | ------- |
| **2 tx (direct)** | 2 confirmations | 2 | nothing extra — plain CCTP |
| **1 tx (permit)** | 1 signature + 1 confirmation | 1 | our `CctpWrapper` deployed on this chain |
| **1 click (sendCalls)** | 1 confirmation | 1 atomic (or 2 sequential) | wallet supports EIP-5792 |

- (DEMO) **2 tx (direct):** MetaMask pops **`approve`**, then
  **`depositForBurnWithHook`**. "This is the EVM baseline — two transactions,
  because an EOA can't do both atomically."
- (DEMO) **1 tx (permit):** "One signature — no gas, it's just signing a typed
  `Permit` message — then one transaction into our EVM wrapper. That's the
  Solidity `bridgeWithPermit` we looked at. Half the gas of the 2-tx path."
- **1 click (sendCalls)** — describe, demo only if the wallet cooperates: "This
  is **EIP-5792 `wallet_sendCalls`** — I hand the _wallet_ both calls and let
  _it_ batch them. On a smart wallet or an EIP-7702 account it's one atomic
  on-chain tx; on a plain EOA the wallet still shows one prompt but submits two
  txs behind it. The chip auto-disables if the wallet doesn't advertise the
  capability." (CAVEAT) "This one's the most wallet-dependent, so if it doesn't
  light up live, that's expected — it's a capability probe, not a bug."
- (DEMO) Destination side, always the same: poll Iris →
  **`mint_and_forward(message, attestation)`** on the Forwarder → USDC lands at
  your G address. "No `receiveMessage` for me to call by hand — the Forwarder
  contract is the thing that mints and pays out, in one Soroban call."

Transition: "Two chains down. Let's add the weird one — Solana — because it
breaks one of the assumptions I've been repeating this whole talk."

## 7. Demo C — Solana both ways + the custody twist (5 min)

**Point:** Solana works in both directions, but it quietly violates
"burn-and-mint" on the receive side, and it's the one place where
Fast-vs-Standard actually _doesn't_ do what you'd expect from a Stellar source.

### 7a. Solana → Stellar (burn on Solana)

- (DEMO) Direction **Solana → Stellar**. "Notice: **no approve step.** On
  Solana, `depositForBurn` burns directly under the owner's signature via a
  cross-program invocation — so it's a single burn transaction, plus one
  throwaway co-signer keypair for the event account."
- (SLIDE) What's different about the Solana burn:
  - "~15 accounts and several **PDAs** — program-derived addresses — have to be
    supplied. I don't hand-roll those; I generate a typed client from Circle's
    Anchor **IDL** using Codama. It's the Solana analog of `stellar contract
    bindings typescript`: interface description in, typed
    `getDepositForBurnWithHookInstruction({...})` out."
  - Same into-Stellar invariant as EVM: `mintRecipient == destinationCaller ==`
    the Forwarder, real G address in `hookData`.
- (DEMO) Then the Stellar side is the _identical_ `mint_and_forward` you saw in
  Demo B. "The mint side was literally zero new Stellar code — that's the payoff
  of routing everything through the Forwarder."

### 7b. Stellar → Solana, and the custody twist

- (DEMO) Direction **Stellar → Solana**. Burn on Stellar (`deposit_for_burn`,
  `destination_domain = 5`), `mint_recipient` = **the recipient's USDC ATA as
  raw 32 bytes** (from §3c). Then a `receiveMessage` on Solana.
- (SLIDE)(CAVEAT) **The twist — say this clearly, it's a genuinely interesting
  protocol detail for this room:**
  - "On Solana, the receive is **not a mint.**
    `handle_receive_finalized_message` **transfers USDC out of a shared
    `custody_token_account` that Circle pre-funds** on Solana — and pays a fee
    out of it too. There's no `mint_to` in the instruction's account list at
    all."
  - "So on Solana, 'burn-and-mint' is really 'burn-and-_release-from-custody_.'
    Circle keeps a float of already-minted USDC sitting in custody waiting to be
    handed out. It's an implementation detail of how CCTP maps onto Solana's
    token model — but it means a Solana receive can fail for a reason your code
    can't cause: **if Circle's custody is underfunded on devnet, the transfer
    reverts.** That's their liquidity, not our bug."
  - Clarify the scope, since it's easy to misread: there's **one custody account
    per local USDC mint** (seed `["custody", mint]`) — a single shared float
    that backs _every_ inbound transfer into Solana, regardless of which chain
    it came from. The things that _are_ per-source-domain are the
    `token_pair(27, …)` and `remote_token_messenger(27)` registrations (which is
    why I pre-checked those two exist on devnet for domain 27 — Stellar).
    Custody funding is the remaining variable Circle controls.

### 7c. Fast vs Standard, honestly

- (SLIDE)(CAVEAT) "Every flow has a Fast/Standard toggle, and it maps to the
  `minFinalityThreshold` — 1000 vs 2000 — that you saw in the arguments.
  **But:** when the _source_ is Stellar, Circle attests at the Standard
  threshold regardless of what we request, because Stellar is already a
  fast-finality chain — Circle literally lists Fast Transfer as _N/A_ for
  Stellar. So Fast only does something observable when the source is a slower
  chain like Base. From Stellar, the toggle is effectively cosmetic — I left it
  in so the parameter is _visible_, but I'd be lying if I said it changed the
  Stellar-origin timing."

Transition: "Last one, quick — the forwarding service we talked about, live, so
you can see the destination step _disappear_."

## 8. Demo D — forwarding live (Stellar → EVM) (2 min)

**Point:** With forwarding on, there's no destination step in the app at all —
Circle's relayer mints, and we just watch the balance change.

- (DEMO) **Stellar → Arc**, forwarding **on**. Point out two differences in the
  burn:
  - hook data now carries the **`cctp-forward`** flag
    (`encodeCctpForwardHookData`) — no address; the recipient is still the
    ordinary `mint_recipient` (my EVM address), the relayer just delivers to it.
  - `maxFee` is bumped to cover the relayer (from the `?forward=true` fee
    quote), and `destination_caller` is zero (setting it would disable
    forwarding).
- (DEMO) Submit the burn... and then **nothing to click.** "Normally here I'd
  poll for the attestation and submit the mint. With forwarding, I just poll the
  destination balance — Circle's relayer takes the attestation and mints for me.
  There it is." USDC appears on Arc with no second signature.
- (CAVEAT) Repeat the directional asterisk once: "This is Stellar as a _source_
  — which works to EVM _and_ Solana destinations; I've landed both. The one
  direction that still refuses is forwarding _into_ Stellar — that half isn't
  shipped."

Transition: "Let me bring it back together."

## 9. Recap + honest limitations (1 min)

(SLIDE) Recap in one breath:

- CCTP = **burn → attest → mint**, canonical USDC both sides, no wrapped token,
  no pool.
- Stellar specifics: inbound routes through the **Forwarder** because a raw G
  address bricks funds; the recipient rides in **hook data** (so it's always
  `depositForBurnWithHook`); **domain 27**.
- A **wrapper contract** collapses approve+burn into one signature — trivially
  on Soroban via the auth tree, and on EVM only via `permit`.
- **Forwarding** removes the destination step — for Stellar as a _source_ (to
  EVM or Solana), today.
- Solana is real, but **receives from custody**, not a fresh mint.

(SLIDE)(CAVEAT) "What this is _not_, so nobody quotes me wrong:"

- Testnet only. USDC only (EURC isn't confirmed on Stellar CCTP yet).
- Transfer history is in-memory — refresh wipes it. It's a demo, not a bridge
  product.
- Forwarding _into_ Stellar isn't shipped, and a couple of the wallet-batching
  paths are best-effort / chain-dependent.
- "The code's all open — take it, break it, and tell me where it's wrong."

"Thanks — questions?"

## Voice reminders (for you, not the slides)

- Second person, warm, "we'll", "you'll". It's colleagues, not a keynote.
- The caveats are the credibility. Don't smooth over the Solana custody thing,
  the Fast-is-cosmetic-from-Stellar thing, or the forwarding directional
  asterisk — those are the details this room will _respect_ you for naming.
- When you hit a byte-layout slide, it's fine to say "get this wrong and you
  lose funds" — it's true, and it lands.
