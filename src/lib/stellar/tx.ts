import { BASE_FEE, TransactionBuilder, rpc } from '@stellar/stellar-sdk';
import { STELLAR } from '#lib/config.js';
import { sleep } from '#lib/utils.js';
import { stellarRpc } from './client';
import { signXdr } from './freighter';

// Inclusion fee bid for a Soroban tx. Under surge pricing (routine on mainnet)
// a BASE_FEE bid is outbid every ledger and the tx expires without landing.
// Bid twice the recent p99 so we clear ties at the going rate; at today's
// rates that is a few hundred stroops. Falls back to BASE_FEE if the RPC
// can't report fee stats.
async function sorobanInclusionFee(): Promise<string> {
    const floor = Number(BASE_FEE);
    try {
        const stats = await stellarRpc.getFeeStats();
        const p99 = Number(stats.sorobanInclusionFee.p99);
        return String(Math.max(floor, 2 * p99));
    } catch {
        return String(floor);
    }
}

// Simulate, prepare, sign with Freighter, submit, poll until SUCCESS or FAILED.
// Returns the on-chain transaction hash. The builder's `fee` is ignored and
// replaced with a live inclusion-fee bid; assembleTransaction adds the
// simulated resource fee on top.
export async function simulateSignAndSubmit(
    tx: ReturnType<TransactionBuilder['build']>,
): Promise<string> {
    const [sim, fee] = await Promise.all([
        stellarRpc.simulateTransaction(tx),
        sorobanInclusionFee(),
    ]);
    if (rpc.Api.isSimulationError(sim)) {
        throw new Error(`Soroban simulation failed: ${sim.error}`);
    }
    const bid = TransactionBuilder.cloneFrom(tx, {
        fee,
        networkPassphrase: STELLAR.networkPassphrase,
    }).build();
    const prepared = rpc.assembleTransaction(bid, sim).build();

    const signedXdr = await signXdr(prepared.toXDR());
    const signed = TransactionBuilder.fromXDR(signedXdr, STELLAR.networkPassphrase);

    const send = await stellarRpc.sendTransaction(signed);
    if (send.status === 'ERROR') {
        throw new Error(`Submission rejected: ${JSON.stringify(send.errorResult)}`);
    }
    if (send.status === 'TRY_AGAIN_LATER') {
        throw new Error('Stellar RPC is congested and did not accept the transaction. Try again.');
    }

    let attempts = 0;
    while (attempts++ < 60) {
        const got = await stellarRpc.getTransaction(send.hash);
        if (got.status === 'SUCCESS') return send.hash;
        if (got.status === 'FAILED') {
            throw new Error(`Transaction failed on-chain: ${send.hash}`);
        }
        await sleep(1000);
    }
    throw new Error(`Transaction did not finalize within 60s: ${send.hash}`);
}
