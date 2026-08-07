# CCTP Eng-Talk: Q&A Prep <!-- omit in toc -->

Starter answers for the ~15 min Q&A. Each one is a first pass you can say in two
or three sentences, plus an "if pressed" line for the follow-up. Voice matches
the script: second person, warm, and the caveats are the credibility. Where I
don't know, the answer says so, because this room will respect that more than a
confident guess.

Grounded facts behind these live in `plan.md` under "Grounded facts to reuse".

## Table of Contents <!-- omit in toc -->

- [Trust model](#trust-model)
  - ["Isn't Circle just a trusted third party here?"](#isnt-circle-just-a-trusted-third-party-here)
  - ["What if Iris goes down mid-transfer?"](#what-if-iris-goes-down-mid-transfer)
  - ["Can Circle censor a transfer, or freeze funds mid-flight?"](#can-circle-censor-a-transfer-or-freeze-funds-mid-flight)
- [Versus anchors and classic USDC](#versus-anchors-and-classic-usdc)
  - ["How is this different from a SEP-24 anchor?"](#how-is-this-different-from-a-sep-24-anchor)
  - ["What about classic USDC and trustlines? That already worked."](#what-about-classic-usdc-and-trustlines-that-already-worked)
- [Forwarder security](#forwarder-security)
  - ["Can anyone call `mint_and_forward`?"](#can-anyone-call-mint_and_forward)
  - ["Then can the caller steal or misroute the funds?"](#then-can-the-caller-steal-or-misroute-the-funds)
  - ["Why is it a separate contract instead of in-protocol?"](#why-is-it-a-separate-contract-instead-of-in-protocol)
- [The wrapper contract](#the-wrapper-contract)
  - ["Why a wrapper at all?"](#why-a-wrapper-at-all)
  - ["Is it audited?"](#is-it-audited)
  - ["What's the risk of passing `tmm` and `burn_token` as arguments?"](#whats-the-risk-of-passing-tmm-and-burn_token-as-arguments)
  - ["Why does the EVM one need `permit`?"](#why-does-the-evm-one-need-permit)
- [Fees and economics](#fees-and-economics)
  - ["Who pays the forward fee?"](#who-pays-the-forward-fee)
  - ["Why does forwarding consume the full `maxFee`?"](#why-does-forwarding-consume-the-full-maxfee)
  - ["What does a transfer cost end-to-end?"](#what-does-a-transfer-cost-end-to-end)
- [Fast versus Standard](#fast-versus-standard)
  - ["Why is Fast N/A from Stellar?"](#why-is-fast-na-from-stellar)
  - ["Then why is the toggle in the UI?"](#then-why-is-the-toggle-in-the-ui)
  - ["When does Fast actually matter?"](#when-does-fast-actually-matter)
- [Solana custody](#solana-custody)
  - ["If it's release-from-custody, who funds the custody account?"](#if-its-release-from-custody-who-funds-the-custody-account)
  - ["What happens if it runs dry?"](#what-happens-if-it-runs-dry)
- [Failure and recovery](#failure-and-recovery)
  - ["What if the mint never lands?"](#what-if-the-mint-never-lands)
  - ["So funds are recoverable?"](#so-funds-are-recoverable)
  - ["What is _not_ recoverable?"](#what-is-not-recoverable)
- [Assets and chains](#assets-and-chains)
  - ["Does this work for EURC?"](#does-this-work-for-eurc)
  - ["Which chains are live?"](#which-chains-are-live)
  - ["Is this mainnet-ready?"](#is-this-mainnet-ready)
- [Why Arc](#why-arc)
  - ["Why is Arc the default demo chain?"](#why-is-arc-the-default-demo-chain)
- [Questions I'd expect from this room specifically](#questions-id-expect-from-this-room-specifically)
  - ["Why is the strkey UTF-8 instead of the decoded key?"](#why-is-the-strkey-utf-8-instead-of-the-decoded-key)
  - ["Could the wrapper also add the trustline?"](#could-the-wrapper-also-add-the-trustline)
  - ["How much of this was Circle support versus documentation?"](#how-much-of-this-was-circle-support-versus-documentation)
- [Things to say "I don't know" about](#things-to-say-i-dont-know-about)

## Trust model

### "Isn't Circle just a trusted third party here?"

Yes, and that's worth naming plainly. But notice what you're trusting them
_with_: you already trust Circle to honor USDC, because they're the issuer. CCTP
doesn't add a new party to that relationship, it just gives the issuer a
protocol for authorizing a mint on one chain against a burn on another. Compare
that to a lock-and-wrap bridge, where you're trusting a _second_ party (the
bridge operator and its multisig) on top of the issuer.

_If pressed:_ the meaningful difference is what a compromise costs you. A drained
bridge takes the whole locked pool with it. A misbehaving attester can authorize
a mint that didn't correspond to a burn, which is an issuance problem for
Circle's own books rather than a pool that empties.

### "What if Iris goes down mid-transfer?"

Your burn already happened on-chain, and the message is sitting in the
MessageTransmitter contract on the source chain. What you're missing is the
signature. When Iris comes back it can attest that same message, and you carry
it to the destination then. The transfer is delayed, not lost.

_If pressed:_ I have not tested this against a real Iris outage, so treat "it
resumes cleanly" as reasoning from the protocol shape rather than something I
watched happen.

### "Can Circle censor a transfer, or freeze funds mid-flight?"

Declining to attest would leave a burn with no matching mint, and I haven't seen
that behavior or found a documented policy for it. USDC has always had
address-level freeze at the token contract, which is a property of the asset and
not of CCTP. I'd rather say that honestly than pretend the burn-and-mint model
removes issuer control, because it doesn't.

## Versus anchors and classic USDC

### "How is this different from a SEP-24 anchor?"

They solve different problems and they compose fine. An anchor moves value
between the banking system and Stellar: fiat in, USDC out, with KYC and a
regulated counterparty in the middle. CCTP moves USDC between _chains_ with no
fiat leg, no KYC, and nobody custodying your money along the way. If your user
has dollars in a bank, you want an anchor. If your user has USDC on Base, you
want CCTP.

### "What about classic USDC and trustlines? That already worked."

Classic USDC on Stellar is the same canonical asset, and it still works exactly
as it did. What was missing was a first-party path for that asset to _arrive
from_ another chain without an anchor or a third-party bridge taking a turn with
it. That's the gap CCTP closes, and it's why the May 2026 launch mattered.

_If pressed:_ the trustline analogy is actually useful. The reason inbound needs
a Forwarder is the same shape as the reason you can't send an arbitrary asset to
a G account with no trustline. The destination has to be prepared to receive.

## Forwarder security

### "Can anyone call `mint_and_forward`?"

Yes, and that's deliberate. It's permissionless, and the caller only pays the
Stellar transaction fee. That's what lets a third party (or Circle's relayer, or
your own backend) complete a transfer for a recipient who has no XLM.

### "Then can the caller steal or misroute the funds?"

No, because the caller doesn't get to choose the destination. The payout target
comes out of the hook data inside the message, and that message is what Circle's
attestation signs. Change a byte and the signature fails. The caller supplies
the pair and pays the fee, and that's the whole of their influence.

_If pressed:_ the thing that guarantees the payout logic actually runs is the
`destinationCaller == mintRecipient == Forwarder` rule from §6a. Without it,
someone could submit a plain `receive_message`, mint _to_ the Forwarder, and
strand the funds there with no payout step.

### "Why is it a separate contract instead of in-protocol?"

Because CCTP's mint path wants a contract address it can call into, and a CCTP
message can't tell a G address from a C address. The Forwarder is the piece
that's prepared to receive, which is why it can safely be the `mintRecipient`
for every inbound transfer. And to be clear about ownership: `CctpForwarder` is
Circle's contract, not mine. The only things I deployed are the two
`CctpWrapper`s.

## The wrapper contract

### "Why a wrapper at all?"

Purely UX. The CCTP contract pulls your USDC with `transfer_from`, so you need
an allowance first, which is two Freighter prompts. The wrapper puts both inside
one invocation, and Soroban's auth tree lets a single signature cover the whole
sub-tree. One prompt instead of two.

### "Is it audited?"

No. It's about forty lines of Rust for a testnet demo, and I wouldn't put it in
front of real money as-is. It holds no balance between invocations, so there's
nothing sitting in it to drain, but "nothing to drain" is not the same as
"audited."

### "What's the risk of passing `tmm` and `burn_token` as arguments?"

This is the sharpest question in the deck and it deserves a straight answer. It
means the frontend supplies addresses the contract then trusts. A hostile or
compromised frontend could pass a `tmm` of its choosing, and your signature would
grant _that_ address an allowance over your USDC. The wrapper itself stays
harmless, but the approval you signed wouldn't be.

_If pressed on why I did it anyway:_ I wasn't sure how permanent Circle's
contract addresses are, and I didn't want to redeploy the wrapper or carry a
`set_tmm(...)` admin function every time one moved. Passing per call sidesteps
both. For mainnet you'd pin the addresses at deploy time, or govern them, rather
than trust the caller. For a testnet demo it's me being pragmatic, and I'd
rather say that than dress it up.

### "Why does the EVM one need `permit`?"

Because an EOA can't do two things atomically. To get from two transactions down
to one signature on EVM, the user signs an EIP-2612 typed message off-chain and
the contract redeems it on-chain. Same UX goal as the Soroban version, several
more moving parts, and it only works because USDC happens to implement 2612. Not
every ERC-20 does.

## Fees and economics

### "Who pays the forward fee?"

The sender, out of the transferred amount. You set `maxFee` on the burn and the
relayer takes its cut from the transfer before the recipient sees it. The
recipient pays nothing and needs no gas token on the destination, which is the
entire point of the service.

### "Why does forwarding consume the full `maxFee`?"

I don't have Circle's rationale, only the observed behavior: on plain CCTP the
fee taken is usually less than the ceiling you set, and with forwarding on it
comes out at roughly the whole thing. So size `maxFee` to the actual quote from
`?forward=true`. Padding it "just in case" is padding you pay, not padding you
get back.

### "What does a transfer cost end-to-end?"

Three pieces: the source-chain transaction fee, Circle's fee (zero on Standard,
small on Fast, and the relayer's cut if you're forwarding), and the
destination-chain gas to submit the mint. On Stellar the first is a fraction of
a cent. The destination side is whatever that chain charges, and forwarding is
how you make it somebody else's problem.

## Fast versus Standard

### "Why is Fast N/A from Stellar?"

Fast is you paying Circle to attest _before_ hard finality and carry the
reorg risk for you. Stellar already has fast, deterministic finality, so there's
no earlier moment to buy. Circle attests outbound at the Standard threshold no
matter what we request, and their own docs list Fast Transfer as N/A for
Stellar.

### "Then why is the toggle in the UI?"

So the parameter is visible when we read the burn arguments, since
`min_finality_threshold` is right there on screen either way. From Stellar it's
cosmetic, and I'd be lying if I said it changed the outbound timing.

### "When does Fast actually matter?"

When the _source_ is slow. Ethereum and most of its L2s are the real use case,
where you're choosing between roughly twenty minutes and roughly seconds. My
favorite extreme is StarkNet at four to eight hours for hard finality.

## Solana custody

### "If it's release-from-custody, who funds the custody account?"

Circle does. They keep a float of already-minted USDC in a shared
`custody_token_account` (seed `["custody", mint]`), one per USDC mint and shared
across every source domain. `handle_receive_finalized_message` transfers out of
it and takes its fee from it. There's no `mint_to` anywhere in the instruction's
account list.

### "What happens if it runs dry?"

Your receive fails. On testnet that's a real and recurring hazard, and it's
exactly why the runbook says to dry-run a Solana receive before presenting. On
mainnet it's Circle's balance-sheet operation and I have no visibility into how
they provision it, so I won't guess at the headroom.

_If pressed:_ this is an implementation detail of mapping CCTP onto Solana's
token model rather than something that changes the developer's job. The
instruction you call and the message you build are the same either way. I just
found it genuinely interesting that "burn-and-mint" quietly becomes
"burn-and-release" on exactly one chain.

## Failure and recovery

### "What if the mint never lands?"

The burn message and the attestation are both durable, so you can submit the
mint later. The demo has a resume flow: give it the burn transaction hash and it
skips straight to attest-and-mint. That's also my live-demo safety net, and I
have known-good hashes on hand in case one of these stalls in front of you.

### "So funds are recoverable?"

On an ordinary transfer, yes, and specifically because `destinationCaller` is
zero, which makes the mint permissionless. Anyone holding the attestation can
submit it. For Stellar-bound transfers `destinationCaller` is the Forwarder, but
`mint_and_forward` is itself permissionless, so the same property holds.

### "What is _not_ recoverable?"

Getting the recipient encoding wrong. A bare G address in `mintRecipient`
bricks the transfer. The Forwarder with no hook data errors `HookDataEmpty`. The
decoded 32 bytes instead of the UTF-8 strkey doesn't parse. There's no undo on
any of those, which is why I validate the strkey before building the burn.

## Assets and chains

### "Does this work for EURC?"

CCTP is Circle's protocol for Circle's stablecoins, so EURC is the obvious
candidate, but I've only ever moved USDC and I haven't checked which chains have
EURC registered. Treat that as unverified by me.

### "Which chains are live?"

The demo covers Stellar, Arc, Base, and Solana. Circle's supported-chains list
is the authority and it moves, so check
`developers.circle.com/cctp` rather than my slide. One thing worth knowing from
experience: the published docs lag reality in both directions. Circle's
forwarding destination list omits Solana, but the sandbox relayer services it,
and I have a finalized Solana devnet mint to prove it.

### "Is this mainnet-ready?"

CCTP is. My demo isn't, and I want to be precise about which is which. CCTP V2
has been live on Stellar since May 2026. What you're looking at today is testnet
only, keeps transfer history in memory, and leans on an unaudited wrapper I
deployed myself.

## Why Arc

### "Why is Arc the default demo chain?"

Finality. Arc attests in seconds, so a live transfer completes while you're
still looking at it. Base Standard is around fifteen minutes, which is why Base
is recording-only today and why I'd never run it live. Choosing Arc is a
stagecraft decision more than a technical one.

_If pressed:_ Arc's chainId is 5,042,002 and its CCTP domain is 26, which is a
nice concrete reminder that those are two different address spaces.

## Questions I'd expect from this room specifically

**"Could the Forwarder pattern be replaced by smart accounts or muxed
addresses?"**

That's on my what's-next list. A smart account is a C address, so it can be a
direct `mintRecipient` with no hook-data indirection at all. Muxed addresses
don't help, because Circle's docs are explicit that `M` is a flavor of G and
can't be a direct `mintRecipient` either.

### "Why is the strkey UTF-8 instead of the decoded key?"

I don't know, and it surprised me too. It's Circle's chosen convention for
Stellar. My only guess is that a text strkey is unambiguous about which address
type it encodes, where raw 32 bytes aren't, but that is a guess and not
something I got from Circle.

### "Could the wrapper also add the trustline?"

That's the other item on the what's-next list: one invocation that does
`usdc.trust(...)` and `mint_and_forward` together, so a brand-new account can
receive an inbound transfer with nothing set up in advance. Haven't built it
yet.

### "How much of this was Circle support versus documentation?"

More support than I'd like. Outbound forwarding from Stellar didn't work when I
started, and getting it fixed took about a week of back-and-forth. The docs also
still say forwarding to Solana isn't supported when it demonstrably is. If
you're integrating, budget for that.

## Things to say "I don't know" about

Have these ready, because a clean "I don't know" beats a confident wrong answer
in front of this room:

- Circle's roadmap for forwarding _into_ Stellar. It errors today with
  "destination does not support forwarding" and I have no timeline.
- Mainnet custody headroom on Solana.
- EURC support specifics.
- Whether Circle's contract addresses are stable enough to pin. My wrapper's
  design literally hedges against not knowing this.
- Anything about C or M addresses as Forwarder payout targets. Circle's docs say
  all three work; this demo only ever encodes G, so the other two are
  documented-but-untested by me.
