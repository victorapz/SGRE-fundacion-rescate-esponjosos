export function getRequestErrorMessage(
  error,
  fallback = "Ocurrio un error inesperado.",
  networkMessage = "No fue posible comunicarse con el servidor. Intenta nuevamente.",
) {
  const responseMessage = error?.response?.data?.message;
  const detailMessage = error?.response?.data?.details;
  const rawMessage = typeof detailMessage === "string" && detailMessage.trim()
    ? detailMessage
    : typeof responseMessage === "string" && responseMessage.trim()
      ? responseMessage
      : typeof error?.message === "string" && error.message.trim()
        ? error.message
        : "";

  if (!error?.response && rawMessage) {
    if (/^network error$/i.test(rawMessage.trim())) {
      return networkMessage;
    }

    return sanitizeRequestErrorMessage(rawMessage, networkMessage);
  }

  if (!error?.response) {
    return networkMessage;
  }

  if (!rawMessage) {
    return fallback;
  }

  return sanitizeRequestErrorMessage(rawMessage, fallback);
}

export function buildRequestError(error, fallback, networkMessage) {
  return new Error(getRequestErrorMessage(error, fallback, networkMessage));
}

function sanitizeRequestErrorMessage(message, fallback) {
  const normalized = String(message || "").trim();

  if (!normalized) {
    return fallback;
  }

  const forbiddenPatterns = [
    /\[object object\]/i,
    /axioserror/i,
    /queryfailederror/i,
    /\bclient error\b/i,
    /\bserver error\b/i,
    /select .* from /i,
    /insert into /i,
    /update .* set /i,
    /delete from /i,
    /\bsyntax error\b/i,
  ];

  if (forbiddenPatterns.some((pattern) => pattern.test(normalized))) {
    return fallback;
  }

  return normalized;
}
