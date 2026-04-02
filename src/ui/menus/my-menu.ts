import * as fs from "node:fs";
import * as path from "node:path";
import iqlabs from "@iqlabs-official/solana-sdk";

import {ChatService} from "../../apps/chat/chat-service";
import {getWalletCtx} from "../../utils/wallet_manager";
import {logError, logInfo} from "../../utils/logger";
import {prompt} from "../../utils/prompt";
import {openFriendList} from "./chat";

const showMenu = () => {
    console.log("\n============================");
    console.log("         My Menu            ");
    console.log("============================\n");
    console.log("  1) RPC Settings");
    console.log("  2) My Profile");
    console.log("  3) My Inventory");
    console.log("  4) DM Inbox");
    console.log("");
    console.log("  9) Back");
    console.log("\n============================\n");
};

const ENV_PATH = path.join(process.cwd(), ".env");

const saveRpcToEnv = (url: string) => {
    let content = "";
    if (fs.existsSync(ENV_PATH)) {
        content = fs.readFileSync(ENV_PATH, "utf8");
    }
    const key = "SOLANA_RPC_ENDPOINT";
    const line = `${key}=${url}`;
    if (content.includes(key)) {
        content = content.replace(new RegExp(`^${key}=.*$`, "m"), line);
    } else {
        content = content.trimEnd() + (content ? "\n" : "") + line + "\n";
    }
    fs.writeFileSync(ENV_PATH, content, "utf8");
};

const rpcSettings = async () => {
    const current = iqlabs.getRpcUrl();
    logInfo(`Current RPC: ${current}`);
    console.log("");
    console.log("Paste your RPC endpoint URL below (empty to keep current):");
    const newUrl = (await prompt("> ")).trim();
    if (newUrl) {
        iqlabs.setRpcUrl(newUrl);
        saveRpcToEnv(newUrl);
        logInfo(`RPC updated and saved: ${newUrl}`);
    }
    await prompt("Press Enter to continue...");
};

const showProfile = async () => {
    const {signer} = getWalletCtx();
    const pubkey = signer.publicKey.toBase58();
    logInfo(`Public Key: ${pubkey}`);

    try {
        const state = await iqlabs.reader.readUserState(pubkey);
        logInfo("User State:", state);
    } catch {
        logInfo("No user state found on-chain");
    }
    await prompt("Press Enter to continue...");
};

const showInventory = async () => {
    const {connection, signer} = getWalletCtx();
    const pubkey = signer.publicKey;
    const inventoryPda = iqlabs.contract.getUserInventoryPda(pubkey);
    logInfo(`Inventory PDA: ${inventoryPda.toBase58()}`);

    const info = await connection.getAccountInfo(inventoryPda);
    if (info) {
        logInfo(`Account exists, data length: ${info.data.length} bytes`);
        logInfo(`Lamports: ${info.lamports}`);
    } else {
        logInfo("Inventory account not initialized");
    }
    await prompt("Press Enter to continue...");
};

const dmInbox = async () => {
    const service = new ChatService();
    try {
        await service.setupCliDemo();
    } catch (err) {
        logError("Chat setup failed", err);
        await prompt("Press Enter to continue...");
        return;
    }
    await openFriendList(service);
};

export const runMyMenu = async () => {
    let running = true;
    while (running) {
        console.clear();
        showMenu();
        const choice = (await prompt("Select: ")).trim();
        try {
            switch (choice) {
                case "1":
                    await rpcSettings();
                    break;
                case "2":
                    await showProfile();
                    break;
                case "3":
                    await showInventory();
                    break;
                case "4":
                    await dmInbox();
                    break;
                case "9":
                    running = false;
                    break;
                default:
                    logError("Invalid option");
                    await prompt("Press Enter to continue...");
            }
        } catch (err) {
            logError("Error", err);
            await prompt("Press Enter to continue...");
        }
    }
};
