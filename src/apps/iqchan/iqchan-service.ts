import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {PublicKey, SystemProgram} from "@solana/web3.js";
import type {Connection, Signer} from "@solana/web3.js";
import {BorshAccountsCoder, type Idl} from "@coral-xyz/anchor";
import iqlabs from "@iqlabs-official/solana-sdk";

import {getWalletCtx} from "../../utils/wallet_manager";
import {sendInstruction} from "../../utils/tx";
import {
    DB_ROOT_ID,
    BOARD_METADATA,
    BOARD_COLUMNS,
    BOARD_ID_COL,
    BUMP_LIMIT,
    FEED_SEED_PREFIX,
    THREADS_PER_PAGE,
    REPLY_PREVIEW_COUNT,
    threadTableSeed,
    type Post,
    type ThreadEntry,
} from "./constants";

const require = createRequire(import.meta.url);
const IDL = require("@iqlabs-official/solana-sdk/idl/code_in.json") as Idl;

// ─── Pure helpers ────────────────────────────────────────────────────────────

function mergeInstructions(
    posts: Record<string, unknown>[],
    instructions: Record<string, unknown>[],
): Record<string, unknown>[] {
    if (instructions.length === 0) return posts;

    const byTarget = new Map<string, Record<string, unknown>[]>();
    for (const instr of instructions) {
        const target = instr.target as string | undefined;
        if (!target) continue;
        const list = byTarget.get(target);
        if (list) list.push(instr);
        else byTarget.set(target, [instr]);
    }

    const deleted = new Set<string>();
    const result = posts.map((post) => {
        const sig = post.__txSignature as string | undefined;
        if (!sig) return post;
        const instrList = byTarget.get(sig);
        if (!instrList) return post;

        let merged = {...post};
        for (const instr of instrList) {
            const dataKeys = Object.keys(instr).filter(
                (k) => k !== "target" && k !== "__txSignature",
            );
            if (dataKeys.length === 0) {
                deleted.add(sig);
                return merged;
            }
            if (instr.com !== undefined) {
                merged = {...merged, com: instr.com};
            }
        }
        return merged;
    });

    return result.filter((post) => {
        const sig = post.__txSignature as string | undefined;
        return !sig || !deleted.has(sig);
    });
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class IqchanService {
    readonly connection: Connection;
    readonly signer: Signer;
    readonly dbRootId: Uint8Array;
    readonly programId: PublicKey;
    readonly builder: ReturnType<typeof iqlabs.contract.createInstructionBuilder>;
    readonly accountCoder: BorshAccountsCoder;

    constructor() {
        const {connection, signer} = getWalletCtx();
        this.connection = connection;
        this.signer = signer;
        this.dbRootId = Buffer.from(iqlabs.utils.toSeedBytes(DB_ROOT_ID));
        this.programId = new PublicKey(iqlabs.contract.DEFAULT_ANCHOR_PROGRAM_ID);
        this.builder = iqlabs.contract.createInstructionBuilder(IDL, this.programId);
        this.accountCoder = new BorshAccountsCoder(IDL);
    }

    // ─── Setup ───────────────────────────────────────────────────────────────

    async ensureSetup() {
        // Ensure dbRoot
        const dbRoot = iqlabs.contract.getDbRootPda(this.dbRootId, this.programId);
        const rootInfo = await this.connection.getAccountInfo(dbRoot);
        if (!rootInfo) {
            const ix = iqlabs.contract.initializeDbRootInstruction(
                this.builder,
                {
                    db_root: dbRoot,
                    signer: this.signer.publicKey,
                    system_program: SystemProgram.programId,
                },
                {db_root_id: this.dbRootId},
            );
            await sendInstruction(this.connection, this.signer, ix);
        }

        // Ensure user state
        const user = this.signer.publicKey;
        const userInventory = iqlabs.contract.getUserInventoryPda(user, this.programId);
        const invInfo = await this.connection.getAccountInfo(userInventory);
        if (!invInfo) {
            const ix = iqlabs.contract.userInitializeInstruction(this.builder, {
                user,
                code_account: iqlabs.contract.getCodeAccountPda(user, this.programId),
                user_state: iqlabs.contract.getUserPda(user, this.programId),
                user_inventory: userInventory,
                system_program: SystemProgram.programId,
            });
            await sendInstruction(this.connection, this.signer, ix);
        }
    }

    // ─── PDA ─────────────────────────────────────────────────────────────────

    getFeedPda(boardId: string): PublicKey {
        const dbRoot = iqlabs.contract.getDbRootPda(this.dbRootId, this.programId);
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from(FEED_SEED_PREFIX),
                this.programId.toBuffer(),
                dbRoot.toBuffer(),
                Buffer.from(iqlabs.utils.toSeedBytes(boardId)),
            ],
            this.programId,
        )[0];
    }

    // ─── Reads ───────────────────────────────────────────────────────────────

    async listBoards(): Promise<Array<{ id: string; title: string; description: string }>> {
        const list = await iqlabs.reader.getTablelistFromRoot(
            this.connection,
            this.dbRootId,
        );

        const knownSeeds = new Set(
            Object.keys(BOARD_METADATA).map((id) =>
                Buffer.from(iqlabs.utils.toSeedBytes(id)).toString("hex"),
            ),
        );

        const boards: Array<{ id: string; title: string; description: string }> =
            Object.entries(BOARD_METADATA).map(([id, m]) => ({
                id,
                title: m.title,
                description: m.description,
            }));

        // Append unknown boards from on-chain
        const dbRoot = iqlabs.contract.getDbRootPda(this.dbRootId, this.programId);
        const allSeeds = [...new Set([...list.tableSeeds, ...list.globalTableSeeds])];

        for (const seedHex of allSeeds) {
            if (knownSeeds.has(seedHex)) continue;

            let name = seedHex;
            const seed = Buffer.from(seedHex, "hex");
            const table = iqlabs.contract.getTablePda(dbRoot, seed, this.programId);
            const info = await this.connection.getAccountInfo(table);
            if (info) {
                try {
                    const decoded = this.accountCoder.decode("Table", info.data) as {
                        name: Uint8Array;
                    };
                    const decodedName = Buffer.from(decoded.name)
                        .toString("utf8")
                        .replace(/\0+$/, "")
                        .trim();
                    if (decodedName) name = decodedName;
                } catch {
                    // ignore
                }
            }

            boards.push({id: name, title: name, description: ""});
        }

        return boards;
    }

    async fetchFeedThreads(boardId: string): Promise<ThreadEntry[]> {
        const feedPda = this.getFeedPda(boardId);
        const feedRows = await iqlabs.reader.readTableRows(feedPda, {
            limit: THREADS_PER_PAGE * 3,
        });

        const threads = new Map<string, ThreadEntry>();

        for (const row of feedRows) {
            const post = row as unknown as Post;
            if (!post.threadPda) continue;

            const time = post.time ?? 0;
            const existing = threads.get(post.threadPda);

            if (existing) {
                if (!existing.opData || time < existing.opData.time) {
                    existing.opData = post;
                }
                existing.lastActivityTime = Math.max(existing.lastActivityTime, time);
                if (!existing.threadSeed && post.threadSeed) {
                    existing.threadSeed = post.threadSeed;
                }
            } else {
                threads.set(post.threadPda, {
                    threadPda: post.threadPda,
                    threadSeed: post.threadSeed,
                    opData: post,
                    lastActivityTime: time,
                    replyCount: 0,
                    lastReplies: [],
                });
            }
        }

        // Fetch reply previews for each thread
        await Promise.all(
            [...threads.values()].map(async (entry) => {
                try {
                    const rows = await iqlabs.reader.readTableRows(entry.threadPda, {
                        limit: 50,
                    });

                    const opFromRows = (rows as unknown as Post[])
                        .filter((r) => !!r.threadSeed)
                        .reduce<Post | undefined>(
                            (a, b) => (!a || b.time < a.time ? b : a),
                            undefined,
                        );
                    if (opFromRows && !entry.opData) entry.opData = opFromRows;
                    if (opFromRows?.threadSeed && !entry.threadSeed) {
                        entry.threadSeed = opFromRows.threadSeed;
                    }

                    const opSig = entry.opData?.__txSignature ?? opFromRows?.__txSignature;
                    const replies = (rows as unknown as Post[])
                        .filter((r) => r.__txSignature !== opSig)
                        .sort((a, b) => a.time - b.time);

                    entry.replyCount = replies.length;
                    entry.lastReplies = replies.slice(-REPLY_PREVIEW_COUNT);
                } catch {
                    // skip threads that fail to load
                }
            }),
        );

        return [...threads.values()]
            .filter((t) => t.opData !== null)
            .sort((a, b) => b.lastActivityTime - a.lastActivityTime);
    }

    async readThread(
        threadPda: string,
        threadSeed: string,
        boardId?: string,
    ): Promise<{ op: Post | null; replies: Post[] }> {
        const rows = await iqlabs.reader.readTableRows(threadPda);
        const posts = rows as unknown as Post[];

        // Try to get OP from feed if boardId is provided
        let feedOp: Post | undefined;
        if (boardId) {
            try {
                const feedPda = this.getFeedPda(boardId);
                const feedRows = await iqlabs.reader.readTableRows(feedPda, {limit: 100});
                feedOp = (feedRows as unknown as Post[]).find(
                    (r) => r.threadPda === threadPda && !!r.threadSeed,
                );
            } catch {
                // ignore feed read errors
            }
        }

        // Fetch and merge edit/delete instructions
        const dbRoot = iqlabs.contract.getDbRootPda(this.dbRootId, this.programId);
        const instrSeed = Buffer.from(iqlabs.utils.toSeedBytes(threadSeed));
        const instrTable = iqlabs.contract.getInstructionTablePda(dbRoot, instrSeed, this.programId);

        let instrRows: Record<string, unknown>[] = [];
        try {
            instrRows = await iqlabs.reader.readTableRows(instrTable);
        } catch {
            // no instructions yet
        }

        const merged = mergeInstructions(rows, instrRows) as unknown as Post[];

        // Find OP: has threadSeed + earliest time
        let op = merged
            .filter((r) => !!r.threadSeed)
            .sort((a, b) => a.time - b.time)[0] ?? feedOp ?? null;

        const opSig = op?.__txSignature;
        const replies = merged
            .filter((r) => r.__txSignature !== opSig)
            .sort((a, b) => a.time - b.time);

        return {op, replies};
    }

    // ─── Writes ──────────────────────────────────────────────────────────────

    async createThread(
        boardId: string,
        data: { sub: string; com: string; name: string; img?: string },
    ): Promise<{ threadSeed: string; txSignature: string }> {
        const rid = randomUUID();
        const seed = threadTableSeed(boardId, rid);
        const dbRoot = iqlabs.contract.getDbRootPda(this.dbRootId, this.programId);
        const seedBytes = Buffer.from(iqlabs.utils.toSeedBytes(seed));
        const boardSeedBytes = Buffer.from(iqlabs.utils.toSeedBytes(boardId));
        const tablePda = iqlabs.contract.getTablePda(dbRoot, seedBytes, this.programId);
        const instrPda = iqlabs.contract.getInstructionTablePda(dbRoot, seedBytes, this.programId);
        const feedPda = this.getFeedPda(boardId);

        // TX1: Create thread ext table
        const ix = iqlabs.contract.createExtTableInstruction(
            this.builder,
            {
                signer: this.signer.publicKey,
                db_root: dbRoot,
                table: tablePda,
                instruction_table: instrPda,
                system_program: SystemProgram.programId,
            },
            {
                db_root_id: this.dbRootId,
                table_seed: seedBytes,
                table_name: Buffer.from(seed),
                column_names: BOARD_COLUMNS.map((c) => Buffer.from(c)),
                id_col: Buffer.from(BOARD_ID_COL),
                ext_keys: [],
                gate_opt: null,
                writers_opt: null,
            },
        );
        await sendInstruction(this.connection, this.signer, ix);

        // TX2: Write OP row to board table with feed bump
        const row = {
            sub: data.sub,
            com: data.com,
            name: data.name,
            time: Math.floor(Date.now() / 1000),
            ...(data.img ? {img: data.img} : {}),
            threadPda: tablePda.toBase58(),
            threadSeed: seed,
        };

        const txSignature = await iqlabs.writer.writeRow(
            this.connection,
            this.signer,
            this.dbRootId,
            boardSeedBytes,
            JSON.stringify(row),
            false,
            [feedPda],
        );

        return {threadSeed: seed, txSignature};
    }

    async postReply(
        threadSeed: string,
        threadPda: string,
        boardId: string,
        data: { com: string; name: string; img?: string },
        replyCount = 0,
    ): Promise<string> {
        const seedBytes = Buffer.from(iqlabs.utils.toSeedBytes(threadSeed));
        const shouldBump = replyCount < BUMP_LIMIT;
        const remaining = shouldBump ? [this.getFeedPda(boardId)] : [];

        const row = {
            sub: "",
            com: data.com,
            name: data.name,
            time: Math.floor(Date.now() / 1000),
            ...(data.img ? {img: data.img} : {}),
            threadPda,
            threadSeed,
        };

        return iqlabs.writer.writeRow(
            this.connection,
            this.signer,
            this.dbRootId,
            seedBytes,
            JSON.stringify(row),
            false,
            remaining,
        );
    }

    async editPost(threadSeed: string, targetTxSig: string, newCom: string): Promise<string> {
        const seedBytes = Buffer.from(iqlabs.utils.toSeedBytes(threadSeed));
        return iqlabs.writer.manageRowData(
            this.connection,
            this.signer,
            this.dbRootId,
            seedBytes,
            JSON.stringify({target: targetTxSig, com: newCom}),
            threadSeed,
            targetTxSig,
        );
    }

    async deletePost(threadSeed: string, targetTxSig: string): Promise<string> {
        const seedBytes = Buffer.from(iqlabs.utils.toSeedBytes(threadSeed));
        return iqlabs.writer.manageRowData(
            this.connection,
            this.signer,
            this.dbRootId,
            seedBytes,
            "{}",
            threadSeed,
            targetTxSig,
        );
    }
}
