import { lpop } from "./redis.js";
import { processDoc } from "./processDoc.js";

console.log("rag-worker started. Listening for q:doc.saved ...");

async function loop() {
  try {
    const raw = await lpop("q:doc.saved");
    if (raw) {
      const job = JSON.parse(raw);
      if (job.type === "doc.saved") {
        console.log(`processing doc.saved ${job.canonical_path || job.source_key}`);
        await processDoc(job);
        console.log(`done doc.saved ${job.uri}`);
      } else if (job.type === "doc.deleted") {
        // TODO: implement deletion (remove chunks & blocks) in a later epic
        console.log(`(skip) doc.deleted not implemented yet for ${job.key}`);
      }
    } else {
      // no job; sleep a bit
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (e:any) {
    console.error("worker error:", e?.stack || e?.message || e);
    // short backoff to avoid hot loop on errors
    await new Promise(r => setTimeout(r, 1200));
  }
  setImmediate(loop);
}
loop();
