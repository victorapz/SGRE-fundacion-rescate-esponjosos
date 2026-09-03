import {
  isRichTextEmpty,
  richTextToPlainText,
  sanitizeRichTextHtml,
} from "./rich-text.js";

export const NOTICE_STATUS = {
  DRAFT: "BORRADOR",
  PUBLISHED: "PUBLICADO",
  ARCHIVED: "ARCHIVADO",
};

export const NOTICE_STATUS_LABELS = {
  [NOTICE_STATUS.DRAFT]: "Borrador",
  [NOTICE_STATUS.PUBLISHED]: "Publicado",
  [NOTICE_STATUS.ARCHIVED]: "Archivado",
};

export const NOTICE_STATUS_CLASS = {
  [NOTICE_STATUS.DRAFT]: "draft",
  [NOTICE_STATUS.PUBLISHED]: "published",
  [NOTICE_STATUS.ARCHIVED]: "archived",
};

export const NOTICE_VISIBILITY = {
  PUBLIC: "public",
  INTERNAL: "internal",
};

export const NOTICE_VISIBILITY_LABELS = {
  [NOTICE_VISIBILITY.PUBLIC]: "Visible para todos",
  [NOTICE_VISIBILITY.INTERNAL]: "Visibilidad interna",
};

export function getNoticeVisibilityKey(notice) {
  return notice?.isPublic ? NOTICE_VISIBILITY.PUBLIC : NOTICE_VISIBILITY.INTERNAL;
}

export function getNoticePrimaryDate(notice) {
  return notice?.publishedAt || null;
}

function parseSortableDate(value) {
  if (!value || typeof value !== "string") {
    return { time: -Infinity, fallbackId: 0 };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    return { time: Number.isNaN(parsed.getTime()) ? -Infinity : parsed.getTime(), fallbackId: 0 };
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split("-").map(Number);
    const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
    return { time: Number.isNaN(parsed.getTime()) ? -Infinity : parsed.getTime(), fallbackId: 0 };
  }

  const parsed = new Date(value);
  return { time: Number.isNaN(parsed.getTime()) ? -Infinity : parsed.getTime(), fallbackId: 0 };
}

export function compareNoticesByDate(left, right, order = "desc") {
  const leftDate = parseSortableDate(getNoticePrimaryDate(left)).time;
  const rightDate = parseSortableDate(getNoticePrimaryDate(right)).time;

  if (leftDate !== rightDate) {
    return order === "asc" ? leftDate - rightDate : rightDate - leftDate;
  }

  const leftId = Number(left?.id || 0);
  const rightId = Number(right?.id || 0);
  return order === "asc" ? leftId - rightId : rightId - leftId;
}

export function formatNoticeDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  let dateValue;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    dateValue = new Date(`${value}T00:00:00`);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split("-").map(Number);
    dateValue = new Date(year, month - 1, day, 0, 0, 0, 0);
  } else {
    dateValue = new Date(value);
  }

  if (Number.isNaN(dateValue.getTime())) {
    return value;
  }

  const day = String(dateValue.getDate()).padStart(2, "0");
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const year = String(dateValue.getFullYear());
  return `${day}-${month}-${year}`;
}

export function getNoticePreview(value) {
  return richTextToPlainText(value);
}

export function sanitizeNoticeHtml(value) {
  return sanitizeRichTextHtml(value || "<p>Sin descripcion.</p>");
}

export function isNoticeContentEmpty(value) {
  return isRichTextEmpty(value);
}

export function buildNoticeForm(notice) {
  return {
    title: notice?.title ?? "",
    summary: notice?.summary ?? "",
    description: notice?.description ?? "",
    publishedAt: notice?.publishedAt ?? "",
    status: notice?.status ?? NOTICE_STATUS.DRAFT,
    isPublic: Boolean(notice?.isPublic),
  };
}

export function buildNoticePayload(form, statusOverride) {
  return {
    titulo: form.title,
    resumen: form.summary,
    descripcion: form.description,
    estado: statusOverride ?? form.status,
    publico: Boolean(form.isPublic),
  };
}
