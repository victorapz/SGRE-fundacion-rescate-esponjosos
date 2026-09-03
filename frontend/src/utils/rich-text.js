import DOMPurify from "dompurify";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeRichTextValue(value) {
  if (!value) {
    return "<p></p>";
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return "<p></p>";
  }

  if (/<[a-z][\s\S]*>/i.test(normalizedValue)) {
    return normalizedValue;
  }

  const lines = normalizedValue
    .split(/\r?\n/)
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean);

  if (lines.length === 0) {
    return "<p></p>";
  }

  return `<p>${lines.join("<br />")}</p>`;
}

export function sanitizeRichTextHtml(value) {
  return DOMPurify.sanitize(normalizeRichTextValue(value), {
    USE_PROFILES: { html: true },
  });
}

export function isRichTextEmpty(value) {
  const stripped = sanitizeRichTextHtml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();

  return stripped.length === 0;
}

export function richTextToPlainText(value) {
  const sanitized = sanitizeRichTextHtml(value);

  if (typeof window !== "undefined" && window.DOMParser) {
    const parser = new window.DOMParser();
    const documentNode = parser.parseFromString(sanitized, "text/html");
    return documentNode.body.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  return sanitized.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function truncateRichText(value, maxLength = 90) {
  const plainText = richTextToPlainText(value);
  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength).trim()}...`;
}
