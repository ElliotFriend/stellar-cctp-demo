# CCTP on Stellar: dev call cut (25 min, demo-first)

A demo-centric run for a 30 minute dev call. The app is on screen almost the
whole time. The deck (`docs/eng-talk/deck.html`) is an interstitial, not the
spine: you cut to a slide only where the thing being explained is **invisible on
screen** (byte layouts, the inbound invariant, the domain table).

Full theory detail still lives in `docs/eng-talk/script.md` and
`docs/eng-talk/outline.md` if a question pulls you deeper.

**Budget:** 19 minutes of content, 6 for questions. Slide numbers are the deck's
own (31 slides, cover is 1). Deck footer `list` button jumps.

| #   | Section                                | Min | Cum | Slides |
| --- | -------------------------------------- | --- | --- | ------ |
| 1   | Cold open, app already up              | 1   | 1   | 1      |
| 2   | **Demo A** Stellar to Arc, 2 tx then 1 | 6   | 7   | 17     |
| 3   | Theory stop: the one thing that bricks | 3   | 10  | 9, 10  |
| 4   | **Demo B** Arc to Stellar              | 4   | 14  | 21     |
| 5   | **Demo C** Solana, clock permitting    | 2   | 16  | 25     |
| 6   | What building it actually taught me    | 2   | 18  | 15     |
| 7   | Caveats and wrap                       | 1   | 19  | 30     |
|     | Q&A                                    | 6   | 25  | 31     |

**Cut in this order if you're long:** §5 (Solana) first, then the 2 tx path in
Demo A (open straight on the wrapper), then §7 down to one sentence.

**Only if you're weirdly short:** slide 18 (Soroban auth tree vs EVM `permit`),
slide 22 (three EVM burn flows), slide 13 (three address encodings). Don't reach
for these preemptively. A demo audience would rather see a third transfer.

---

## Pre-flight (10 minutes before, not at the top of the call)

- Freighter on **Stellar Testnet**, funded with XLM and USDC, USDC trustline
  already added.
- MetaMask on **Arc Testnet**, funded with USDC (Arc pays gas in USDC, so
  there's no separate ETH to babysit).
- Phantom on **devnet** with USDC, only if you're keeping §5.
- `pnpm run dev`, app at `localhost:5173`, both wallets connected, deck open in
  a second window **already on slide 9** so your first cut is one keystroke.
- Note starting balances on both sides so the "it went up" beat reads.
- **Arc only. Never Base live.** Base Standard attestation is ~15 minutes and
  will eat the call.
- Resume hashes in reach. If a live burn stalls, `ResumeForm` skips to attest
  plus mint:
  - Stellar-to-Arc: `64cd3051c47a4f73b4a7ddae2653a5d4e44885199fafcf41c153ad0977fa47d8`
  - Arc-to-Stellar: `0xedff6d8e1bf81831fafd2a5f72ac7c1f72bd02540127a0efe521e55e4b4f432d`
- Transfer history is in memory. Don't refresh mid-demo.

Fuller click paths and fallbacks now live in `docs/eng-talk/runbook.md`. The
ones below are the dev-call cut, so they stay the tighter read for this format.

---

## 1. Cold open (1 min)

App already on screen. Deck slide 1 behind it if you want it, but you can open
cold on the running app and it'll play better.

- "You have USDC on chain A, you want USDC on chain B. The old answers lock it
  up and mint you a wrapped thing, or pull it out of a liquidity pool. Both
  leave a big idle pile, and piles attract exploits."
- "CCTP burns the real USDC on the source, and Circle authorizes a mint of
  native canonical USDC on the destination. Same issuer, both sides. Stellar has
  been a source and a destination since May 2026."
- "This app makes every step of that visible on one screen. Let's just run one."

That's the whole intro. Get to the demo.

## 2. Demo A: Stellar to Arc (6 min)

- (SLIDE 4) **30 seconds, then leave it.** Three actors, three steps: burn on
  the source, Circle's off-chain **Iris** attests once the source is final, mint
  on the destination. Give them the map, then go run the territory.
- Everything after this is taught off the running app. The state machine panel
  (`idle → approve → burn → attest → mint → done`) is that same diagram, except
  it's real and it's moving.
- (DEMO) Direction **Stellar to Arc**, flow **2 tx (direct)**, small amount.
- Narrate the live values as the transaction builds:
  - `amount`: `50_000_000` is 5.00 USDC. **7 decimals on Stellar**, 6 on EVM and
    Solana. The protocol carries an integer and the app converts. Easy to get
    wrong.
  - `destination_domain`: `26` for Arc. CCTP has its own address space, so this
    is **not** a chainId. Arc's chainId is `5,042,002`. Stellar is domain `27`.
  - `destination_caller`: all zeros, so anyone holding the attestation can
    submit the mint. That's what makes the destination step permissionless.
- **Two Freighter prompts.** `approve`, then `deposit_for_burn`. Say why: CCTP
  pulls with `transfer_from` on the USDC SAC, not `transfer`, so it needs an
  allowance first. That's the entire reason this is two steps.
- Watch the panel walk itself: burn lands, app polls Iris for the attestation
  (seconds on Arc, because you're waiting on **finality**, not on Circle), then
  `receiveMessage` on Arc, then the balance moves.
- (SLIDE 17) One slide here, because 40 lines of Rust don't fit on the app
  screen. `approve_and_deposit`:
  - `caller.require_auth()` is the whole trick. Both inner calls act on behalf
    of `caller`, so Soroban's auth tree covers the subtree and Freighter
    collects it in **one prompt**. There is no EVM equivalent without EIP-2612
    `permit`.
  - The wrapper holds no balance between invocations. USDC only passes through
    inside a single call, so there's nothing to drain.
  - `burn_token` and `tmm` are arguments because I'm not sure how permanent
    Circle's addresses are. Flip side: the frontend supplies trusted addresses.
    Fine for testnet, not fine for mainnet.
- (DEMO) Same direction, same amount, flip to **1 tx (wrapper)**. Say "watch the
  prompt count" **before** you click. One signature.
- Be precise about what that is: not cheaper gas, not cryptographically clever,
  just bundling. But one prompt instead of two is the difference between "this
  feels like an app" and "this feels like a blockchain."

## 3. Theory stop: the one thing that bricks funds (3 min)

The only real slide stretch in the talk, and it earns it: this is the part you
**cannot** see on screen, and it's the part that loses money.

- (SLIDE 9) **A CCTP mint can't safely target a G account.** On EVM the mint
  recipient is a 20 byte address and the mint doesn't care whether it's an EOA
  or a contract. On Stellar, CCTP mints to a **contract** (`C...`), and
  `mintRecipient` is a raw 32 byte key with no way to tell a G from a C.
  - Put a bare G address in there and you **brick the transfer**. Single most
    dangerous mistake in the integration.
  - Fix is Circle's **`CctpForwarder`** (`CA66...4VSZ`). Inbound mints to the
    Forwarder, which mints to itself and pays out to the real recipient
    atomically, in one permissionless `mint_and_forward(message, attestation)`.
  - Analogy for this room: same reason you can't pay an asset to a G account
    with no trustline. The destination has to be prepared to receive.
- (SLIDE 10) **So where does the real recipient ride?** Hook data.
  - bytes `0-23` reserved zeros, `24-27` version (`u32`, currently `0`), `28-31`
    strkey length (`u32`), `32+` the G address as a **UTF-8 strkey** (the
    literal `"GB..."` text, not the decoded 32 bytes).
  - That surprised me. It's the opposite convention from `mintRecipient` in the
    same message. Two fields, two opposite encodings. Code is
    `encodeStellarForwarderHookData()` in `src/lib/stellar/recipient.ts`.
  - Which means: **into Stellar, always `depositForBurnWithHook`.** A hookless
    burn either bricks (G address in `mintRecipient`) or errors `HookDataEmpty`
    (Forwarder, no hook). Holds for EVM and Solana sources alike.

## 4. Demo B: Arc to Stellar (4 min)

- (SLIDE 21) Ten seconds on the invariant, then back to the app. Two things
  must be true or funds are gone:
  - `mintRecipient` is the **Forwarder**, not your G address.
  - `destinationCaller` **equals** `mintRecipient`. Pinning it means only the
    Forwarder can submit the mint, which guarantees the payout logic runs
    instead of someone minting to the Forwarder and stranding the funds there.
- (DEMO) Direction **Arc to Stellar**, flow **2 tx (direct)**. MetaMask pops
  `approve`, then `depositForBurnWithHook`. An EOA can't do both atomically,
  which is the EVM baseline and the contrast with what you just showed on
  Soroban.
  - Point at the **hook data preview** in the UI while it builds. That's the
    byte layout from slide 10, live, with your own G address in it.
  - Room to spare? Flip to **1 tx (permit)**: one gasless typed signature, then
    one transaction into the EVM wrapper. Half the gas of the 2 tx path.
- (DEMO) Destination side: poll Iris, call `mint_and_forward`, USDC lands at
  your G address. No hand-rolled `receiveMessage`.

## 5. Demo C: Solana, clock permitting (2 min)

First to cut. If you're at 14 minutes or better, run it.

- (DEMO) **Solana to Stellar**. Note the missing step: **no approve**.
  `depositForBurn` burns directly under the owner's signature through a
  cross-program invocation.
- The Stellar side is the **identical** `mint_and_forward` from Demo B. Zero new
  Stellar code for a whole new source chain, which is the payoff of routing
  everything through the Forwarder.
- (SLIDE 25) If you have 30 seconds, the fun one: **on Solana the receive is not
  a mint.** `handle_receive_finalized_message` transfers USDC out of a shared
  custody account Circle pre-funds, and pays its fee out of it too. No `mint_to`
  in the account list at all. Burn-and-mint is really
  burn-and-release-from-custody over there.

## 6. What building it actually taught me (2 min)

The part this audience came for. Keep it concrete, name the receipts.

- **Generated bindings, everywhere, on purpose.** The Solana burn takes ~15
  accounts and several PDAs. I didn't hand-roll any of it: typed client
  generated from Circle's Anchor **IDL** with Codama, same idea as
  `stellar contract bindings typescript`, and `stellar contract bindings rust`
  for the wrapper's view of TokenMessengerMinter. Every chain-specific mistake I
  didn't make came from that.
  - If anyone needs it: an **IDL** (Interface Definition Language) is Solana's
    machine-readable description of a program's instructions, accounts, and
    types. It's the same role an ABI plays on EVM, or the contract spec embedded
    in a Soroban wasm. Circle publishes theirs, the two files are in `idl/`, and
    Codama turns them into the typed client under
    `src/lib/solana/generated/`.
- **Every chain has its own opinion about the same 32 bytes.** EVM
  right-aligns a 20 byte address. Solana wants the recipient's **ATA**, not the
  wallet. Stellar wants the Forwarder's contract id decoded, with the real
  recipient as UTF-8 text in the hook. One field, three conventions, and the
  decimals differ too. Most of the integration work was encoding discipline,
  not protocol logic.
- **The forwarding probe, and why writing it down mattered.** (SLIDE 15)
  Circle's forwarding service removes the destination transaction entirely: set
  a forward fee, tag the message with a `cctp-forward` marker, and Circle's
  relayer submits the mint. Stellar **wasn't a listed source chain**, so I
  probed it anyway and kept the results in `docs/experiments/` with every burn
  hash, fee, and `forwardState`. Our side was correct the whole time and the gap
  was entirely Circle-side. It got enabled on **9 July**, verified end to end to
  Arc and Base that day, and to Solana on **24 July**.
  - Having verified hashes on hand is what made that support conversation
    concrete instead of "seems broken on my end."
  - Honest asterisk, say it plainly: forwarding works **out of** Stellar. It
    still **does not work into** Stellar (Iris returns "destination does not
    support forwarding"), so inbound always goes through the `CctpForwarder`.
  - Two unrelated Circle things share the name: the hosted **relayer service**,
    and the on-chain Soroban **`CctpForwarder`**. I wrote neither. The only
    contracts I deployed are the two `CctpWrapper`s.

## 7. Caveats and wrap (1 min)

- (SLIDE 30) What this is **not**: testnet only, transfer history is in memory
  so a refresh wipes it, forwarding into Stellar isn't supported by Circle, and
  a couple of the wallet batching paths are best effort and chain dependent.
- "The code's all open. Take it, break it, and tell me where it's wrong."
- (SLIDE 31) Leave the questions slide up.

---

## Q&A quick answers

Longer starters in `docs/eng-talk/plan.md` §"Q&A prep".

- **Is Circle a trusted third party here?** Yes, explicitly. Circle attests and
  Circle can pause. What you get for that is canonical USDC on both sides, no
  pool and no wrapped token.
- **Why not just use an anchor?** Different job. An anchor moves between fiat
  and Stellar. CCTP moves the same canonical USDC between chains.
- **Can anyone call `mint_and_forward`?** Yes, permissionless, and the caller
  pays the Stellar fee. The payout target comes from signed hook data, so the
  caller can't redirect it.
- **Is the wrapper audited?** No. About 40 lines, holds no balance between
  invocations, and it's a demo. Don't ship it as is.
- **What if the mint never lands?** The resume flow takes a burn hash and picks
  up at attest plus mint. Funds are recoverable on non-forwarded burns because
  `destinationCaller` is zero, so anyone can submit.
- **Why is Fast N/A from Stellar?** Stellar already has fast finality, so Circle
  attests at the Standard threshold regardless of the toggle. Fast only does
  something observable from a slower source.
- **Who pays the forward fee?** It comes out of the minted amount. Watch out:
  the relayer consumes roughly the **full** `maxFee`, so padding is paid, not
  refunded. And `destinationCaller` must be zero or forwarding is disabled.
- **Mainnet?** Not from this demo. Testnet only, and the wrapper takes trusted
  addresses from the frontend rather than pinning them.

## Quick reference (keep handy during Q&A)

**Domains:** Ethereum `0`, Solana `5`, Base `6`, Arc `26`, **Stellar `27`**.
Arc's chainId is `5,042,002`, which is not its domain.

**Finality:** `2000` Standard, `1000` Fast. Outbound always attests at `2000`.

| Chain   | Burn + mint                            | Message bus                          |
| ------- | -------------------------------------- | ------------------------------------ |
| Stellar | `TokenMessengerMinter` (`CDNG...RTHP`) | `MessageTransmitter` (`CBJ6...VVJY`) |
| EVM     | `TokenMessengerV2` + `TokenMinterV2`   | `MessageTransmitterV2`               |
| Solana  | `TokenMessengerMinterV2`               | `MessageTransmitterV2`               |

Inbound last hop is Circle's `CctpForwarder` (`CA66...4VSZ`).

**Iris (sandbox `iris-api-sandbox.circle.com`):** messages
`GET /v2/messages/{srcDomain}?transactionHash={hash}`, fees
`GET /v2/burn/USDC/fees/{src}/{dst}` (add `?forward=true`).

**Docs:** `developers.circle.com/cctp/references/stellar`,
`developers.circle.com/cctp/concepts/forwarding-service`.
