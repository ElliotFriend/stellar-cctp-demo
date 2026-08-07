#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, Bytes, BytesN, Env};

mod tmm_interface;
use crate::tmm_interface::TmmClient;
mod mtv2_interface;

#[contract]
pub struct CctpWrapperContract;

#[contractimpl]
impl CctpWrapperContract {
    pub fn approve_and_deposit(
        env: Env,
        tmm: Address,
        caller: Address,
        amount: i128,
        destination_domain: u32,
        mint_recipient: BytesN<32>,
        burn_token: Address,
        destination_caller: BytesN<32>,
        max_fee: i128,
        min_finality_threshold: u32,
    ) {
        caller.require_auth();

        // approve an allowance so the TokenMessengerMinter contract can `transfer_from` our caller address
        let live_until_ledger = (env.ledger().sequence() + 50).next_multiple_of(50);
        token::Client::new(&env, &burn_token).approve(&caller, &tmm, &amount, &live_until_ledger);

        let tmm_client = TmmClient::new(&env, &tmm);
        tmm_client.deposit_for_burn(
            &caller,
            &amount,
            &destination_domain,
            &mint_recipient,
            &burn_token,
            &destination_caller,
            &max_fee,
            &min_finality_threshold,
        );
    }

    pub fn approve_and_deposit_with_hook(
        env: Env,
        tmm: Address,
        caller: Address,
        amount: i128,
        destination_domain: u32,
        mint_recipient: BytesN<32>,
        burn_token: Address,
        destination_caller: BytesN<32>,
        max_fee: i128,
        min_finality_threshold: u32,
        hook_data: Bytes,
    ) {
        caller.require_auth();

        // approve an allowance so the TokenMessengerMinter contract can `transfer_from` our caller address
        let live_until_ledger = (env.ledger().sequence() + 50).next_multiple_of(50);
        token::Client::new(&env, &burn_token).approve(&caller, &tmm, &amount, &live_until_ledger);

        let tmm_client = TmmClient::new(&env, &tmm);
        tmm_client.deposit_for_burn_with_hook(
            &caller,
            &amount,
            &destination_domain,
            &mint_recipient,
            &burn_token,
            &destination_caller,
            &max_fee,
            &min_finality_threshold,
            &hook_data,
        );
    }
}

mod test;
