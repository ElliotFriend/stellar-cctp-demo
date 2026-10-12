import { rpc } from '@stellar/stellar-sdk';
import { STELLAR } from '#lib/config.js';

export const stellarRpc = new rpc.Server(STELLAR.rpcUrl, { allowHttp: false });
