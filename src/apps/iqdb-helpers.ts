import {SystemProgram} from "@solana/web3.js";
import type {Connection, PublicKey, Signer} from "@solana/web3.js";
import iqlabs from "@iqlabs-official/solana-sdk";

import {sendInstruction} from "../utils/tx";
import {logStep, logSuccess} from "../utils/logger";

// Make sure a given dbRoot exists on chain. Cheap when it already does
// (one getAccountInfo); sends an initialize_db_root tx when it doesn't.
// This is the single source of truth — services should not duplicate the
// initialize_db_root call.
export const ensureDbRoot = async (
    connection: Connection,
    signer: Signer,
    programId: PublicKey,
    dbRootId: Uint8Array,
): Promise<{dbRoot: PublicKey; created: boolean; signature?: string}> => {
    const dbRoot = iqlabs.contract.getDbRootPda(dbRootId, programId);
    const info = await connection.getAccountInfo(dbRoot);
    if (info) {
        return {dbRoot, created: false};
    }
    const human = Buffer.from(dbRootId).toString("utf8");
    logStep(`db_root '${human}' not found. creating it on chain...`);
    const builder = iqlabs.contract.createInstructionBuilder();
    const ix = iqlabs.contract.initializeDbRootInstruction(
        builder,
        {
            db_root: dbRoot,
            signer: signer.publicKey,
            system_program: SystemProgram.programId,
        },
        {db_root_id: dbRootId},
    );
    const signature = await sendInstruction(connection, signer, ix);
    logSuccess(`db_root '${human}' created`);
    return {dbRoot, created: true, signature};
};
