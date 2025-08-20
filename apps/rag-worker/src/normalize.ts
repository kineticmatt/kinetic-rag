import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import sanitizeHtml from "sanitize-html";

/**
 * Convert DOCX or PDF Buffer → clean Markdown-like text.
 * If already MD, return as-is.
 */
export async function toMarkdownFromBuffer(buf: Buffer, ext: "docx"|"pdf"|"md"): Promise<string> {
  if (ext === "md") return buf.toString("utf8");

  if (ext === "docx") {
    const res = await mammoth.convertToHtml({ buffer: buf });
    const html = sanitizeHtml(res.value || "", { allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1","h2","h3"]) });
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
    const data = await pdfParse(buf);
    const text = (data.text || "").replace(/\r/g, "");
    return text.trim();
  }

  throw new Error(`Unsupported ext: ${ext}`);
}
