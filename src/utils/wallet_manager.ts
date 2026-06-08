import * as fs from "node:fs";
import * as path from "node:path";
import os from "node:os";
import { Connection, Keypair } from "@solana/web3.js";

const DEFAULT_RPC_ENDPOINT =
    process.env.SOLANA_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";

const DEFAULT_KEYPAIR_DIR = path.join(os.homedir(), ".config", "solana");
const DEFAULT_KEYPAIR_PATH = path.join(DEFAULT_KEYPAIR_DIR, "id.json");

const resolveKeypairInfo = (): KeypairInfo => {
    if (process.env.SOLANA_KEYPAIR_PATH) {
        return {
            path: process.env.SOLANA_KEYPAIR_PATH,
            exists: fs.existsSync(process.env.SOLANA_KEYPAIR_PATH),
            source: "env",
        };
    }

    const localKeypair = path.join(process.cwd(), "keypair.json");
    if (fs.existsSync(localKeypair)) {
        return {
            path: localKeypair,
            exists: true,
            source: "local",
        };
    }

    return {
        path: DEFAULT_KEYPAIR_PATH,
        exists: fs.existsSync(DEFAULT_KEYPAIR_PATH),
        source: "default",
    };
};

const resolveKeypairPath = (): string => resolveKeypairInfo().path;

const loadKeypair = (keypairPath: string): Keypair => {
    const raw = fs.readFileSync(keypairPath, "utf8");
    const secret = JSON.parse(raw);
    if (!Array.isArray(secret)) {
        throw new Error(`Invalid keypair file: ${keypairPath}`);
    }
    return Keypair.fromSecretKey(Uint8Array.from(secret));
};

export const generateKeypair = (): { keypair: Keypair; path: string } => {
    const keypair = Keypair.generate();
    const secret = Array.from(keypair.secretKey);

    if (!fs.existsSync(DEFAULT_KEYPAIR_DIR)) {
        fs.mkdirSync(DEFAULT_KEYPAIR_DIR, { recursive: true });
    }
    fs.writeFileSync(DEFAULT_KEYPAIR_PATH, JSON.stringify(secret), "utf8");
    return { keypair, path: DEFAULT_KEYPAIR_PATH };
};

export const getKeypairInfo = (): KeypairInfo => {
    return resolveKeypairInfo();
};

export const getWalletCtx = () => {
    const keypairPath = resolveKeypairPath();
    if (!fs.existsSync(keypairPath)) {
        throw new Error(`Keypair not found: ${keypairPath}`);
    }

    const signer = loadKeypair(keypairPath);
    const connection = new Connection(DEFAULT_RPC_ENDPOINT, "confirmed");

    return { connection, signer };
};

export type KeypairInfo = {
    path: string;
    exists: boolean;
    source: "env" | "local" | "default";
};

export const validateKeypairPath = (keypairPath: string): Keypair => {
    if (!fs.existsSync(keypairPath)) {
        throw new Error(`Keypair not found: ${keypairPath}`);
    }

    return loadKeypair(keypairPath);
};