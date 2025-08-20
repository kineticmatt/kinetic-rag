"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMarkdownFromBuffer = toMarkdownFromBuffer;
const mammoth_1 = __importDefault(require("mammoth"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const sanitize_html_1 = __importDefault(require("sanitize-html"));
/**
 * Convert DOCX or PDF Buffer → clean Markdown-like text.
 * If already MD, return as-is.
 */
async function toMarkdownFromBuffer(buf, ext) {
    if (ext === "md")
        return buf.toString("utf8");
    if (ext === "docx") {
        const res = await mammoth_1.default.convertToHtml({ buffer: buf });
        const html = (0, sanitize_html_1.default)(res.value || "", { allowedTags: sanitize_html_1.default.defaults.allowedTags.concat(["h1", "h2", "h3"]) });
        // very light HTML→MD-ish: replace <h*> with ## and strip tags
        const md = html
            .replace(/<\/?h1>/g, "\n# ")
            .replace(/<\/?h2>/g, "\n## ")
            .replace(/<\/?h3>/g, "\n### ")
            .replace(/<[^>]+>/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        return md;
    }
    if (ext === "pdf") {
        const data = await (0, pdf_parse_1.default)(buf);
        const text = (data.text || "").replace(/\r/g, "");
        return text.trim();
    }
    throw new Error(`Unsupported ext: ${ext}`);
}
