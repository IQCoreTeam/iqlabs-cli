import * as fs from "node:fs";
import * as path from "node:path";
import os from "node:os";
import { Connection, Keypair } from "@solana/web3.js";

const DEFAULT_RPC_ENDPOINT =
    process.env.SOLANA_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";

const DEFAULT_KEYPAIR_DIR = path.join(os.homedir(), ".config", "solana");
const DEFAULT_KEYPAIR_PATH = path.join(DEFAULT_KEYPAIR_DIR, "id.json");

const resolveKeypairPath = (): string => {
    const localKeypair = path.join(process.cwd(), "keypair.json");
    if (fs.existsSync(localKeypair)) return localKeypair;
    if (process.env.SOLANA_KEYPAIR_PATH) return process.env.SOLANA_KEYPAIR_PATH;
    return DEFAULT_KEYPAIR_PATH;
};

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

export const getKeypairInfo = (): { path: string; exists: boolean } => {
    const kpPath = resolveKeypairPath();
    return { path: kpPath, exists: fs.existsSync(kpPath) };
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
