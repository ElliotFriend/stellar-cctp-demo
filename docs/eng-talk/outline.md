# CCTP on Stellar: Speaker Outline

Dense, scannable companion to `script.md`. The script is what to _say_; this is
what to _glance at_ while you're saying it. Every section carries its time box,
the one point, and the beats in order.

Markers match the script: `(SLIDE)` a slide cue, `(DEMO)` a live-demo handoff,
`(CAVEAT)` an honesty beat worth not skipping, `(CUT)` a safe cut if you're long.

**Total:** 46 min as boxed, against a 45 min budget, plus 15 min Q&A. Demos are
roughly half the talk. **These boxes are guesses and haven't been rehearsed
against a clock yet**, so treat the whole column as provisional. §9 is the one
already known to be light at its old 1 min.

| # | Section                          | Min | Cum |
| - | -------------------------------- | --- | --- |
| 1 | Cold open                        | 2   | 2   |
| 2 | Mental model: burn, attest, mint | 6   | 8   |
| 3 | Stellar realities                | 6   | 14  |
| 4 | Forwarding service               | 4   | 18  |
| 5 | **Demo A** Stellar and Arc       | 12  | 30  |
| 6 | **Demo B** EVM to Stellar        | 7   | 37  |
| 7 | **Demo C** Solana both ways      | 5   | 42  |
| 8 | **Demo D** forwarding live       | 2   | 44  |
| 9 | Recap                            | 2   | 46  |

**If you're running long, cut in this order:** the EVM wrapper comparison in 5b,
then Demo D. You'll already have shown the wrapper concept on Stellar in 5b/5c,
and the forwarding concept in §4.

---

## 1. Cold open (2 min)

- (SLIDE) **Three ways to move a dollar.**
- You have USDC on chain A, you want USDC on chain B.
- **Lock-and-mint:** lock on A, mint a _wrapped_ representation on B. This is
  Wormhole's portal bridge.
- **Liquidity pool:** deposit into an LP on A, withdraw from the corresponding
  LP on B. This is Allbridge Core.
- Both leave a big pile of USDC sitting idle. That pile grows into a honeypot,
  and honeypots attract exploits.
- **Burn-and-mint:** burn the real USDC on the source, Circle authorizes a
  mint of _native, canonical_ USDC on the destination. Same issuer, same
  asset, both sides.
- Stellar is a CCTP V2 destination _and_ source as of **May 2026**.
- Preferred path for canonical USDC on and off Stellar. No anchor, no
  third-party bridge in the middle.
- (SLIDE) **"Burn here. Mint there. Same asset."**

**Transition:** So how does chain B know it's allowed to mint? Three moving
parts.

## 2. Mental model: burn, attest, mint (6 min)

- (SLIDE) **Three-box diagram:** source chain, Circle (Iris), destination chain.
- **1. Burn.** `deposit_for_burn` on **TokenMessengerMinter** (Stellar's name;
  EVM calls it TokenMessengerV2, Solana TokenMessengerMinterV2). Burns your USDC,
  emits a structured message into **MessageTransmitter(V2)** (a generic
  cross-chain message bus).
  - The message says: _N units burned on domain X, for recipient R on domain Y._
  - One breath on the three names, then use each chain's own spelling.
- **2. Attest.** Circle's off-chain service (**Iris**) watches for the burn,
  waits for source finality, then issues a signed attestation. You poll for it.
  - Seconds on Arc. Up to ~20 minutes on Ethereum and most of its L2s.
  - Fun one: StarkNet takes **4 to 8 hours** to reach finality.
  - You're waiting on finality, not on Circle.
- **3. Mint.** Hand `(message, attestation)` to **MessageTransmitter(V2)** on the
  destination. It verifies Circle's signature, then calls the local minter.
  - EVM has a separate **TokenMinterV2**. On Stellar, **TokenMessengerMinter**
    does both burn and mint.
- (SLIDE) **Two burn entrypoints.** `deposit_for_burn` vs
  `deposit_for_burn_with_hook`.
  - Strict superset: same arguments, plus `hook_data`.
  - `hook_data` is essentially how you say something to the destination chain.
  - Hold onto this: On Stellar-inbound it's mandatory, not optional.
- (SLIDE) **Mint side is the same shape everywhere:** `(message, attestation)`.
  - The one twist is Stellar inbound, where `mint_and_forward` does the last hop
    to the _actual_ recipient.
- (SLIDE) **Domains, not chain IDs.** CCTP has its own address space.
  - Ethereum `0`, Solana `5`, Base `6`, Arc `26`, **Stellar `27`**.
  - A domain is _not_ a `chainId`. Arc's chainId is `5,042,002`, its domain is
    `26`.
- (SLIDE) **Fast vs Standard**, via `minFinalityThreshold`.
  - `2000` = Standard (wait for hard finality).
  - `1000` = Fast (Circle attests earlier, small fee, Circle's guarantee).
  - (CAVEAT) Fast only means something when the _source_ is slow. Hold that for
    the Solana demo.

**Transition:** That's the protocol from a high level. Point it at Stellar and
two Stellar-specific realities show up, one of which will happily torch your
funds.

## 3. Stellar realities (6 min)

### 3a. Why inbound needs a Forwarder

- (SLIDE) **Why a raw Stellar address can't be the `mintRecipient`.**
- On EVM, a mint recipient is a 20-byte address. EOA or contract, the `mint`
  doesn't care.
- On Stellar, CCTP mints to a **contract address (`C...`)**, and `mintRecipient`
  is a raw 32-byte key.
- A CCTP message **can't distinguish a G address from a C address**, and the
  `mint` path expects a contract it can call into.
- (CAVEAT) Put a bare G address in `mintRecipient` and the funds land somewhere
  that can't receive them. **You brick the transfer.** Single most dangerous
  mistake in the integration.
- (SLIDE) **The fix: Circle's Forwarder contract.**
- Inbound mints to **`CctpForwarder`** (`CA66...4VSZ`). The real recipient
  travels in **hook data**.
- The Forwarder mints to itself, then pays out to the real recipient atomically.
  - Per Circle's docs the payout target can be G, C, or M. The demo only encodes
    **G**, so hedge: documented, not tested by me. (Revisited in §9.)
- One call: `mint_and_forward(message, attestation)`. Permissionless, caller
  pays the Stellar fee.
- **Analogy for this room:** same reason you can't `payment` an asset to a G
  address with no trustline. The destination has to be _prepared_ to receive.

### 3b. Hook data, the most important bytes in the repo

- (SLIDE) **Byte layout.** `mint_recipient` is the Forwarder (32 bytes).
- Then `hook_data`:
  - bytes `0-23`: reserved, zeros (it's CCTP "magic" bytes)
  - bytes `24-27`: version (`u32`, currently `0`)
  - bytes `28-31`: length of the recipient strkey (`u32`)
  - bytes `32+`: the G address, as a **UTF-8 strkey** (`"GB..."`)
- (SLIDE) **`encodeStellarForwarderHookData()`**, from
  `src/lib/stellar/recipient.ts`.
- It's the strkey _as UTF-8 text_ (the literal `GB...` string), not the
  decoded 32-byte key.
- That surprised me. Circle's chosen convention for Stellar.
- Send decoded bytes instead and the Forwarder can't parse it. Funds stuck.
- (CAVEAT) I validate the strkey _before_ building the burn, because there's
  no undo.
- (SLIDE) **So a Stellar-destination burn MUST use the with-hook variant.**
- The recipient's address exists _only_ in the hook.
- Two hookless options, both lose funds:
  - G address in `mintRecipient`: bricks (3a).
  - Forwarder in `mintRecipient`, no hook: nothing to pay out to. Errors
    `HookDataEmpty`.
- **Into Stellar, always `deposit_for_burn_with_hook`.** Holds for EVM and
  Solana sources alike.
- (SLIDE / link) Circle's own writeup of the convention, including the
  "funds are permanently stuck" warning:
  `developers.circle.com/cctp/references/stellar`.
- Muxed `M` addresses are a flavor of G account, so the same rule applies.

### 3c. Three address encodings

- (SLIDE) **One 32-byte slot, three opinions.**
- **EVM:** the 20-byte address, right-aligned in 32 bytes.
- **Solana:** the recipient's **USDC ATA**, not the wallet. Raw 32 bytes,
  left-aligned.
- **Stellar:** **always** the Forwarder's `C...` id, decoded to its raw 32 bytes
  (`strkeyToBytes32`). The real recipient rides in hook data, and _that_ one is
  the UTF-8 strkey from 3b. Two fields, two opposite conventions.
- New vocab to introduce: on Solana you don't hold USDC at your wallet address,
  you hold it in an **Associated Token Account** derived from wallet plus mint.
- The burn's recipient must be that ATA.

**Transition:** One more piece from Circle makes the destination transaction
disappear entirely, and it's the thing I spent a week bugging Circle support
about.

## 4. The forwarding service (4 min)

- (SLIDE / link) The service in Circle's words, plus the URL:
  `developers.circle.com/cctp/concepts/forwarding-service`.
- (SLIDE) **The friction it removes.** Normally _someone_ has to take the
  attestation to the destination and pay to submit the mint.
- A recipient with no gas token on the destination hits a real onboarding
  wall.
- A developer wanting a frictionless UX has to engineer around it.
- (SLIDE) **How you turn it on.** Set a small forward fee, tag the message with
  a **`cctp-forward` marker** in hook data. Circle's relayer watches for the
  attestation and submits the mint.
- (SLIDE) **Who receives it doesn't change.** Still the ordinary
  `mint_recipient` from the burn args, minus the relayer's fee.
- The `cctp-forward` hook carries _no_ address. It's purely a flag.
- In code: `encodeCctpForwardHookData()`, plus `fetchForwardFee` hitting the
  Iris fee endpoint with `?forward=true`.
- No destination step in the app at all. Just poll the recipient's balance.
- (CAVEAT) **Two gotchas.**
  - The relayer consumes ~the _full_ `maxFee`. Padding is paid, not refunded.
  - `destinationCaller` **must be zero**. Setting it disables forwarding.
- (SLIDE)(CAVEAT) **The honest status.** Say this one plainly.
  - **Works out of Stellar**, to EVM and Solana. Verified end to end:
    Stellar to Arc, Stellar to Base (raw and wrapper paths), and Stellar to
    Solana.
  - **Does not work into Stellar.** Still returns _"destination does not support
    forwarding."_
  - So inbound always goes through the `CctpForwarder` from §3a.
  - Two unrelated Circle things share the name: the hosted **relayer service**
    (off-chain, this section) and the on-chain **Soroban `CctpForwarder`**. I
    wrote neither. Only the two `CctpWrapper`s are mine.

**Transition:** Enough concept. Let's make money move.

## 5. Demo A: Stellar and Arc (12 min)

> Click paths and fallbacks live in `runbook.md`.

### 5a. Raw path, "2 tx (direct)"

- (DEMO) **Stellar to Arc**, flow **2 tx (direct)**, small amount.
- **No slide here.** The signature was already on screen in §2. Narrate the real
  values off the live interface as the tx builds:
  - `caller`: your G address, the depositor.
  - `amount`: `50_000_000` is 5.00 USDC. **7 decimals on Stellar**, 6 on EVM and
    Solana. Protocol carries an integer; the demo converts. Easy to get wrong.
  - `destination_domain`: `26` for Arc. **Not** chainId `5_042_002`.
  - `mint_recipient`: your EVM address, right-aligned into 32 bytes.
  - `burn_token`: the USDC SAC address (`CBIE...DAMA`).
  - `destination_caller`: `0x00...00`, so **anyone** holding the attestation may
    submit the mint. That's what makes the raw `receive_message` permissionless.
    - Set it to a real address and the `mint` MUST come from that address, so
      that address pays the destination gas.
  - `max_fee`: `100_000`, a $0.01 ceiling. Only used on Fast.
  - `min_finality_threshold`: `2000`, Standard.
- Two Freighter prompts:
  - **`approve`**, giving TokenMessengerMinter an allowance on your USDC.
  - **`deposit_for_burn`**, the actual burn.
- _Why_ the approve exists: CCTP pulls with `transfer_from` on the USDC SAC, not
  `transfer`. So, you have to grant an allowance first.
- That's the whole reason there are two steps, and the whole thing the wrapper
  collapses.
- (DEMO) Burn, then poll Iris, then `receiveMessage` on Arc, then USDC lands.
  - Iris URL shape: `/v2/messages/26?transactionHash=...`, keyed by **source
    domain plus burn tx hash**.
  - Seconds on Arc.

**Transition:** That was two prompts. Getting to one takes about 40 lines of
Rust, so let's read it before we run it.

### 5b. Wrapper walkthrough

- (SLIDE) **The whole function**, `approve_and_deposit`.
- **`caller.require_auth()`**: one assertion.
  - Both inner calls act _on behalf of_ `caller`, so Soroban's auth framework
    needs `caller`'s signature to cover the whole tree.
  - Freighter collects that in **one prompt**.
  - No EVM equivalent. There, `approve` and the burn are two transactions from
    the EOA, full stop.
- **`approve(...)`**: standard SEP-41.
  - `live_until_ledger` rounded to the next multiple of 50, mostly to dodge
    ledger-number mismatches between simulation and submission.
  - The exact expiration hardly matters, since the burn consumes the whole
    allowance anyway.
- **`deposit_for_burn(...)`**: a cross-contract call into TokenMessengerMinter.
  - `TmmClient` is a typed interface generated from the contract. Generated with
    `stellar contract bindings rust`.
  - The args are exactly the ones we just read off the page.
- **Design notes** (this room appreciates the _why_):
  - USDC only passes _through_ the wrapper inside one call. It holds no balance
    between invocations, so there's nothing to drain.
  - `usdc` is an argument because that's the pattern TokenMessengerMinter itself
    uses.
  - `tmm` is an argument because I'm not sure how _permanent_ Circle's addresses
    are. Passing it per call avoids both a redeploy and a `set_tmm(...)`.
  - (CAVEAT) Flip side: the frontend supplies trusted addresses. For mainnet
    you'd pin or govern these. For a testnet demo, this is me being pragmatic.
  - There's a twin, `approve_and_deposit_with_hook`, for the forwarding demo.
- (CUT)(SLIDE) **EVM wrapper comparison**, `bridgeWithPermit(...)`:
  - Bundles **four** calls: `permit`, `transferFrom`, `approve`,
    `depositForBurnWithHook`.
  - The contrast is the story. On Stellar, one signature authorizes a sub-tree.
    On EVM you need **EIP-2612 `permit`**: user signs a typed message off-chain,
    contract redeems it on-chain.
  - Same UX goal, but Stellar gets there without a new primitive.
  - (CAVEAT) `permit` only works because USDC implements EIP-2612. Not every
    ERC-20 does.

**Transition:** Now watch what those 40 lines do to the user experience.

### 5c. Wrapper path, "1 tx (wrapper)"

- (DEMO) Same direction, same amount, flip to **1 tx (wrapper)**.
- Say "watch the prompt count" _before_ you click. **One** signature.
- Same two operations still happen on chain. They're now inner calls inside one
  invocation of `approve_and_deposit`.
- (CAVEAT) Be precise about what this is: not cheaper gas, not cryptographically
  clever. It's bundling. But one prompt vs two is the difference between "this
  feels like an app" and "this feels like a blockchain."
- (DEMO) Destination side is identical to 5a. The whole delta was the burn.

**Transition:** That's outbound. Let's turn it around and come _into_ Stellar.

## 6. Demo B: EVM to Stellar (7 min)

### 6a. The invariant, up front

- (SLIDE) **The burn tuple for _any_ Stellar-bound transfer.**
- Two things must be true or funds are lost:
  - `mintRecipient` is the **Forwarder**, not your G address.
  - `destinationCaller` **equals** `mintRecipient`.
- Why the second one: pinning `destinationCaller` to the Forwarder means **only
  the Forwarder** can submit the mint. That's what guarantees the
  `mint_and_forward` payout logic runs, instead of someone minting _to_ the
  Forwarder and stranding the funds there.
- Your real recipient is in `hookData`. Same rule as 3b, now from the EVM side:
  no hook, no recipient, lost funds.

### 6b. Three burn flows (show at least two live)

- (SLIDE) **Comparison table.**
  - **2 tx (direct):** 2 confirmations, 2 txs, nothing extra.
  - **1 tx (permit):** 1 signature plus 1 confirmation, 1 tx, needs our
    `CctpWrapper` on this chain.
  - **1 click (sendCalls):** 1 confirmation, 1 atomic tx (or 2 sequential),
    needs EIP-5792 support.
- (DEMO) **2 tx:** MetaMask pops `approve`, then `depositForBurnWithHook`. The
  EVM baseline, because an EOA can't do both atomically.
- (DEMO) **1 tx (permit):** one signature, no gas, just a typed `Permit`
  message. Then one transaction into the wrapper. Half the gas of the 2-tx path.
- **1 click (sendCalls):** describe it, demo only if the wallet cooperates.
  - **EIP-5792 `wallet_sendCalls`**: hand the _wallet_ both calls, let it batch.
  - Smart wallet or EIP-7702 account: one atomic tx. Plain EOA: one prompt, two
    txs behind it.
  - (CAVEAT) Most wallet-dependent path here. If the chip doesn't light up,
    that's expected. It's a capability probe, not a bug.
- (DEMO) Destination side, always the same: poll Iris, then `mint_and_forward`,
  then USDC at your G address. No `receiveMessage` by hand.

**Transition:** Two chains down. Now the weird one, because it breaks an
assumption I've been repeating all talk.

## 7. Demo C: Solana both ways (5 min)

### 7a. Solana to Stellar

- (DEMO) Direction **Solana to Stellar**. **No approve step.**
  - `depositForBurn` burns directly under the owner's signature via a
    cross-program invocation.
  - One burn transaction, plus a throwaway co-signer keypair for the event
    account.
- (SLIDE) **What's different about the Solana burn.**
  - ~15 accounts and several **PDAs** (program-derived addresses) go in.
  - I don't hand-roll them. Typed client generated from Circle's Anchor **IDL**
    with Codama, the Solana analog of `stellar contract bindings typescript`.
  - Same into-Stellar invariant: `mintRecipient == destinationCaller ==` the
    Forwarder, real G address in `hookData`.
- (DEMO) Stellar side is the _identical_ `mint_and_forward` from Demo B. Zero
  new Stellar code, which is the payoff of routing everything through the
  Forwarder.

### 7b. Stellar to Solana, and the custody twist

- (DEMO) Direction **Stellar to Solana**. `destination_domain = 5`,
  `mint_recipient` is the recipient's **USDC ATA as raw 32 bytes**.
- (SLIDE)(CAVEAT) **The twist.** Genuinely interesting protocol detail for this
  room.
  - On Solana the receive is **not a mint**.
    `handle_receive_finalized_message` transfers USDC out of a shared
    `custody_token_account` that Circle pre-funds, and pays its fee out of it
    too.
  - There's no `mint_to` in the instruction's account list at all.
  - So on Solana, "burn-and-mint" is really
    **burn-and-release-from-custody**. Circle keeps a float of already-minted
    USDC waiting to be handed out.
  - It's an implementation detail of how CCTP maps onto Solana's token model.
  - Nothing materially different for a developer, but a fun discovery.

### 7c. Fast vs Standard, honestly

- (SLIDE)(CAVEAT) Every flow has the toggle, mapping to `minFinalityThreshold`,
  `1000` vs `2000`.
- **But** when the source is Stellar, Circle attests at the Standard threshold
  regardless of what we ask for, because Stellar already has fast finality.
  Circle lists Fast Transfer as **N/A** for Stellar.
- So Fast only does something observable from a slower source.
- From Stellar the toggle is effectively cosmetic. I left it in so the parameter
  is _visible_, but I'd be lying if I said it changed Stellar-origin timing.

**Transition:** Last one, quick, so you can watch the destination step
_disappear_.

## 8. Demo D: forwarding live (2 min) (CUT)

- (DEMO) **Stellar to Arc**, forwarding **on**. Two differences in the burn:
  - Hook data carries the **`cctp-forward`** flag. No address. The recipient is
    still the ordinary `mint_recipient`.
  - `maxFee` bumped from the `?forward=true` quote, and `destination_caller`
    stays zero.
- (DEMO) Submit, then **nothing to click.**
  - Normally you'd poll for the attestation and submit the mint. Here you just
    poll the destination balance.
  - USDC appears on Arc with no second signature.
- (CAVEAT) Repeat the directional asterisk once: this is Stellar as a _source_,
  which works to EVM and Solana. Forwarding _into_ Stellar still isn't shipped.

**Transition:** Let me bring it back together.

## 9. Recap and honest limitations (2 min)

- (SLIDE) **In one breath:**
  - CCTP is **burn, attest, mint**. Canonical USDC on both sides, no wrapped
    token, no pool.
  - Inbound to Stellar goes through the **Forwarder**, because a raw G address
    bricks funds. The recipient rides in **hook data**, so it's always the
    with-hook variant. **Domain 27.**
  - A **wrapper contract** collapses approve plus burn into one signature.
    Trivially on Soroban via the auth tree, on EVM only via `permit`.
  - **Forwarding** removes the destination step, for Stellar as a _source_.
  - Solana is real, but it **receives from custody**, not a fresh mint.
- (SLIDE) **What's next for this demo?**
  - Smart accounts and muxed accounts for Stellar.
  - More chains (Avalanche, Polygon PoS, etc.).
  - A wrapper that does `usdc.trust(...)` plus `mint_and_forward` in one
    invocation.
  - On Solana, the forwarding service can create the recipient's ATA for them.
- (SLIDE)(CAVEAT) **What this is _not_,** so nobody quotes you wrong:
  - Testnet only.
  - Transfer history is in memory, so a refresh wipes it.
  - Forwarding into Stellar isn't supported by Circle.
  - A couple of the wallet-batching paths are best-effort and chain-dependent.
  - The code's all open. Take it, break it, and tell me where it's wrong.
- "Thanks, questions?"

## Quick reference (keep this on screen during Q&A)

**Domains:** Ethereum `0`, Solana `5`, Base `6`, Arc `26`, **Stellar `27`**.
Arc's chainId is `5,042,002`, which is not its domain.

**Finality thresholds:** `2000` Standard, `1000` Fast. Stellar-source always
attests at `2000`, because Fast is N/A for a fast-finality chain.

**Contracts (per chain, because the names differ):**

| Chain   | Burn + mint                            | Message bus                          |
| ------- | -------------------------------------- | ------------------------------------ |
| Stellar | `TokenMessengerMinter` (`CDNG...RTHP`) | `MessageTransmitter` (`CBJ6...VVJY`) |
| EVM     | `TokenMessengerV2` + `TokenMinterV2`   | `MessageTransmitterV2`               |
| Solana  | `TokenMessengerMinterV2`               | `MessageTransmitterV2`               |

Inbound-to-Stellar last hop is Circle's **`CctpForwarder`** (`CA66...4VSZ`). The
only contracts I deployed are the two **`CctpWrapper`s** (Soroban and Solidity).

**Iris:** sandbox `iris-api-sandbox.circle.com`.

- Messages: `GET /v2/messages/{srcDomain}?transactionHash={hash}`
- Fees: `GET /v2/burn/USDC/fees/{src}/{dst}` (add `?forward=true`)

**Forwarding status:** works out of Stellar to EVM and Solana. Blocked into
Stellar. `destinationCaller` must be zero, and the relayer consumes ~the full
`maxFee`.

**Docs:**

- `developers.circle.com/cctp/references/stellar`
- `developers.circle.com/cctp/concepts/forwarding-service`

**Voice reminders:** second person, warm, colleagues rather than a keynote. The
caveats _are_ the credibility, so don't smooth over the Solana custody detail,
the Fast-is-cosmetic-from-Stellar detail, or the forwarding directional
asterisk. Those are what this room will respect you for naming.
