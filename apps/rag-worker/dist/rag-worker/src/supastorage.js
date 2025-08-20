"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getObject = getObject;
exports.putObject = putObject;
const BASE = process.env.SUPABASE_STORAGE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Read an object (returns Buffer)
async function getObject(objectPath) {
    const r = await fetch(`${BASE}/object/${encodeURIComponent(objectPath)}`, {
        headers: { Authorization: `Bearer ${KEY}` }
    });
    if (!r.ok)
        throw new Error(`getObject failed: ${r.status} ${await r.text()}`);
    const arr = new Uint8Array(await r.arrayBuffer());
    return Buffer.from(arr);
}
// Put an object (Buffer or string)
async function putObject(objectPath, body, contentType) {
    let payload = body;
    if (typeof body !== "string" && Buffer.isBuffer(body)) {
        // Convert Node Buffer → Uint8Array (acceptable BodyInit)
        payload = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    }
    const r = await fetch(`${BASE}/object/${encodeURIComponent(objectPath)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": contentType },
        body: payload
    });
    if (!r.ok)
        throw new Error(`putObject failed: ${r.status} ${await r.text()}`);
}
