import iqlabs from "@iqlabs-official/solana-sdk";
import {PublicKey} from "@solana/web3.js";

import {ChatService} from "../../apps/chat/chat-service";
import {logError, logInfo, logTable, RESET, BOLD, DIM, CYAN, GREEN, WHITE, RED, YELLOW, MAGENTA} from "../../utils/logger";
import {prompt, selectFromList} from "../../utils/prompt";

const SOLCHAT_LOGO = `${BOLD}${CYAN}
  ███████╗ ██████╗ ██╗      ██████╗██╗  ██╗ █████╗ ████████╗
  ██╔════╝██╔═══██╗██║     ██╔════╝██║  ██║██╔══██╗╚══██╔══╝
  ███████╗██║   ██║██║     ██║     ███████║███████║   ██║
  ╚════██║██║   ██║██║     ██║     ██╔══██║██╔══██║   ██║
  ███████║╚██████╔╝███████╗╚██████╗██║  ██║██║  ██║   ██║
  ╚══════╝ ╚═════╝ ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝${RESET}
`;

const CHAT_MENU_ITEMS = [
    {label: "Join Room", action: "rooms"},
    {label: "Create Room", action: "create"},
    {label: "DM", action: "dm"},
    {label: "Back", action: null},
];

const DM_MENU_ITEMS = [
    {label: "Friend List", action: "friends"},
    {label: "Request Connection", action: "request"},
    {label: "(^_~) Spy on DM", action: "spy"},
    {label: "Back", action: null},
];

const runDmChat = async (service: ChatService, friend: any) => {
    console.clear();
    const history = await service.fetchDmHistory(friend.seed, {limit: 20});
    if (history.length > 0) {
        logTable(history);
    } else {
        logInfo("No messages yet");
    }

    const stop = await service.joinDm(friend.seed, {limit: 20});
    logInfo("Type message, /block, or /exit");
    try {
        while (true) {
            const input = (await prompt("> ")).trim();
            if (!input) {
                continue;
            }
            if (input === "/exit") {
                break;
            }
            if (input === "/block") {
                await service.manageConnection(
                    friend.seed,
                    iqlabs.contract.CONNECTION_STATUS_BLOCKED,
                );
                logInfo("Blocked");
                continue;
            }
            await service.sendDm(friend.seed, input);
        }
    } finally {
        stop();
    }
};

const runRoomChat = async (service: ChatService, room: any) => {
    console.clear();
    console.log(`[room] ${room.name}`);
    const history = await iqlabs.reader.readTableRows(room.table, {limit: 20});
    if (history.length > 0) {
        logTable(history);
    } else {
        logInfo("No messages yet");
    }

    const stop = await service.joinRoom(room.seed, {limit: 20});
    logInfo("Type message or /exit");
    try {
        while (true) {
            const input = (await prompt("> ")).trim();
            if (!input) {
                continue;
            }
            if (input === "/exit") {
                break;
            }
            await service.sendChat(room.seed, input);
        }
    } finally {
        stop();
    }
};

const handleFriendSelect = async (service: ChatService, friend: any) => {
    if (friend.status === "pending") {
        //TODO: this looks like when it approved, we join the chat, but we need to make manage friend list separate and allow user can block when it approved.
        // this means, we need to make the list that displays only approved friend list and blocked, pending and make the suitable choice in there.
        const choice = (await prompt("1) Approve  2) Block  3) Back: ")).trim();
        if (choice === "1") {
            await service.manageConnection(
                friend.seed,
                iqlabs.contract.CONNECTION_STATUS_APPROVED,
            );
            logInfo("Approved");
        } else if (choice === "2") {
            await service.manageConnection(
                friend.seed,
                iqlabs.contract.CONNECTION_STATUS_BLOCKED,
            );
            logInfo("Blocked");
        }
        return;
    }
    if (friend.status === "blocked") {
        const choice = (await prompt("1) Unblock  2) Back: ")).trim();
        if (choice === "1") {
            await service.manageConnection(
                friend.seed,
                iqlabs.contract.CONNECTION_STATUS_APPROVED,
            );
            logInfo("Unblocked");
        }
        return;
    }
    await runDmChat(service, friend);
};

export const openFriendList = async (service: ChatService) => {
    const friends = await service.listFriends();
    if (friends.length === 0) {
        logInfo("No friends found");
        await prompt("Press Enter to continue...");
        return;
    }

    const index = await selectFromList("Friend List", friends, (friend, selected) => {
        const status = friend.status ?? "unknown";
        const marker = selected ? "*" : " ";
        return `${marker} ${friend.address} [${status}]`;
    });

    if (index === null) {
        return;
    }
    const friend = friends[index];
    await handleFriendSelect(service, friend);
    await prompt("Press Enter to continue...");
};

const requestConnection = async (service: ChatService) => {
    const input = (await prompt("Partner address: ")).trim();
    if (!input) {
        logError("Partner address is required");
        return;
    }
    let partner: PublicKey;
    try {
        partner = new PublicKey(input);
    } catch (err) {
        logError("Invalid partner address", err);
        await prompt("Press Enter to continue...");
        return;
    }
    if (partner.equals(service.signer.publicKey)) {
        logError("Cannot request connection with yourself");
        await prompt("Press Enter to continue...");
        return;
    }

    const result = await service.requestConnection(partner);
    const seedHex = Buffer.from(result.connectionSeed).toString("hex");
    if (result.created) {
        logInfo("Connection requested", {
            table: result.connectionTable.toBase58(),
            seed: seedHex,
            signature: result.signature ?? null,
        });
    } else {
        logInfo("Connection already exists", {
            table: result.connectionTable.toBase58(),
            seed: seedHex,
        });
    }
    await prompt("Press Enter to continue...");
};

const openRoomList = async (service: ChatService) => {
    const rooms = await service.listRooms();
    if (rooms.length === 0) {
        logInfo("No rooms found");
        await prompt("Press Enter to continue...");
        return;
    }

    const index = await selectFromList("Room List", rooms, (room, selected) => {
        const marker = selected ? "*" : " ";
        return `${marker} ${room.name}`;
    });
    if (index === null) {
        return;
    }
    await runRoomChat(service, rooms[index]);
    await prompt("Press Enter to continue...");
};

const createRoom = async (service: ChatService) => {
    const name = (await prompt("Room name: ")).trim();
    if (!name) {
        logError("Room name is required");
        return;
    }
    const result = await service.createRoom(name);
    if (result.created) {
        logInfo("Room created", {
            signature: result.signature ?? null,
        });
    } else {
        logInfo("Room already exists");
    }
    await prompt("Press Enter to continue...");
};

const resolveNickname = async (walletAddress: string): Promise<string | null> => {
    try {
        const state = await iqlabs.reader.readUserState(walletAddress);
        const meta = (state as any).metadata ?? (state as any).meta ?? null;
        if (!meta || typeof meta !== "string") return null;

        // If metadata looks like a Solana tx signature, fetch the actual profile data
        if (meta.length <= 100 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(meta)) {
            const result = await iqlabs.reader.readCodeIn(meta);
            if (result.data) {
                const parsed = JSON.parse(result.data);
                return parsed.name || null;
            }
        }
        // Otherwise try direct JSON
        try {
            const parsed = JSON.parse(meta);
            return parsed.name || null;
        } catch {
            return null;
        }
    } catch {
        return null;
    }
};

const shortenAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;

const SPY_BANNER = `${BOLD}${RED}
  +====================================================================+
  |  (o_O) DM SPY MODE                                                 |
  |                                                                     |
  |  You are reading someone else's private conversation.               |
  |  Right now. In real time. Every single word.                        |
  |                                                                     |
  |  No server stopped you. No password blocked you.                    |
  |  Nothing stood between you and their messages.                      |
  |                                                                     |
  |  ${WHITE}With IQ Encryption: ONLY the wallet owner can decrypt.${RED}           |
  |  ${WHITE}No server. No middleman. No backdoor. Just math.${RED}                 |
  +====================================================================+${RESET}`;

const spyOnDm = async (service: ChatService) => {
    console.clear();
    console.log(SPY_BANNER);
    console.log();
    console.log(`${YELLOW}Pick any two wallets. Their entire conversation is yours to read.${RESET}`);
    console.log(`${DIM}This is what "no encryption" really means.${RESET}`);
    console.log();

    const addrA = (await prompt(`${CYAN}Participant A wallet address: ${RESET}`)).trim();
    if (!addrA) {
        logError("Address A is required");
        return;
    }
    let pubA: PublicKey;
    try {
        pubA = new PublicKey(addrA);
    } catch {
        logError("Invalid address for Participant A");
        return;
    }

    const addrB = (await prompt(`${CYAN}Participant B wallet address: ${RESET}`)).trim();
    if (!addrB) {
        logError("Address B is required");
        return;
    }
    let pubB: PublicKey;
    try {
        pubB = new PublicKey(addrB);
    } catch {
        logError("Invalid address for Participant B");
        return;
    }

    if (pubA.equals(pubB)) {
        logError("Both addresses are the same");
        return;
    }

    const dmSeed = service.deriveDmSeed(addrA, addrB);
    const connectionTable = service.deriveConnectionTable(dmSeed);

    console.clear();
    console.log(SPY_BANNER);
    console.log();
    console.log(`${DIM}Resolving identities...${RESET}`);

    // Resolve nicknames for both participants
    const [nickA, nickB] = await Promise.all([
        resolveNickname(addrA),
        resolveNickname(addrB),
    ]);
    const labelA = nickA ?? shortenAddr(addrA);
    const labelB = nickB ?? shortenAddr(addrB);

    console.clear();
    console.log(SPY_BANNER);
    console.log();
    console.log(`${RED}${BOLD}TARGET ACQUIRED${RESET}`);
    console.log(`  ${CYAN}Victim A: ${BOLD}${nickA ? nickA : shortenAddr(addrA)}${RESET}${CYAN}${nickA ? ` (${shortenAddr(addrA)})` : ""}${RESET}`);
    console.log(`  ${MAGENTA}Victim B: ${BOLD}${nickB ? nickB : shortenAddr(addrB)}${RESET}${MAGENTA}${nickB ? ` (${shortenAddr(addrB)})` : ""}${RESET}`);
    console.log(`  ${DIM}On-chain table: ${connectionTable.toBase58()}${RESET}`);
    console.log();

    // Build a sender → label map for message display
    const senderLabelMap = new Map<string, { label: string; color: string; tag: string }>();
    senderLabelMap.set(addrA, {label: labelA, color: CYAN, tag: "A"});
    senderLabelMap.set(addrB, {label: labelB, color: MAGENTA, tag: "B"});

    const resolveSender = (sender: string) => {
        const exact = senderLabelMap.get(sender);
        if (exact) return exact;
        // Partial match (sender might be a nickname or shortened)
        for (const [addr, info] of senderLabelMap) {
            if (sender.startsWith(addr.slice(0, 6)) || sender === info.label) return info;
        }
        return {label: shortenAddr(sender), color: DIM, tag: "?"};
    };

    // Load existing history
    try {
        const history = await service.fetchDmHistory(dmSeed, {limit: 30});
        if (history.length > 0) {
            console.log(`${YELLOW}--- INTERCEPTED: ${history.length} messages exposed ---${RESET}`);
            for (const msg of history) {
                const data = typeof msg === "string" ? JSON.parse(msg) : msg;
                const sender = data.sender ?? "unknown";
                const resolved = resolveSender(sender);
                const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "";
                const content = data.text ?? data.data ?? JSON.stringify(data);
                console.log(`  ${resolved.color}${BOLD}${resolved.label}${RESET} ${DIM}${time}${RESET}  ${content}`);
            }
            console.log();
        } else {
            logInfo("No message history found between these wallets");
            console.log();
        }
    } catch {
        logInfo("No DM table found between these wallets. They may not have chatted yet");
        console.log();
    }

    // Subscribe for real-time updates
    console.log(`${RED}${BOLD}(*_*) LIVE INTERCEPT ACTIVE${RESET}`);
    console.log(`${RED}Every message appears here the moment it's sent.${RESET}`);
    console.log(`${RED}They have no idea you're watching.${RESET}`);
    console.log();
    console.log(`${GREEN}${BOLD}With IQ Encryption, this screen would be nothing but noise.${RESET}`);
    console.log(`${GREEN}Only the wallet owner holds the key. Not the server. Not you. Nobody.${RESET}`);
    console.log(`${DIM}/exit to stop${RESET}`);
    console.log();

    let stop: (() => void) | null = null;
    try {
        stop = await service.joinDm(dmSeed, {limit: 30});
    } catch {
        logInfo("Could not subscribe. Table may not exist. Waiting for messages...");
    }

    try {
        while (true) {
            const input = (await prompt("")).trim();
            if (input === "/exit") break;
        }
    } finally {
        if (stop) stop();
    }
};

const DM_LOGO = `${BOLD}${CYAN}
  ██████╗ ███╗   ███╗
  ██╔══██╗████╗ ████║
  ██║  ██║██╔████╔██║
  ██║  ██║██║╚██╔╝██║
  ██████╔╝██║ ╚═╝ ██║
  ╚═════╝ ╚═╝     ╚═╝${RESET}
`;

const runDmMenu = async (service: ChatService) => {
    while (true) {
        const index = await selectFromList(
            DM_LOGO,
            DM_MENU_ITEMS,
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

        if (index === null || DM_MENU_ITEMS[index].action === null) break;

        try {
            switch (DM_MENU_ITEMS[index].action) {
                case "friends":
                    await openFriendList(service);
                    break;
                case "request":
                    await requestConnection(service);
                    break;
                case "spy":
                    await spyOnDm(service);
                    break;
            }
        } catch (err) {
            logError("DM action failed", err);
            await prompt("Press Enter to continue...");
        }
    }
};

export const runChatCommand = async () => {
    const service = new ChatService();
    try {
        await service.setupCliDemo();
    } catch (err) {
        logError("Chat setup failed", err);
        await prompt("Press Enter to return...");
        return;
    }

    while (true) {
        const index = await selectFromList(
            SOLCHAT_LOGO,
            CHAT_MENU_ITEMS,
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

        if (index === null || CHAT_MENU_ITEMS[index].action === null) break;

        try {
            switch (CHAT_MENU_ITEMS[index].action) {
                case "rooms":
                    await openRoomList(service);
                    break;
                case "create":
                    await createRoom(service);
                    break;
                case "dm":
                    await runDmMenu(service);
                    break;
            }
        } catch (err) {
            logError("Chat action failed", err);
            await prompt("Press Enter to continue...");
        }
    }
};
