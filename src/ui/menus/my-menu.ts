import iqlabs from "@iqlabs-official/solana-sdk";

import {ChatService} from "../../apps/chat/chat-service";
import {getWalletCtx, getKeypairInfo, validateKeypairPath} from "../../utils/wallet_manager";
import {saveEnvVar, getGatewayUrl, setGatewayUrl} from "../../utils/config";
import {logError, logInfo, logWarn, RESET, BOLD, DIM, CYAN, GREEN, WHITE} from "../../utils/logger";
import {prompt, selectFromList} from "../../utils/prompt";
import {openFriendList} from "./chat";

const rpcSettings = async () => {
    const current = iqlabs.getRpcUrl();
    logInfo(`Current RPC: ${current}`);
    console.log("");
    console.log("Paste your RPC endpoint URL below (empty to keep current):");
    const newUrl = (await prompt("> ")).trim();
    if (newUrl) {
        iqlabs.setRpcUrl(newUrl);
        saveEnvVar("SOLANA_RPC_ENDPOINT", newUrl);
        logInfo(`RPC updated and saved: ${newUrl}`);
    }
    await prompt("Press Enter to continue...");
};

const gatewaySettings = async () => {
    const current = getGatewayUrl() || "(none — using direct RPC)";
    logInfo(`Current Gateway: ${current}`);
    console.log("");
    console.log("Paste gateway URL (empty to clear, keeps RPC fallback):");
    const newUrl = (await prompt("> ")).trim();
    if (newUrl) {
        setGatewayUrl(newUrl);
        saveEnvVar("GATEWAY_URL", newUrl);
        logInfo(`Gateway set: ${newUrl}`);
    } else {
        setGatewayUrl("");
        saveEnvVar("GATEWAY_URL", "");
        logInfo("Gateway cleared — using direct RPC");
    }
    await prompt("Press Enter to continue...");
};

const walletSettings = async () => {
    const info = getKeypairInfo();

    logInfo(`Current wallet path: ${info.path}`);
    logInfo(`Source: ${info.source}`);
    logInfo(`Exists: ${info.exists ? "yes" : "no"}`);

    if (info.exists) {
        try {
            const signer = validateKeypairPath(info.path);
            logInfo(`Public key: ${signer.publicKey.toBase58()}`);
        } catch {
            logWarn("Current wallet file exists, but is not a valid Solana keypair");
        }
    }

    console.log("");
    console.log("Paste a Solana keypair JSON path below.");
    console.log("Leave empty to keep the current wallet.");
    const newPath = (await prompt("> ")).trim();

    if (!newPath) {
        logInfo("Wallet unchanged");
        await prompt("Press Enter to continue...");
        return;
    }

    try {
        const signer = validateKeypairPath(newPath);
        saveEnvVar("SOLANA_KEYPAIR_PATH", newPath);

        logInfo(`Wallet path saved: ${newPath}`);
        logInfo(`Public key: ${signer.publicKey.toBase58()}`);
        logWarn("Restart the CLI for the wallet change to fully apply.");
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logError("Invalid wallet path", msg);
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
    {label: "Gateway Settings", action: gatewaySettings},
    {label: "Wallet Settings", action: walletSettings},
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
