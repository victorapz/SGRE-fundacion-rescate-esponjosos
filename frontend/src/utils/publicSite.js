const SAFE_PUBLIC_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

function asHumanValue(value) {
  if (typeof value !== "string") {
    return "Por confirmar";
  }

  const normalized = value.trim();
  return normalized ? normalized : "Por confirmar";
}

export function buildPublicRequestConfig(overrides = {}) {
  return {
    skipAuth: true,
    ...(overrides || {}),
  };
}

export function getPublicHttpErrorMessage(error, fallbackMessage) {
  const rawMessage = error?.response?.data?.details
    || error?.response?.data?.message
    || error?.message
    || fallbackMessage;
  const message = String(rawMessage || "").trim();

  if (!message) {
    return fallbackMessage;
  }

  if (/network|timeout|tempor|ECONN|fetch/i.test(message)) {
    return "No pudimos cargar esta informacion en este momento.";
  }

  if (/sql|query|stack|typeorm|constraint|column/i.test(message)) {
    return fallbackMessage;
  }

  return message;
}

export function sanitizePublicExternalUrl(rawValue) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return null;
  }

  const normalizedValue = rawValue.trim();

  if (normalizedValue.startsWith("mailto:") || normalizedValue.startsWith("tel:")) {
    try {
      const parsedUrl = new URL(normalizedValue);
      return SAFE_PUBLIC_PROTOCOLS.has(parsedUrl.protocol) ? parsedUrl.toString() : null;
    } catch {
      return null;
    }
  }

  try {
    const parsedUrl = new URL(normalizedValue);

    if (
      !SAFE_PUBLIC_PROTOCOLS.has(parsedUrl.protocol)
      || parsedUrl.username
      || parsedUrl.password
    ) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

export function getConfiguredPublicSiteUrl() {
  const rawValue = typeof import.meta.env?.VITE_PUBLIC_SITE_URL === "string"
    ? import.meta.env.VITE_PUBLIC_SITE_URL.trim()
    : "";

  if (!rawValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawValue);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return null;
    }
    if (parsedUrl.username || parsedUrl.password) {
      return null;
    }

    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";
    return parsedUrl.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function buildCanonicalPublicUrl(pathname) {
  const baseUrl = getConfiguredPublicSiteUrl();
  if (!baseUrl || typeof pathname !== "string" || !pathname) {
    return null;
  }

  try {
    return new URL(pathname, `${baseUrl}/`).toString();
  } catch {
    return null;
  }
}

export function buildPublicAbsoluteUrl(pathname) {
  return buildCanonicalPublicUrl(pathname);
}

export function buildPublicTransferFields(transferData = {}) {
  return [
    { key: "holder", label: "Titular", value: asHumanValue(transferData.holder) },
    { key: "rut", label: "RUT", value: asHumanValue(transferData.rut) },
    { key: "bank", label: "Banco", value: asHumanValue(transferData.bank) },
    { key: "accountType", label: "Tipo de cuenta", value: asHumanValue(transferData.accountType) },
    { key: "accountNumber", label: "Número de cuenta", value: asHumanValue(transferData.accountNumber) },
    { key: "email", label: "Correo", value: asHumanValue(transferData.email) },
  ];
}

export function buildTransferCopyText(transferData = {}) {
  return buildPublicTransferFields(transferData)
    .map((item) => `${item.label}: ${item.value}`)
    .join("\n");
}

export function isValidPublicEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
