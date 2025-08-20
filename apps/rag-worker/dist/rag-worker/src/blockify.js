"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockify = blockify;
const crypto_1 = __importDefault(require("crypto"));
function blockify(md) {
    const lines = md.split(/\n/);
    const blocks = [];
    let h1 = "", h2 = "", h3 = "";
    let para = [];
    let paraIndex = 0;
    const pushPara = () => {
        const text = para.join("\n").trim();
        if (!text)
            return;
        const path = `${h1 ? `H1:${h1}` : ""}${h2 ? `>H2:${h2}` : ""}${h3 ? `>H3:${h3}` : ""}>p${++paraIndex}`;
        const content_hash = crypto_1.default.createHash("sha256").update(text).digest("hex").slice(0, 32);
        blocks.push({ path, text, content_hash });
        para = [];
    };
    for (const raw of lines) {
        const line = raw.trimEnd();
        // headings
        if (/^#\s+/.test(line)) {
            pushPara();
            h1 = line.replace(/^#\s+/, "");
            h2 = h3 = "";
            paraIndex = 0;
            continue;
        }
        if (/^##\s+/.test(line)) {
            pushPara();
            h2 = line.replace(/^##\s+/, "");
            h3 = "";
            continue;
        }
        if (/^###\s+/.test(line)) {
            pushPara();
            h3 = line.replace(/^###\s+/, "");
            continue;
        }
        // paragraph delimiter
        if (line === "") {
            pushPara();
            continue;
        }
        para.push(line);
    }
    pushPara(); // last
    // If no headings exist, still make paragraphs
    if (blocks.length === 0) {
        const paras = md.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
        paras.forEach((t, i) => {
            const content_hash = crypto_1.default.createHash("sha256").update(t).digest("hex").slice(0, 32);
            blocks.push({ path: `p${i + 1}`, text: t, content_hash });
        });
    }
    return blocks;
}
