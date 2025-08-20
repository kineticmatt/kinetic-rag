"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDoc = processDoc;
const db_js_1 = require("../../rag-api/src/db.js");
const supastorage_js_1 = require("./supastorage.js");
const normalize_js_1 = require("./normalize.js");
const blockify_js_1 = require("./blockify.js");
const chunker_js_1 = require("./chunker.js");
async function processDoc(job) {
    const { tenant_id, tenant_slug, document_id, uri, canonical_path, source_bucket, source_key, source_ext, // 'docx' | 'pdf'
    format // 'md' | 'docx' | 'pdf'
     } = job;
    // 1) Ensure Markdown canonical content
    let md;
    if (format === "md") {
        const buf = await (0, supastorage_js_1.getObject)(canonical_path);
        md = buf.toString("utf8");
    }
    else {
        const srcPath = `${source_bucket}/${source_key}`; // e.g., uploads/kinetic/...
        const buf = await (0, supastorage_js_1.getObject)(srcPath);
        md = await (0, normalize_js_1.toMarkdownFromBuffer)(buf, source_ext);
        // write canonical MD so future edits can happen in the editor
        await (0, supastorage_js_1.putObject)(canonical_path, md, "text/markdown");
    }
    // 2) Blockify
    const blocks = (0, blockify_js_1.blockify)(md);
    // 3) Load previous block hashes for diff
    const prev = await (0, db_js_1.query)(`select id, path, content_hash
       from blocks
      where tenant_id = $1 and document_id = $2`, [tenant_id, document_id]);
    const prevByPath = new Map(prev.rows.map((r) => [r.path, r]));
    // 4) Upsert blocks and collect changed ones
    const changed = [];
    await (0, db_js_1.query)("begin");
    try {
        for (const b of blocks) {
            const existed = prevByPath.get(b.path);
            if (!existed) {
                const ins = await (0, db_js_1.query)(`insert into blocks (tenant_id, document_id, path, content_hash, updated_at)
           values ($1,$2,$3,$4, now())
           returning id`, [tenant_id, document_id, b.path, b.content_hash]);
                changed.push({ block_id: ins.rows[0].id, text: b.text, path: b.path });
            }
            else if (existed.content_hash !== b.content_hash) {
                await (0, db_js_1.query)(`update blocks
              set content_hash = $1,
                  updated_at = now()
            where id = $2`, [b.content_hash, existed.id]);
                changed.push({ block_id: existed.id, text: b.text, path: b.path });
            }
        }
        // 5) For changed blocks, regenerate chunks
        for (const c of changed) {
            await (0, db_js_1.query)(`delete from chunks where block_id = $1`, [c.block_id]);
            const pieces = (0, chunker_js_1.chunkText)(c.text, 800, 160);
            for (let i = 0; i < pieces.length; i++) {
                const text = pieces[i];
                const ins = await (0, db_js_1.query)(`insert into chunks
             (tenant_id, document_id, block_id, ordinal, text, tokens, chunk_version, metadata)
           values ($1,$2,$3,$4,$5,null,'cv1',jsonb_build_object('path',$6))
           returning id`, [tenant_id, document_id, c.block_id, i + 1, text, c.path]);
                await (0, db_js_1.query)(`update chunks
              set tsv = to_tsvector('english', text)
            where id = $1`, [ins.rows[0].id]);
            }
        }
        // 6) Mark document status for embedding/indexing next
        await (0, db_js_1.query)(`update documents set status='needs_index', updated_at=now() where id=$1`, [
            document_id,
        ]);
        await (0, db_js_1.query)("commit");
    }
    catch (e) {
        await (0, db_js_1.query)("rollback");
        throw e;
    }
}
