import {randomUUID} from "node:crypto";

// Short, unique-enough ids for in-row use (chat messages, file rows, ...).
// Single source of truth — do not redefine this in services.
export const makeMessageId = (sliceLength?: number): string => {
    const uuid = typeof randomUUID === "function" ? randomUUID() : "";
    const id = uuid || Math.random().toString(36).slice(2, 10);
    return typeof sliceLength === "number" ? id.slice(0, sliceLength) : id;
};
