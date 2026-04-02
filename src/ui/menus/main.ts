import {getWalletCtx, getKeypairInfo} from "../../utils/wallet_manager";
import {logError} from "../../utils/logger";
import {prompt} from "../../utils/prompt";
import {shortenSig} from "../../utils/format";
import {runChatCommand} from "./chat";
import {runMyMenu} from "./my-menu";
import {runIqchanMenu} from "./iqchan";

const showMainMenu = () => {
    const {signer} = getWalletCtx();
    const pubkey = signer.publicKey.toBase58();
    const {path: kpPath} = getKeypairInfo();

    console.log("\n============================");
    console.log("   Solana Internet CLI      ");
    console.log("============================\n");
    console.log(`  Wallet: ${shortenSig(pubkey, 6)}`);
    console.log(`  Key:    ${kpPath}`);
    console.log("");
    console.log("  1) My Menu");
    console.log("  2) SolChat");
    console.log("  3) IQChan");
    console.log("");
    console.log("  0) Exit");
    console.log("\n============================\n");
};

export const runMainMenu = async () => {
    let running = true;
    while (running) {
        console.clear();
        showMainMenu();
        const choice = (await prompt("Select: ")).trim();
        try {
            switch (choice) {
                case "1":
                    await runMyMenu();
                    break;
                case "2":
                    await runChatCommand();
                    break;
                case "3":
                    await runIqchanMenu();
                    break;
                case "0":
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
