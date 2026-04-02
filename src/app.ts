import "dotenv/config";
import iqlabs from "@iqlabs-official/solana-sdk";

import { runMainMenu } from "./ui/menus/main";
import { closeReadline } from "./utils/prompt";

const rpcUrl = process.env.SOLANA_RPC_ENDPOINT || "https://api.devnet.solana.com";
iqlabs.setRpcUrl(rpcUrl);

const main = async () => {
  console.clear();
  await runMainMenu();
  closeReadline();
};

main().catch((err) => {
  console.error("Error:", err);
  closeReadline();
  process.exit(1);
});
