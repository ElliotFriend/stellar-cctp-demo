import { concatHex, pad, stringToHex, toHex, type Hex } from 'viem';
import { StrKey } from '@stellar/stellar-sdk';
import { address, getAddressEncoder } from '@solana/kit';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { SOLANA } from '$lib/config';

// A Solana owner's USDC ATA as raw 32 bytes, for use as the CCTP burn
// mintRecipient when the destination is Solana. Solana pubkeys already fill
// all 32 bytes (left-aligned), so do NOT right-pad like the EVM helper. The
// on-chain mint delivers to this token account, so the burn must name the ATA
// (not the wallet).
export async function solanaAtaToBytes32(ownerAddress: string): Promise<Uint8Array> {
    const [ata] = await findAssociatedTokenPda({
        owner: address(ownerAddress),
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint: address(SOLANA.usdc.mint),
    });
    return new Uint8Array(getAddressEncoder().encode(ata));
}

// Hook data layout for routing CCTP funds to a Stellar G-address via
// CctpForwarder. From Circle's Stellar CCTP docs:
//
//   bytes 0 to 23  : 24 magic bytes (zeros, Circle-reserved)
//   bytes 24 to 27 : version (uint32, currently 0)
//   bytes 28 to 31 : length of forwardRecipient in bytes (uint32)
//   bytes 32+    : forwardRecipient as UTF-8 encoded strkey (the G-address)
//
// Getting any byte of this wrong will permanently lose funds. Validate
// the strkey first.
export function encodeStellarForwarderHookData(stellarStrkey: string): Hex {
    if (!StrKey.isValidEd25519PublicKey(stellarStrkey)) {
        throw new Error(`Invalid Stellar account: ${stellarStrkey}`);
    }
    const magic = pad('0x', { size: 24 });
    const version = pad(toHex(0), { size: 4 });
    const recipientHex = stringToHex(stellarStrkey);
    const recipientLen = (recipientHex.length - 2) / 2;
    const lengthField = pad(toHex(recipientLen), { size: 4 });
    return concatHex([magic, version, lengthField, recipientHex]);
}

// Decode a Stellar strkey into the raw 32 bytes a CCTP message slot expects.
// For every Stellar-bound burn in this app the value is the CctpForwarder
// contract id, and it fills BOTH `mintRecipient` and `destinationCaller`.
//
// Note the convention here is the *opposite* of hook data: a message slot takes
// the DECODED bytes, while `encodeStellarForwarderHookData` above sends the
// recipient strkey as UTF-8 text. Don't mix them up; either mistake loses funds.
//
// The account branch is kept for symmetry, but nothing currently passes a G
// address here, so an inbound transfer always decodes a `C...` contract id.
export function strkeyToBytes32(strkey: string): Hex {
    const isContract = StrKey.isValidContract(strkey);
    const raw = isContract ? StrKey.decodeContract(strkey) : StrKey.decodeEd25519PublicKey(strkey);
    return toHex(raw);
}
