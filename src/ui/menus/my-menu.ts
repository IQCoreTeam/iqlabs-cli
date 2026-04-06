import * as fs from "node:fs";
import * as path from "node:path";
import iqlabs from "@iqlabs-official/solana-sdk";

import {ChatService} from "../../apps/chat/chat-service";
import {getWalletCtx} from "../../utils/wallet_manager";
import {logError, logInfo, logWarn, RESET, BOLD, DIM, CYAN, GREEN, WHITE} from "../../utils/logger";
import {prompt, selectFromList} from "../../utils/prompt";
import {openFriendList} from "./chat";

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

    const info = await connection.getAccountInfo(inventoryPda);
    if (!info) {
        logInfo("Inventory account not initialized");
        await prompt("Press Enter to continue...");
        return;
    }

    // Fetch all transaction signatures for this inventory
    logInfo("Fetching inventory transactions...");
    let allSigs: string[];
    try {
        allSigs = await iqlabs.reader.collectSignatures(inventoryPda, 1000);
    } catch {
        logError("Failed to fetch transactions");
        await prompt("Press Enter to continue...");
        return;
    }

    if (allSigs.length === 0) {
        logInfo("No inventory items found");
        await prompt("Press Enter to continue...");
        return;
    }

    // Show transaction list, select to view
    const items = allSigs.map((sig, i) => ({
        label: `${i + 1}. ${sig.slice(0, 12)}...${sig.slice(-8)}`,
        sig,
    }));

    while (true) {
        const index = await selectFromList(
            `\n  ${BOLD}${CYAN}Inventory${RESET} ${DIM}(${allSigs.length} items)${RESET}`,
            items,
            (item, selected) => {
                return selected
                    ? `  ${BOLD}${CYAN}> ${WHITE}${item.label}${RESET}`
                    : `  ${DIM}  ${item.label}${RESET}`;
            },
        );

        if (index === null) return;

        // Fetch and display selected item
        console.clear();
        logInfo(`Reading ${items[index].label}...`);
        try {
            const result = await iqlabs.reader.readCodeIn(items[index].sig);
            console.log("");
            if (result.metadata) {
                console.log(`  ${BOLD}Metadata:${RESET} ${result.metadata}`);
            }
            if (result.data) {
                try {
                    const parsed = JSON.parse(result.data);
                    console.log(`  ${BOLD}Data:${RESET}`);
                    console.log(JSON.stringify(parsed, null, 2).split("\n").map(l => `    ${l}`).join("\n"));
                } catch {
                    console.log(`  ${BOLD}Data:${RESET} ${result.data.slice(0, 200)}${result.data.length > 200 ? "..." : ""}`);
                }
            } else {
                console.log(`  ${DIM}(no data)${RESET}`);
            }
        } catch (err) {
            logError("Failed to read", err instanceof Error ? err.message : String(err));
        }
        console.log("");
        await prompt("Press Enter to go back...");
    }
};

const dmInbox = async () => {
    const service = new ChatService();
    try {
        await service.setupCliDemo();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Insufficient SOL")) {
            const {signer} = getWalletCtx();
            logError("Insufficient SOL balance — your wallet has 0 SOL.");
            logWarn(`Please fund this wallet to continue:`);
            console.log(`\n  ${CYAN}${signer.publicKey.toBase58()}${RESET}\n`);
        } else {
            logError("Chat setup failed", err);
        }
        await prompt("Press Enter to continue...");
        return;
    }
    await openFriendList(service);
};

const MY_MENU_ITEMS = [
    {label: "RPC Settings", action: rpcSettings},
    {label: "My Profile", action: showProfile},
    {label: "My Inventory", action: showInventory},
    {label: "DM Inbox", action: dmInbox},
    {label: "Back", action: null},
];

export const runMyMenu = async () => {
    const {signer} = getWalletCtx();
    const pubkey = signer.publicKey.toBase58();

    while (true) {
        const index = await selectFromList(
            `\n  ${BOLD}${CYAN}╔══════════════════════════╗${RESET}\n  ${BOLD}${CYAN}║        My Menu           ║${RESET}\n  ${BOLD}${CYAN}╚══════════════════════════╝${RESET}\n  ${DIM}Wallet: ${GREEN}${pubkey}${RESET}`,
            MY_MENU_ITEMS,
            (item, selected) => {
                if (item.action === null) {
                    return selected
                        ? `  ${DIM}${CYAN}> ${WHITE}Back${RESET}`
                        : `  ${DIM}  Back${RESET}`;
                }
                return selected
                    ? `  ${BOLD}${CYAN}> ${WHITE}${item.label}${RESET}`
                    : `  ${DIM}  ${item.label}${RESET}`;
            },
        );

        if (index === null || MY_MENU_ITEMS[index].action === null) break;

        try {
            await MY_MENU_ITEMS[index].action!();
        } catch (err) {
            logError("Error", err);
            await prompt("Press Enter to continue...");
        }
    }
};
