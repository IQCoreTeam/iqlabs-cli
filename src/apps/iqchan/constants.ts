export const DB_ROOT_ID = "iqchan";
export const THREADS_PER_PAGE = 20;
export const BUMP_LIMIT = 300;
export const FEED_SEED_PREFIX = "feedmY}AGBJiqLabs";
export const BOARD_COLUMNS = ["sub", "com", "name", "time", "img", "threadPda", "threadSeed"];
export const BOARD_ID_COL = "time";
export const REPLY_PREVIEW_COUNT = 3;

export const BOARD_METADATA: Record<string, { title: string; description: string }> = {
    iq:  { title: "IQ Labs Community", description: "IQ token holders only" },
    po:  { title: "Politically Incorrect", description: "Political discussion" },
    biz: { title: "Business & Finance", description: "Business and finance" },
    a:   { title: "Anime & Manga", description: "Anime and manga" },
    g:   { title: "Technology", description: "Technology" },
    nub: { title: "Nub Cat Community", description: "Nub Cat Community" },
    mlg: { title: "Community For MLG", description: "Community For MLG" },
    y2k: { title: "Community For Y2kDotCom", description: "Community For Y2kDotCom" },
    retardio: { title: "Only for Retardio", description: "Only for Retardio" },
    dominance: { title: "Market Dominance", description: "Market Dominance" },
};

export const OFFICIAL_BOARDS = ["iq", "po", "biz", "a", "g"];

export function threadTableSeed(boardId: string, randomId: string): string {
    return `${boardId}/thread/${randomId}`;
}

export interface Post {
    sub?: string;
    com: string;
    name: string;
    time: number;
    img?: string;
    threadPda?: string;
    threadSeed?: string;
    __txSignature?: string;
}

export interface ThreadEntry {
    threadPda: string;
    threadSeed?: string;
    opData: Post | null;
    lastActivityTime: number;
    replyCount: number;
    lastReplies: Post[];
}
