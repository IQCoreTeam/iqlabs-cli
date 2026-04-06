import {Connection, PublicKey} from "@solana/web3.js";
import {BorshAccountsCoder, type Idl} from "@coral-xyz/anchor";
import {createHash} from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import iqlabs from "@iqlabs-official/solana-sdk";

const IDL = JSON.parse(fs.readFileSync(path.join(process.cwd(), "node_modules/@iqlabs-official/solana-sdk/idl/code_in.json"), "utf8")) as Idl;

async function checkDbRoot(label: string, dbRootIdRaw: Uint8Array | Buffer) {
    const connection = new Connection(iqlabs.getRpcUrl(), "confirmed");
    const programId = new PublicKey(iqlabs.contract.DEFAULT_ANCHOR_PROGRAM_ID);
    const accountCoder = new BorshAccountsCoder(IDL);
    const dbRoot = iqlabs.contract.getDbRootPda(dbRootIdRaw, programId);
    const info = await connection.getAccountInfo(dbRoot);

    if (!info) {
        console.log(`\n=== ${label} — DbRoot NOT FOUND ===`);
        return;
    }

    const decoded = accountCoder.decode("DbRoot", info.data) as {
        creator: any;
        table_seeds: Uint8Array[];
        global_table_seeds: Uint8Array[];
    };

    const creator = new PublicKey(decoded.creator);
    console.log(`\n=== ${label} ===`);
    console.log(`DbRoot PDA: ${dbRoot.toBase58()}`);
    console.log(`Creator: ${creator.toBase58()}`);

    console.log(`\ntable_seeds (${decoded.table_seeds.length}):`);
    for (const s of decoded.table_seeds) {
        const hex = Buffer.from(s).toString("hex");
        const utf8 = Buffer.from(s).toString("utf8");
        const readable = /^[\x20-\x7e]+$/.test(utf8) && s.length < 64;
        console.log(`  ${hex.slice(0, 40)}${hex.length > 40 ? "..." : ""}  (${s.length}B)  ${readable ? `"${utf8}"` : "(binary)"}`);
    }

    console.log(`\nglobal_table_seeds (${decoded.global_table_seeds.length}):`);
    for (const s of decoded.global_table_seeds) {
        const hex = Buffer.from(s).toString("hex");
        const utf8 = Buffer.from(s).toString("utf8");
        const readable = /^[\x20-\x7e]+$/.test(utf8) && s.length < 64;
        console.log(`  ${hex.slice(0, 40)}${hex.length > 40 ? "..." : ""}  (${s.length}B)  ${readable ? `"${utf8}"` : "(binary)"}`);
    }
}

async function main() {
    // iqchan
    const iqchanDbRootId = Buffer.from(iqlabs.utils.toSeedBytes("iqchan"));
    await checkDbRoot("iqchan", iqchanDbRootId);

    // solchat
    const solchatDbRootId = Buffer.from(iqlabs.utils.toSeedBytes("solchat-root"));
    await checkDbRoot("solchat", solchatDbRootId);

    // moltchat (clawbal) — uses sha256
    const moltDbRootId = createHash("sha256").update("clawbal-iqlabs").digest();
    await checkDbRoot("moltchat (clawbal-iqlabs)", moltDbRootId);
}

main().catch(console.error);
