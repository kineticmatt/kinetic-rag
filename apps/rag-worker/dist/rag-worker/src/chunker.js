"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkText = chunkText;
/**
 * Simple word-based chunker.
 * Approximates ~800 "tokens" per chunk via words; 160 "token" overlap.
 * This unblocks build & is fine for MVP; we can swap to tiktoken later.
 */
function chunkText(text, targetTokens = 800, overlapTokens = 160) {
    const words = text.split(/\s+/).filter(Boolean);
    const wordsPerChunk = Math.max(50, Math.floor(targetTokens / 1.3));
    const overlapWords = Math.max(10, Math.floor(overlapTokens / 1.3));
    const chunks = [];
    for (let start = 0; start < words.length; start += (wordsPerChunk - overlapWords)) {
        const slice = words.slice(start, start + wordsPerChunk).join(" ");
        if (slice.trim())
            chunks.push(slice);
        if (start + wordsPerChunk >= words.length)
            break;
    }
    return chunks;
}
