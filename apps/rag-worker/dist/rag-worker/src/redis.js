"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisCmd = redisCmd;
exports.lpop = lpop;
exports.rpush = rpush;
async function redisCmd(cmd) {
    const res = await fetch(`${process.env.REDIS_URL}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.REDIS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(cmd),
    });
    if (!res.ok)
        throw new Error(`Redis error: ${res.status} ${await res.text()}`);
    return res.json();
}
async function lpop(key) {
    const out = await redisCmd(["LPOP", key]);
    const v = out?.result ?? null;
    return v === 0 || v === null ? null : String(v);
}
async function rpush(key, val) {
    await redisCmd(["RPUSH", key, val]);
}
