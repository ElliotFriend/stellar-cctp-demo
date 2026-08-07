# CCTP Eng-Talk: Demo Runbook

The script says what to _say_. This says what to _click_, and what to do when it
breaks. Keep this open on the second screen next to `script.md`.

- [CCTP Eng-Talk: Demo Runbook](#cctp-eng-talk-demo-runbook)
  - [Pre-flight (do this before you present)](#pre-flight-do-this-before-you-present)
  - [The UI, in the order you touch it](#the-ui-in-the-order-you-touch-it)
  - [Demo A: Stellar to Arc, raw then wrapper (script §5)](#demo-a-stellar-to-arc-raw-then-wrapper-script-5)
  - [Demo B: Arc to Stellar, three burn flows (script §6)](#demo-b-arc-to-stellar-three-burn-flows-script-6)
  - [Demo C: Solana both ways (script §7)](#demo-c-solana-both-ways-script-7)
  - [Demo D: forwarding live (script §8)](#demo-d-forwarding-live-script-8)
  - [Fallbacks](#fallbacks)
  - [Timing cues](#timing-cues)

## Pre-flight (do this before you present)

Tick these in order. The starred ones have bitten this demo before.

**Wallets**

- [x] **Freighter** on **Stellar Testnet**. Funded with XLM _and_ USDC, and the
      **USDC trustline is added**.
- [x] **MetaMask** with **Arc Testnet** (chainId `5042002`) selected, holding USDC
      and enough native token for gas.
- [x] MetaMask also has **Base Sepolia** + a little ETH, only if you plan to show
      the recording. Base is never live.
- [x] **Phantom** (or another Wallet-Standard Solana wallet) on **devnet**, funded
      with devnet SOL and USDC, and the recipient **USDC ATA already exists**.

**Faucets, if any of the above is short**

- XLM: `lab.stellar.org/account/fund`
- USDC (Stellar Testnet / Arc Testnet / Base Sepolia): `faucet.circle.com`
- Base Sepolia ETH: `alchemy.com/faucets/base-sepolia`

**Smoke tests (\*)**

- [x] **\* Wrapper burn.** The Soroban wrapper was redeployed this morning
      (`CCR6VA3W3R3O23MEKY64J5ABIKB5MUTQYN5NVY4VE7FIZT7OTOELS5AE`, commit
      `cda1ca0`) with a reordered argument list. The deployed spec, the Rust
      source, and `src/lib/stellar/cctp.ts` all agree, but agreement is not the
      same as a completed transfer. **Run one small Stellar to Arc wrapper burn
      end to end before you present.** This is the single highest-risk item on
      the page.
- [x] **\* Solana receive.** A Solana receive fails if Circle's shared devnet
      `custody_token_account` is underfunded, and you get no warning until the
      transfer stalls. Run one small Stellar to Solana transfer. If custody is
      dry, cut Demo C's second half to the recording and say so.
- [x] **\* Arc RPC.** Arc testnet's RPC has flaky CORS preflight and caps around
      four in-flight requests. There's a workaround in the app (`7c7739f`), but
      if the pre-flight burn stalls on the destination step, that's the cause,
      and a page refresh plus resume-by-hash is the fastest recovery.
- [x] Note your **starting balances** on each chain, so the "the balance went up"
      beat actually reads.
- [x] Save the **burn hashes** from these smoke tests. They're your resume-flow
      safety net (see [Fallbacks](#fallbacks)).

**Screen and screenshare**

- [ ] Share **the tab**, with the window near 16:9, so the deck's fixed stage
      fills the frame without double letterboxing.
- [x] **Speaker notes are in the same tab as the deck.** Keep them toggled off
      (`n`) and read from `script.md` on a second screen.
- [x] Close `scratchpad.md`. It has a throwaway private key and an Etherscan API
      key in plaintext, and it should not appear in an editor tab or a
      recent-files list on a shared screen.
- [x] Deck keys, so you're not hunting: `→`/`space` next, `←` prev, `home`/`end`,
      `o` jump list, `f` fullscreen, `?` shows the rest.

## The UI, in the order you touch it

Same controls every demo, so learn them once:

- **Direction switcher.** Shows `Stellar ⇄ <other>`. The **⇄ button flips** which
  side is the source. It does not pick the chain.
- **Chain selector.** Picks the non-Stellar side: an EVM chain (Arc Testnet, Base
  Sepolia, Ethereum Sepolia) or Solana.
- **Flow chips.** Live on the source chain's panel, and the labels differ by
  chain:
    - Stellar source: `2 tx (direct)` and `1 tx (wrapper)`.
    - EVM source: `2 tx (direct)`, `1 tx (permit)`, and `1 click (atomic)` or
      `1 click (batched)` depending on what the wallet advertises. The chip
      auto-disables when the wallet doesn't support EIP-5792, which is expected
      behavior and not a bug.
- **Speed toggle.** `Standard` / `Fast`. Auto-disabled with an explanatory
  tooltip on routes where Fast doesn't apply, which is every outbound route.
- **Forwarding toggle.** Turns on the `cctp-forward` hook. Demo D only.
- **Burn preview.** The argument table that renders under the form. This is what
  you point at while narrating args, and it maps to the `(SLIDE)` arg tables in
  the script.
- **Resume form.** Takes a burn hash and skips to attest-and-mint.

## Demo A: Stellar to Arc, raw then wrapper (script §5)

Budget 12 min. This is the longest demo and the one carrying the most content.

**5a, the raw path (~4 min)**

1. Direction reads **Stellar → Arc Testnet**. Flip if needed, and pick Arc in the
   chain selector.
2. Flow chip: **`2 tx (direct)`**.
3. Amount: something small, `5` is what the script's numbers assume.
4. **Stop before submitting.** Walk the burn preview argument by argument, per
   `script.md` §5a: `caller`, `amount` (the 7-vs-6 decimals beat),
   `destination_domain` `26` (not chainId), `mint_recipient` right-aligned,
   `burn_token`, `destination_caller` zero, `max_fee`, `min_finality_threshold`
   `2000`.
5. Submit. **Freighter prompt one is `approve`**, prompt two is
   `deposit_for_burn`. Say _why_ the approve exists: CCTP pulls with
   `transfer_from`, not `transfer`.
6. Attestation poll runs. Call out the Iris URL shape,
   `/v2/messages/26?transactionHash=...`, keyed by source domain plus burn hash.
7. `receiveMessage` on Arc. USDC lands. On Arc this is seconds.

**5b, the contract walkthrough (~4 min)**

No app interaction. Deck slide with `approve_and_deposit`, walked line by line.
This is **safe cut #1** if you're running long.

**5c, the wrapper path (~4 min)**

1. Same direction, same amount. Flip the flow chip to **`1 tx (wrapper)`**.
2. Say **"watch the prompt count" before you click.** The payoff only lands if
   they're counting.
3. **One** Freighter signature. Both operations still happen on-chain, now as
   inner calls under one auth tree.
4. Destination side is identical to 5a, so don't re-narrate it. The whole delta
   was the burn.

## Demo B: Arc to Stellar, three burn flows (script §6)

Budget 7 min.

1. **Flip the direction** so Arc is the source. Everything on the burn side is
   now MetaMask.
2. Before running anything, put the §6a invariant on screen:
   `mintRecipient == destinationCaller == Forwarder`, real G address in
   `hookData`. Both must hold or funds are lost.
3. Point at the **hook data preview**. It renders the exact byte layout from
   §3b, so you can show the 24 zero bytes, version, length, and the UTF-8
   strkey.
4. **`2 tx (direct)`:** MetaMask pops `approve`, then `depositForBurnWithHook`.
   The EVM baseline.
5. **`1 tx (permit)`:** one signature (gasless, it's a typed message), then one
   transaction into the EVM wrapper.
6. **`1 click`:** describe it, and run it only if the chip is enabled. If it's
   greyed out, that's the capability probe doing its job. Say so and move on.
7. Destination side is always `mint_and_forward(message, attestation)` on the
   Forwarder. No `receiveMessage` by hand.

**Show at least two of the three live.** If time is tight, `2 tx` and `1 tx` are
the pair that carries the story.

## Demo C: Solana both ways (script §7)

Budget 5 min. Pre-flight starred item #2 decides whether the second half runs
live.

**7a, Solana to Stellar**

1. Chain selector to **Solana**, direction so Solana is the source.
2. Call out: **no approve step.** Solana burns directly under the owner's
   signature via CPI, plus one throwaway co-signer keypair for the event
   account.
3. Mention the ~15 accounts and PDAs, and that they come from a Codama-generated
   client off Circle's Anchor IDL rather than hand-rolled.
4. Stellar side is the same `mint_and_forward` from Demo B. Zero new Stellar
   code, which is the payoff of routing everything through the Forwarder.

**7b, Stellar to Solana**

1. Flip direction. `mint_recipient` is the recipient's **USDC ATA**, not the
   wallet, as raw left-aligned 32 bytes.
2. Then the custody twist from the deck: the receive is not a mint, it's a
   transfer out of Circle's shared `custody_token_account`.
3. **If the pre-flight showed custody dry**, don't run this live. Cut to the
   recording, and say plainly that testnet custody was underfunded this morning.
   That's a better beat than a stalled transfer anyway.

## Demo D: forwarding live (script §8)

Budget 2 min. This is **safe cut #2**.

1. **Stellar → Arc**, forwarding toggle **on**.
2. Point at two changes in the burn preview: hook data now carries the
   `cctp-forward` flag (no address in it), and `maxFee` is bumped to the
   `?forward=true` quote. `destination_caller` stays zero, because setting it
   disables forwarding.
3. Submit the burn, then **nothing to click.** The app polls the destination
   balance instead of running a mint step.
4. USDC appears on Arc with no second signature.
5. Repeat the directional asterisk once: this works with Stellar as the source,
   to both EVM and Solana. Forwarding _into_ Stellar still errors.

## Fallbacks

**Resume by burn hash.** The app's resume form (`ResumeForm.svelte`,
`transfer.svelte.ts:resume()`) takes a burn transaction hash and skips straight
to attest-and-mint. This is your primary recovery for any transfer that stalls
after the burn landed. Keep the smoke-test hashes from pre-flight somewhere you
can paste from without alt-tabbing into anything private.

Known-good hashes, verified in pre-flight on 2026-08-07 at 5 USDC each. Also
mirrored at the top of `outline.md`, which is the copy to keep on screen:

| Route             | Burn hash                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Stellar to Arc    | `820ab52bd0bb0da56c82e8b8b84feb90ab82653ba47af2f20987b8ce9816304a`                        |
| Arc to Stellar    | `0x43357264d653b11a7ec2121bfe3bb26dd6474e3f4d5e4f35b0d3400ef1c1a1a1`                      |
| Stellar to Solana | `017073e036ffa41b95cbd9a43ee3af091742c1e7b372c71b795189c8450e4391`                        |
| Solana to Stellar | `FqbpEWR6dnfWZSKnZPNTiyNkd9cUo1wAaJaCcZsy5uL2hGBGC6UNvpUztpP18sZWkkBxpTZkszGctJMBw95bfjV` |

**Pre-recorded clips.** Have one per flow. Cut to the clip the moment a live
attestation hangs, especially anything touching Base.

**Timing reality check.** Arc is seconds. Base Standard is around fifteen
minutes, so Base is recording-only, always.

**If a wallet won't connect.** Refresh the page. Transfer history is in memory,
so a refresh wipes the list, but nothing on-chain is lost and resume-by-hash
recovers anything in flight.

**If Arc's destination step stalls.** Suspect the RPC, not the app. Refresh,
then resume by hash.

## Timing cues

From the script's running order. It has **not** been rehearsed against a clock,
and as written it totals 46 against a ~45 budget, so treat these as targets to
check yourself against rather than measured truth.

| Section              | Min | Cumulative |
| -------------------- | --- | ---------- |
| 1 Cold open          | 2   | 2          |
| 2 Mental model       | 6   | 8          |
| 3 Stellar realities  | 6   | 14         |
| 4 Forwarding service | 4   | 18         |
| **5 Demo A**         | 12  | 30         |
| **6 Demo B**         | 7   | 37         |
| **7 Demo C**         | 5   | 42         |
| **8 Demo D**         | 2   | 44         |
| 9 Recap              | 2   | 46         |

**Checkpoints.** If you reach Demo A late, drop §5b (the contract walkthrough)
and keep both live runs. If you reach Demo C late, drop Demo D. Those are the
two cuts already agreed, in that order, and both concepts will already have
landed earlier in the talk.
