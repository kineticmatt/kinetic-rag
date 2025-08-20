"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_dns_1 = __importDefault(require("node:dns"));
node_dns_1.default.setDefaultResultOrder("ipv4first");
const redis_js_1 = require("./redis.js");
const processDoc_js_1 = require("./processDoc.js");
console.log("rag-worker started. Listening for q:doc.saved ...");
async function loop() {
    try {
        const raw = await (0, redis_js_1.lpop)("q:doc.saved");
        if (raw) {
            const job = JSON.parse(raw);
            if (job.type === "doc.saved") {
                console.log(`processing doc.saved ${job.canonical_path || job.source_key}`);
                await (0, processDoc_js_1.processDoc)(job);
                console.log(`done doc.saved ${job.uri}`);
            }
            else if (job.type === "doc.deleted") {
                // TODO: implement deletion (remove chunks & blocks) in a later epic
                console.log(`(skip) doc.deleted not implemented yet for ${job.key}`);
            }
        }
        else {
            // no job; sleep a bit
            await new Promise(r => setTimeout(r, 800));
        }
    }
    catch (e) {
        console.error("worker error:", e?.stack || e?.message || e);
        // short backoff to avoid hot loop on errors
        await new Promise(r => setTimeout(r, 1200));
    }
    setImmediate(loop);
}
loop();
