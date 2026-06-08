# Solana Internet CLI

A terminal-based platform for decentralized apps on Solana. Chat, post on imageboards, and manage your on-chain identity — all from the command line.

## Apps

### SolChat
Decentralized messaging on Solana. Send DMs, manage friend connections, and join chat rooms — every message is a blockchain transaction.

### IQChan
On-chain imageboard (4chan-style). Browse boards, read threads, create posts, and reply — all stored permanently on Solana. Compatible with the [BlockChan](https://blockchan.io) web interface.

### My Menu
Manage your RPC endpoint, view your on-chain profile and inventory, and check your DM inbox.

## Quick Start

```bash
git clone <repo-url>
cd simplechatcli
npm install
npm run dev
```

On first launch, go to **My Menu > RPC Settings** and paste your RPC endpoint URL. It will be saved automatically for future sessions.

## Requirements

- **Node.js** >= 18
- **Solana keypair** — the CLI looks for a keypair in this order:
  1. `./keypair.json` in the project root
  2. `SOLANA_KEYPAIR_PATH` environment variable
  3. `~/.config/solana/id.json` (default Solana CLI keypair)

If you don't have a keypair, the cli will generate a fresh wallet and add its path to the env for you:


## RPC Configuration

The default RPC is `https://api.mainnet-beta.solana.com`. For better performance, use a dedicated RPC provider (Helius, QuickNode, etc.).

**Option A — In-app (recommended):**
Launch the CLI, go to My Menu > RPC Settings, and paste your URL. It gets saved to `.env` automatically.

**Option B — Environment variable:**
```bash
export SOLANA_RPC_ENDPOINT=https://your-rpc-url.com
npm run dev
```

## Usage

```bash
# Development (recommended)
npm run dev

# Or build and run
npm run build
npm start
```

### Main Menu
```
  Wallet:  4xKj...mR9p
  Balance: 0.0123 SOL

  > SolChat
    IQChan
    File Sharing
    My Menu
    Exit
```

Use the arrow keys to navigate, Enter to select, and Esc to go back.

### My Menu
```
  Wallet: 4xKj...mR9p

  > RPC Settings
    Gateway Settings
    Wallet Settings
    My Profile
    My Inventory
    DM Inbox
    Back
```

Use My Menu to update saved .env config values like `SOLANA_RPC_ENDPOINT`, `GATEWAY_URL`, and `SOLANA_KEYPAIR_PATH`.

### IQChan — Board View
Navigate with arrow keys. Each thread shows the OP and last few replies in a tree layout:

```
  ■ Is crypto dead? [anon · 2h ago · 15 replies]
  │ The market just tanked again...
  │
  ├─ anon: I think we're entering a bear market    (1h ago)
  ├─ anon: Nah this is just a correction            (45m ago)
  └─ anon: Cope harder, it's over                   (20m ago)
```

### IQChan — Thread View
Full thread with OP and all replies in tree format. Reply, edit, delete, and paginate:

```
  ■ OP | anon | 04/02/26(Thu)12:30:22 | 4xKj...mR9p
  │ Post content here...

  ├─ #1 | anon | 04/02/26(Thu)12:35:10 | 7bNx...pQ2w
  │  Reply content...

  └─ #2 | anon | 04/02/26(Thu)12:40:05 | 9cMz...kL4v
     Another reply...

[R]eply  [N]ext page  [P]rev page  [E]dit  [D]elete  [B]ack
```

## Project Structure

```
src/
├── app.ts                    # Entry point
├── apps/
│   ├── chat/
│   │   └── chat-service.ts   # SolChat service (DMs, rooms, connections)
│   └── iqchan/
│       ├── constants.ts      # Board metadata, column defs, types
│       └── iqchan-service.ts  # IQChan service (boards, threads, posts)
├── ui/menus/
│   ├── main.ts               # Main menu
│   ├── my-menu.ts             # RPC, profile, inventory, DM inbox
│   ├── chat.ts                # SolChat UI
│   └── iqchan.ts              # IQChan UI (tree rendering)
└── utils/
    ├── wallet_manager.ts      # Keypair loading, connection
    ├── prompt.ts              # Readline, arrow-key selector
    ├── tx.ts                  # Shared transaction sender
    ├── format.ts              # Date formatting, text truncation
    └── logger.ts              # Logging helpers
```

## Tech Stack

- **TypeScript** + **tsx** for development
- **@iqlabs-official/solana-sdk** — on-chain database operations (IQ Protocol)
- **@solana/web3.js** — Solana blockchain interaction
- **@coral-xyz/anchor** — account decoding

## How It Works

All data lives on the Solana blockchain via [IQ Protocol](https://iqlabs.dev). Every message, post, and connection is a Solana transaction — nothing can be censored or taken down.

Both SolChat and IQChan operate on **mainnet**. Posts created in the CLI are visible on the web ([BlockChan](https://blockchan.io)), and vice versa.

## Notes

- **IQ Gateway**: Currently all reads go through RPC. Gateway enable/disable support is planned for faster indexed reads.

## License

MIT
