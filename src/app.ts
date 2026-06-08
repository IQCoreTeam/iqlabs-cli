import "dotenv/config";
import iqlabs from "@iqlabs-official/solana-sdk";

import {runMainMenu} from "./ui/menus/main";
import {closeReadline, prompt} from "./utils/prompt";
import {
    getKeypairInfo, 
    generateKeypair, 
    getWalletCtx,
    validateKeypairPath,
} from "./utils/wallet_manager";
import {saveEnvVar} from "./utils/config";
import {RESET, BOLD, DIM, CYAN, GREEN, YELLOW, RED} from "./utils/logger";

const LOGO = `
${CYAN}${BOLD}  ██╗ ██████╗ ██╗      █████╗ ██████╗ ███████╗
  ██║██╔═══██╗██║     ██╔══██╗██╔══██╗██╔════╝
  ██║██║   ██║██║     ███████║██████╔╝███████╗
  ██║██║▄▄ ██║██║     ██╔══██║██╔══██╗╚════██║
  ██║╚██████╔╝███████╗██║  ██║██████╔╝███████║
  ╚═╝ ╚══▀▀═╝ ╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝${RESET}
${DIM}  Solana Internet CLI${RESET}
`;

const showLogo = () => {
    console.clear();
    console.log(LOGO);
};

const ensureWallet = async () => {
    const info = getKeypairInfo();

    if (info.exists) {
        try {
            validateKeypairPath(info.path);
            return;
        } catch {
            // Existing wallet path is present, but the file is not a valid keypair.
        }
    }

    showLogo();
    console.log(`  ${YELLOW}Wallet not configured.${RESET}`);
    console.log(`  ${DIM}Paste a Solana keypair JSON path below.${RESET}`);
    console.log(`  ${DIM}Leave empty to generate a new wallet.${RESET}`);
    console.log("");

    while (true) {
        const walletPath = (await prompt("  > ")).trim();

        if (!walletPath) {
            const result = generateKeypair();

            saveEnvVar("SOLANA_KEYPAIR_PATH", result.path);
            process.env.SOLANA_KEYPAIR_PATH = result.path;

            console.log(`\n  ${GREEN}Wallet created!${RESET}`);
            console.log(`  ${DIM}Saved to: ${result.path}${RESET}`);
            console.log(`  ${DIM}Public key: ${GREEN}${result.keypair.publicKey.toBase58()}${RESET}`);
            console.log("");
            return;
        }

        try {
            const signer = validateKeypairPath(walletPath);

            saveEnvVar("SOLANA_KEYPAIR_PATH", walletPath);
            process.env.SOLANA_KEYPAIR_PATH = walletPath;

            console.log(`\n  ${GREEN}Wallet saved!${RESET}`);
            console.log(`  ${DIM}Path: ${walletPath}${RESET}`);
            console.log(`  ${DIM}Public key: ${GREEN}${signer.publicKey.toBase58()}${RESET}`);
            console.log("");
            return;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(`\n  ${RED}Invalid wallet path: ${msg}${RESET}`);
            console.log(`  ${DIM}Try again, or leave empty to generate a new wallet.${RESET}`);
        }
    }
};

const main = async () => {

    // 1. Check RPC
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
            saveEnvVar("SOLANA_RPC_ENDPOINT", url);
            iqlabs.setRpcUrl(url);
            console.log(`\n  ${GREEN}RPC saved!${RESET}`);
            break;
        }
    } else {
        iqlabs.setRpcUrl(rpcUrl);
    }

    // 2. Ensure wallet
    await ensureWallet();

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
