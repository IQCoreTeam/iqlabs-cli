import * as fs from "node:fs";
import * as path from "node:path";
import {PublicKey} from "@solana/web3.js";
import type {Connection, Signer} from "@solana/web3.js";
import {BorshAccountsCoder} from "@coral-xyz/anchor";
import iqlabs from "@iqlabs-official/solana-sdk";

import {getWalletCtx} from "../../utils/wallet_manager";
import {gwFetchRows, gwNotify} from "../../utils/gateway";
import {makeMessageId} from "../../utils/id";
import {ensureDbRoot} from "../iqdb-helpers";

export type SpeedProfile = "light" | "medium" | "heavy" | "extreme";

// IQ Plaza — the public, unmoderated IQDB drop. Anyone can create folders
// and upload files. dbRootId here is fixed because the menu narrative
// ("IQ Plaza / the degen dump") only exists for this one root.
export const PLAZA_DB_ROOT_ID = "iq-plaza";
const PLAZA_DB_ROOT_BYTES = Buffer.from(PLAZA_DB_ROOT_ID, "utf8");

// File row schema for plaza folders. Kept minimal on purpose:
//   id        - row id (uuid-ish)
//   name      - filename without extension
//   ext       - extension only (no dot)
//   sig       - codeIn tx signature; this is the actual download key
//   uploader  - wallet base58 of whoever wrote this row
//   timestamp - Date.now() (ms)
const PLAZA_FILE_COLUMNS = ["id", "name", "ext", "sig", "uploader", "timestamp"];
const PLAZA_FILE_ID_COL = "id";

export interface PlazaFolder {
    name: string;          // human-readable seed
    seed: Uint8Array;      // PDA seed bytes
    table: PublicKey;      // table PDA
    isPublic: boolean;     // writers.length === 0
    ownerLabel: string;    // "public" or shortened owner wallet
    lastTimestamp: number; // unix seconds
}

export interface PlazaFile {
    id: string;
    name: string;
    ext: string;
    sig: string;
    uploader: string;
    timestamp: number;
}

// FileShareService is intentionally tiny. It exists only because uploads and
// downloads need to bridge a real file path on disk with the SDK's
// string-in / string-out shape. Anything that's just a one-line SDK call
// (peeking metadata, listing inventory signatures) belongs in the menu, not
// here — there should not be wrapper methods whose only purpose is to
// re-export an SDK function.
export class FileShareService {
    readonly connection: Connection;
    readonly signer: Signer;
    readonly programId: PublicKey;
    readonly accountCoder: BorshAccountsCoder;

    constructor() {
        const {connection, signer} = getWalletCtx();
        this.connection = connection;
        this.signer = signer;
        this.programId = new PublicKey(iqlabs.contract.DEFAULT_ANCHOR_PROGRAM_ID);
        this.accountCoder = new BorshAccountsCoder(iqlabs.contract.IQ_IDL);
    }

    // Reads a file from disk, base64-encodes it, and uploads via codeIn.
    // Returns the final tx signature, which is what callers need to share.
    async uploadFile(
        filePath: string,
        speed: SpeedProfile,
        onProgress: (pct: number) => void,
    ): Promise<string> {
        const buf = fs.readFileSync(filePath);
        const base64 = buf.toString("base64");
        const filename = path.basename(filePath);
        // filetype is left undefined so the SDK auto-detects via magic bytes.
        return iqlabs.writer.codeIn(
            {connection: this.connection, signer: this.signer},
            base64,
            filename,
            0,
            undefined,
            onProgress,
            speed,
        );
    }

    // Downloads via readCodeIn, base64-decodes, writes to destPath. Caller
    // is responsible for resolving the destination path (incl. ~ expansion);
    // we just make sure the parent directory exists before writing.
    async downloadFile(
        signature: string,
        destPath: string,
        speed: SpeedProfile,
        onProgress: (pct: number) => void,
    ): Promise<{bytesWritten: number; filename: string}> {
        const {metadata, data} = await iqlabs.reader.readCodeIn(
            signature,
            speed,
            onProgress,
        );
        if (!data) {
            throw new Error("downloaded payload is empty");
        }
        let filename = "";
        try {
            const meta = JSON.parse(metadata);
            if (typeof meta?.filename === "string") filename = meta.filename;
        } catch {
            // metadata may not be JSON for non-file inventory entries
        }
        const buf = Buffer.from(data, "base64");
        fs.mkdirSync(path.dirname(destPath), {recursive: true});
        fs.writeFileSync(destPath, buf);
        return {bytesWritten: buf.length, filename};
    }

    // ── IQ Plaza (public IQDB drop) ──────────────────────────────────────

    // List every plaza folder. Skips legacy 32-byte hashed seeds (un-migrated
    // entries from older sdk versions) the same way ChatService.listRooms
    // does. Returns visibility info so the menu can tag public vs private.
    async listPlazaFolders(): Promise<PlazaFolder[]> {
        const list = await iqlabs.reader.getTablelistFromRoot(
            this.connection,
            PLAZA_DB_ROOT_BYTES,
        );
        const dbRoot = iqlabs.contract.getDbRootPda(PLAZA_DB_ROOT_BYTES, this.programId);

        const folders: PlazaFolder[] = [];
        const seedHexes = [
            ...new Set([
                ...((list.tableSeeds as string[]) ?? []),
                ...((list.globalTableSeeds as string[]) ?? []),
            ]),
        ];

        for (const seedHex of seedHexes) {
            const rawBytes = Buffer.from(seedHex, "hex");
            const utf8 = rawBytes.toString("utf8");
            const isReadable = rawBytes.length < 32 && /^[\x20-\x7e]+$/.test(utf8);
            if (!isReadable) continue;

            const pdaSeed = Buffer.from(iqlabs.utils.toSeedBytes(utf8));
            const table = iqlabs.contract.getTablePda(dbRoot, pdaSeed, this.programId);

            const info = await this.connection.getAccountInfo(table);
            if (!info) continue;

            let writers: PublicKey[] = [];
            let lastTimestamp = 0;
            try {
                const decoded = this.accountCoder.decode("Table", info.data) as {
                    writers: Uint8Array[] | PublicKey[];
                    last_timestamp: {toNumber?: () => number} | number | bigint;
                };
                writers = (decoded.writers ?? []).map((w) =>
                    w instanceof PublicKey ? w : new PublicKey(w),
                );
                const ts = decoded.last_timestamp;
                if (typeof ts === "number") lastTimestamp = ts;
                else if (typeof ts === "bigint") lastTimestamp = Number(ts);
                else if (ts && typeof ts.toNumber === "function") lastTimestamp = ts.toNumber();
            } catch {
                // table account exists but couldn't decode — skip it
                continue;
            }

            const isPublic = writers.length === 0;
            const ownerLabel = isPublic
                ? "public"
                : `${writers[0].toBase58().slice(0, 4)}...${writers[0].toBase58().slice(-4)}`;

            folders.push({
                name: utf8,
                seed: pdaSeed,
                table,
                isPublic,
                ownerLabel,
                lastTimestamp,
            });
        }

        return folders.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    }

    // Create a new plaza folder. visibility=public → writers []; visibility
    // =private → writers [self]. dbRoot is created on first use.
    async createPlazaFolder(
        name: string,
        isPublic: boolean,
    ): Promise<{signature: string; created: boolean; folder: PlazaFolder}> {
        await ensureDbRoot(this.connection, this.signer, this.programId, PLAZA_DB_ROOT_BYTES);

        const dbRoot = iqlabs.contract.getDbRootPda(PLAZA_DB_ROOT_BYTES, this.programId);
        const seed = Buffer.from(iqlabs.utils.toSeedBytes(name));
        const table = iqlabs.contract.getTablePda(dbRoot, seed, this.programId);

        const existing = await this.connection.getAccountInfo(table);
        if (existing) {
            return {
                signature: "",
                created: false,
                folder: {
                    name,
                    seed,
                    table,
                    isPublic,
                    ownerLabel: isPublic ? "public" : "you",
                    lastTimestamp: 0,
                },
            };
        }

        const writers = isPublic ? [] : [this.signer.publicKey];
        const signature = await iqlabs.writer.createTable(
            this.connection,
            this.signer,
            PLAZA_DB_ROOT_BYTES,
            name,
            name,
            PLAZA_FILE_COLUMNS,
            PLAZA_FILE_ID_COL,
            [],
            undefined,
            writers,
            name,
        );

        return {
            signature,
            created: true,
            folder: {
                name,
                seed,
                table,
                isPublic,
                ownerLabel: isPublic
                    ? "public"
                    : `${this.signer.publicKey.toBase58().slice(0, 4)}...${this.signer.publicKey.toBase58().slice(-4)}`,
                lastTimestamp: Math.floor(Date.now() / 1000),
            },
        };
    }

    // Read all file rows from a plaza folder. Returns parsed PlazaFile shapes;
    // rows that don't conform are skipped.
    async listPlazaFiles(folderSeed: Uint8Array): Promise<PlazaFile[]> {
        const dbRoot = iqlabs.contract.getDbRootPda(PLAZA_DB_ROOT_BYTES, this.programId);
        const table = iqlabs.contract.getTablePda(dbRoot, folderSeed, this.programId);
        const rows = await gwFetchRows(table.toBase58(), 100);

        const out: PlazaFile[] = [];
        for (const raw of rows) {
            const r = (typeof raw === "string"
                ? (() => { try { return JSON.parse(raw); } catch { return null; } })()
                : raw) as Record<string, unknown> | null;
            if (!r || typeof r.sig !== "string") continue;
            out.push({
                id: typeof r.id === "string" ? r.id : "",
                name: typeof r.name === "string" ? r.name : "",
                ext: typeof r.ext === "string" ? r.ext : "",
                sig: r.sig,
                uploader: typeof r.uploader === "string" ? r.uploader : "",
                timestamp: typeof r.timestamp === "number" ? r.timestamp : 0,
            });
        }
        return out.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Append a file row to a plaza folder. Caller must have already uploaded
    // the file payload via uploadFile() and gotten the codeIn signature.
    async writePlazaFileRow(
        folderSeed: Uint8Array,
        file: {name: string; ext: string; sig: string},
    ): Promise<string> {
        const row = {
            id: makeMessageId(12),
            name: file.name,
            ext: file.ext,
            sig: file.sig,
            uploader: this.signer.publicKey.toBase58(),
            timestamp: Date.now(),
        };
        const txSignature = await iqlabs.writer.writeRow(
            this.connection,
            this.signer,
            PLAZA_DB_ROOT_BYTES,
            folderSeed,
            JSON.stringify(row),
        );
        const dbRoot = iqlabs.contract.getDbRootPda(PLAZA_DB_ROOT_BYTES, this.programId);
        const table = iqlabs.contract.getTablePda(dbRoot, folderSeed, this.programId);
        await gwNotify(table.toBase58(), txSignature, row, this.signer.publicKey.toBase58());
        return txSignature;
    }
}
