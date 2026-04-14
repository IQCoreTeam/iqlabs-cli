import iqlabs from "@iqlabs-official/solana-sdk";
import {getGatewayUrl} from "./config";

export async function gwFetchRows(
    tablePda: string,
    limit = 50,
    before?: string,
): Promise<Record<string, unknown>[]> {
    const gw = getGatewayUrl();
    if (!gw) return iqlabs.reader.readTableRows(tablePda, {limit, before});

    try {
        let path = `/table/${tablePda}/rows?limit=${limit}`;
        if (before) path += `&before=${before}`;
        const res = await fetch(`${gw}${path}`, {signal: AbortSignal.timeout(8000)});
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        return data.rows ?? [];
    } catch {
        return iqlabs.reader.readTableRows(tablePda, {limit, before});
    }
}

export async function gwNotify(
    tablePda: string,
    txSignature: string,
    row?: Record<string, unknown>,
    signer?: string,
): Promise<void> {
    const gw = getGatewayUrl();
    if (!gw) return;
    try {
        await fetch(`${gw}/table/${tablePda}/notify`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({txSignature, row, signer}),
            signal: AbortSignal.timeout(3000),
        });
    } catch {
        // non-critical — gateway will pick up on next poll
    }
}
