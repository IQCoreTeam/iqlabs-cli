import {IqchanService} from "../../apps/iqchan/iqchan-service";
import type {Post, ThreadEntry} from "../../apps/iqchan/constants";
import {logError, logInfo} from "../../utils/logger";
import {prompt, selectFromList} from "../../utils/prompt";
import {formatDate, timeAgo, truncate, shortenSig} from "../../utils/format";

const PAGE_SIZE = 20;

// ─── Renderers ───────────────────────────────────────────────────────────────

function renderThreadPreview(entry: ThreadEntry, selected: boolean): string {
    const op = entry.opData;
    if (!op) return "(no data)";

    const marker = selected ? "*" : " ";
    const sub = op.sub ? op.sub : "(no subject)";
    const preview = truncate(op.com ?? "", 60);
    const meta = `${op.name} · ${timeAgo(op.time)} · ${entry.replyCount} replies`;
    const header = `${marker} ■ ${sub} [${meta}]`;

    const lines = [header];
    if (preview) {
        lines.push(`  │ ${preview}`);
    }

    if (entry.lastReplies.length > 0) {
        lines.push("  │");
        entry.lastReplies.forEach((reply, i) => {
            const isLast = i === entry.lastReplies.length - 1;
            const branch = isLast ? "└─" : "├─";
            const text = truncate(reply.com ?? "", 50);
            lines.push(`  ${branch} ${reply.name}: ${text}  (${timeAgo(reply.time)})`);
        });
    }

    lines.push(""); // blank line between threads
    return lines.join("\n");
}

function renderPost(
    post: Post,
    index: number,
    total: number,
    isOp: boolean,
): string[] {
    const sig = post.__txSignature ? shortenSig(post.__txSignature) : "???";
    const label = isOp ? "OP" : `#${index}`;
    const header = `${label} | ${post.name} | ${formatDate(post.time)} | ${sig}`;

    const isLast = !isOp && index === total;
    const branch = isOp ? "■" : isLast ? "└─" : "├─";
    const indent = isOp ? "│ " : isLast ? "   " : "│  ";

    const lines: string[] = [];
    lines.push(`  ${branch} ${header}`);

    if (isOp && post.sub) {
        lines.push(`  ${indent}${post.sub}`);
    }

    const commentLines = (post.com ?? "").split("\n");
    for (const line of commentLines) {
        lines.push(`  ${indent}${line}`);
    }

    if (post.img) {
        lines.push(`  ${indent}[img: ${post.img}]`);
    }

    lines.push(""); // spacing
    return lines;
}

// ─── Flows ───────────────────────────────────────────────────────────────────

async function createThreadFlow(service: IqchanService, boardId: string) {
    console.log(`\n── New Thread on /${boardId}/ ──`);
    const name = (await prompt("Name (default: Anonymous): ")).trim() || "Anonymous";
    const sub = (await prompt("Subject: ")).trim();
    const com = (await prompt("Comment: ")).trim();
    if (!com) {
        logError("Comment is required");
        return;
    }
    const img = (await prompt("Image URL (optional): ")).trim() || undefined;

    logInfo("Posting... (1/2 creating thread table)");
    try {
        const result = await service.createThread(boardId, {sub, com, name, img});
        logInfo("Posting... (2/2 writing post)");
        logInfo(`Thread created! sig: ${shortenSig(result.txSignature)}`);
    } catch (err) {
        logError("Failed to create thread", err);
    }
    await prompt("Press Enter to continue...");
}

async function replyFlow(
    service: IqchanService,
    threadSeed: string,
    threadPda: string,
    boardId: string,
    replyCount: number,
    opSubject?: string,
) {
    const title = opSubject ? `"${truncate(opSubject, 40)}"` : "thread";
    console.log(`\n── Reply to ${title} ──`);
    const name = (await prompt("Name (default: Anonymous): ")).trim() || "Anonymous";
    const com = (await prompt("Comment: ")).trim();
    if (!com) {
        logError("Comment is required");
        return;
    }
    const img = (await prompt("Image URL (optional): ")).trim() || undefined;

    logInfo("Posting reply...");
    try {
        const sig = await service.postReply(threadSeed, threadPda, boardId, {com, name, img}, replyCount);
        logInfo(`Reply posted! sig: ${shortenSig(sig)}`);
    } catch (err) {
        logError("Failed to post reply", err);
    }
    await prompt("Press Enter to continue...");
}

// ─── Thread View ─────────────────────────────────────────────────────────────

async function showThread(
    service: IqchanService,
    entry: ThreadEntry,
    boardId: string,
) {
    let page = 0;

    const loadAndShow = async () => {
        console.clear();
        const threadSeed = entry.threadSeed ?? "";
        const {op, replies} = await service.readThread(entry.threadPda, threadSeed, boardId);

        const subject = op?.sub ?? "(no subject)";
        console.log(`/${boardId}/ - "${subject}"`);
        console.log("─".repeat(75));
        console.log("");

        if (op) {
            const opLines = renderPost(op, 0, replies.length, true);
            for (const line of opLines) console.log(line);
        }

        const totalPages = Math.max(1, Math.ceil(replies.length / PAGE_SIZE));
        page = Math.min(page, totalPages - 1);
        const start = page * PAGE_SIZE;
        const pageReplies = replies.slice(start, start + PAGE_SIZE);

        pageReplies.forEach((reply, i) => {
            const globalIdx = start + i + 1;
            const lines = renderPost(reply, globalIdx, replies.length, false);
            for (const line of lines) console.log(line);
        });

        console.log(`Page ${page + 1}/${totalPages} (${replies.length} replies)`);
        console.log("─".repeat(75));
        console.log("[R]eply  [N]ext page  [P]rev page  [E]dit  [D]elete  [B]ack");

        return {op, replies, threadSeed, totalPages};
    };

    let ctx = await loadAndShow();

    while (true) {
        const input = (await prompt("> ")).trim().toLowerCase();

        if (input === "b" || input === "back") break;

        if (input === "r" || input === "reply") {
            await replyFlow(
                service,
                ctx.threadSeed,
                entry.threadPda,
                boardId,
                ctx.replies.length,
                ctx.op?.sub,
            );
            ctx = await loadAndShow();
            continue;
        }

        if (input === "n" || input === "next") {
            if (page < ctx.totalPages - 1) page++;
            ctx = await loadAndShow();
            continue;
        }

        if (input === "p" || input === "prev") {
            if (page > 0) page--;
            ctx = await loadAndShow();
            continue;
        }

        if (input === "e" || input === "edit") {
            const sig = (await prompt("Tx signature to edit: ")).trim();
            if (!sig) continue;
            const newCom = (await prompt("New comment: ")).trim();
            if (!newCom) continue;
            try {
                await service.editPost(ctx.threadSeed, sig, newCom);
                logInfo("Post edited");
            } catch (err) {
                logError("Edit failed", err);
            }
            await prompt("Press Enter to continue...");
            ctx = await loadAndShow();
            continue;
        }

        if (input === "d" || input === "delete") {
            const sig = (await prompt("Tx signature to delete: ")).trim();
            if (!sig) continue;
            const confirm = (await prompt("Are you sure? (y/n): ")).trim().toLowerCase();
            if (confirm !== "y") continue;
            try {
                await service.deletePost(ctx.threadSeed, sig);
                logInfo("Post deleted");
            } catch (err) {
                logError("Delete failed", err);
            }
            await prompt("Press Enter to continue...");
            ctx = await loadAndShow();
            continue;
        }
    }
}

// ─── Board Threads ───────────────────────────────────────────────────────────

async function showBoardThreads(
    service: IqchanService,
    board: { id: string; title: string },
) {
    while (true) {
        console.clear();
        console.log(`/${board.id}/ - ${board.title}`);
        console.log(`${"─".repeat(75)}`);
        logInfo("Loading threads...");

        let threads: ThreadEntry[];
        try {
            threads = await service.fetchFeedThreads(board.id);
        } catch (err) {
            logError("Failed to load threads", err);
            await prompt("Press Enter to go back...");
            return;
        }

        if (threads.length === 0) {
            logInfo("No threads yet");
            console.log("\n[N] New Thread  Esc/Enter = back");
            const input = (await prompt("> ")).trim().toLowerCase();
            if (input === "n") {
                await createThreadFlow(service, board.id);
                continue;
            }
            return;
        }

        const index = await selectFromList(
            `/${board.id}/ - ${board.title}  |  [N]ew Thread`,
            threads,
            (entry: ThreadEntry, selected: boolean) => renderThreadPreview(entry, selected),
        );

        if (index === null) return;

        await showThread(service, threads[index], board.id);
    }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

export const runIqchanMenu = async () => {
    const service = new IqchanService();

    try {
        await service.ensureSetup();
    } catch (err) {
        logError("IQChan setup failed", err);
        await prompt("Press Enter to return...");
        return;
    }

    while (true) {
        let boards: Array<{ id: string; title: string; description: string }>;
        try {
            boards = await service.listBoards();
        } catch (err) {
            logError("Failed to load boards", err);
            await prompt("Press Enter to return...");
            return;
        }

        const index = await selectFromList(
            "============================\n        IQChan\n============================",
            boards,
            (board, selected) => {
                const marker = selected ? "*" : " ";
                return `${marker} /${board.id}/ - ${board.title}`;
            },
        );

        if (index === null) return;

        await showBoardThreads(service, boards[index]);
    }
};
