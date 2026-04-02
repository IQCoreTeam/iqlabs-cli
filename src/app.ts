import "dotenv/config";
import iqlabs from "@iqlabs-official/solana-sdk";

import { runMainMenu } from "./ui/menus/main";
import { closeReadline, prompt } from "./utils/prompt";
import { getKeypairInfo, generateKeypair } from "./utils/wallet_manager";
import { logInfo } from "./utils/logger";
import { shortenSig } from "./utils/format";

const rpcUrl = process.env.SOLANA_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";
iqlabs.setRpcUrl(rpcUrl);

const ensureKeypair = async () => {
  const { path, exists } = getKeypairInfo();
  if (exists) return;

  console.log("============================");
  console.log("   Welcome! No wallet found ");
  console.log("============================\n");
  console.log(`  Looked for keypair at: ${path}\n`);
  console.log("  Would you like to generate a new keypair?");
  console.log("  (You can also place an existing keypair.json in the project root)\n");

  const answer = (await prompt("Generate new keypair? (y/n): ")).trim().toLowerCase();
  if (answer !== "y" && answer !== "yes") {
    console.log("\nPlease provide a keypair and restart.");
    process.exit(0);
  }

  const result = generateKeypair();
  console.log("");
  logInfo(`Keypair generated!`);
  logInfo(`Saved to: ${result.path}`);
  logInfo(`Public key: ${result.keypair.publicKey.toBase58()}`);
  console.log("");
  console.log("  IMPORTANT: Fund this wallet with SOL before using on-chain features.");
  console.log(`  Send SOL to: ${result.keypair.publicKey.toBase58()}`);
  console.log("");
  await prompt("Press Enter to continue...");
};

const main = async () => {
  console.clear();
  await ensureKeypair();
  await runMainMenu();
  closeReadline();
};

main().catch((err) => {
  console.error("Error:", err);
  closeReadline();
  process.exit(1);
});
