import {
    Transaction,
    sendAndConfirmTransaction,
    SendTransactionError,
    type TransactionInstruction,
} from "@solana/web3.js";
import type {Connection, Signer} from "@solana/web3.js";

export const sendInstruction = async (
    connection: Connection,
    signer: Signer,
    instruction: TransactionInstruction,
) => {
    const tx = new Transaction().add(instruction);
    try {
        return await sendAndConfirmTransaction(connection, tx, [signer]);
    } catch (err) {
        if (err instanceof SendTransactionError) {
            try {
                const logs = await err.getLogs(connection);
                if (logs.length > 0) {
                    console.error("Transaction logs:", logs);
                }
            } catch {
                // ignore log fetch errors
            }
        }
        throw err;
    }
};
