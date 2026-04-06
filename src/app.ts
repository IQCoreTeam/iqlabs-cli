import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import {Connection} from "@solana/web3.js";
import iqlabs from "@iqlabs-official/solana-sdk";

import {runMainMenu} from "./ui/menus/main";
import {closeReadline, prompt} from "./utils/prompt";
import {getKeypairInfo, generateKeypair, getWalletCtx} from "./utils/wallet_manager";
import {RESET, BOLD, DIM, CYAN, GREEN, YELLOW, RED} from "./utils/logger";

const ENV_PATH = path.join(process.cwd(), ".env");

const LOGO = `
${CYAN}${BOLD}  ██╗ ██████╗ ██╗      █████╗ ██████╗ ███████╗
  ██║██╔═══██╗██║     ██╔══██╗██╔══██╗██╔════╝
  ██║██║   ██║██║     ███████║██████╔╝███████╗
  ██║██║▄▄ ██║██║     ██╔══██║██╔══██╗╚════██║
  ██║╚██████╔╝███████╗██║  ██║██████╔╝███████║
  ╚═╝ ╚══▀▀═╝ ╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝${RESET}
${DIM}  Solana Internet CLI${RESET}
`;

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

const showLogo = () => {
    console.clear();
    console.log(LOGO);
};

const main = async () => {
    // 1. Ensure keypair
    const {path: kpPath, exists} = getKeypairInfo();
    if (!exists) {
        const result = generateKeypair();
        showLogo();
        console.log(`  ${GREEN}Wallet created!${RESET}`);
        console.log(`  ${DIM}Saved to: ${result.path}${RESET}`);
        console.log(`  ${DIM}Public key: ${GREEN}${result.keypair.publicKey.toBase58()}${RESET}`);
        console.log("");
    }

    // 2. Check RPC
    const rpcUrl = process.env.SOLANA_RPC_ENDPOINT;
    if (!rpcUrl || !rpcUrl.startsWith("https://mainnet.helius-rpc.com/?ap")) {
        showLogo();
        console.log(`  ${YELLOW}RPC endpoint not configured.${RESET}`);
        console.log(`  ${DIM}Free public RPC is too slow for this app.${RESET}`);
        console.log("");
        console.log(`  ${BOLD}To start, get a free RPC key:${RESET}`);
        console.log(`  ${CYAN}https://www.helius.dev${RESET}`);
        console.log("");
        console.log(`  ${DIM}Paste your Helius RPC URL below:${RESET}`);

        while (true) {
            const url = (await prompt("  > ")).trim();
            if (!url) {
                console.log(`\n  ${RED}RPC is required. Try again.${RESET}`);
                continue;
            }
            if (!url.startsWith("https://mainnet.helius-rpc.com/?ap")) {
                console.log(`\n  ${RED}Invalid URL. Must be a Helius RPC URL.${RESET}`);
                continue;
            }
            saveRpcToEnv(url);
            iqlabs.setRpcUrl(url);
            console.log(`\n  ${GREEN}RPC saved!${RESET}`);
            break;
        }
    } else {
        iqlabs.setRpcUrl(rpcUrl);
    }

    // 3. Check SOL balance
    const {connection, signer} = getWalletCtx();
    const balance = await connection.getBalance(signer.publicKey);
    if (balance === 0) {
        showLogo();
        console.log(`  ${YELLOW}Your wallet has 0 SOL.${RESET}`);
        console.log(`  ${DIM}You need at least 0.005 SOL to use on-chain features.${RESET}`);
        console.log("");
        console.log(`  ${BOLD}Send SOL to:${RESET}`);
        console.log(`  ${GREEN}${signer.publicKey.toBase58()}${RESET}`);
        console.log("");
        console.log(`  ${DIM}Press Enter after funding to continue...${RESET}`);
        await prompt("  ");

        const newBalance = await connection.getBalance(signer.publicKey);
        if (newBalance === 0) {
            console.log(`\n  ${RED}Still 0 SOL. Some features may not work.${RESET}`);
            await prompt("  Press Enter to continue anyway...");
        } else {
            console.log(`\n  ${GREEN}Balance: ${(newBalance / 1e9).toFixed(4)} SOL${RESET}`);
        }
    }

    // 4. Main menu
    await runMainMenu();
    closeReadline();
};

main().catch((err) => {
    console.error("Error:", err);
    closeReadline();
    process.exit(1);
});
