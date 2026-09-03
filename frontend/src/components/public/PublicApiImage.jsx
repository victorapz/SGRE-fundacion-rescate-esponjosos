import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios.js";
import { buildPublicRequestConfig } from "../../utils/publicSite.js";
import {
  buildAbsoluteApiAssetUrl,
  isApiAssetUrl,
} from "../../utils/publicApiAssets.js";

function isRenderableImageBlob(blob) {
  if (!(blob instanceof Blob) || blob.size <= 0) {
    return false;
  }

  const mimeType = String(blob.type || "").toLowerCase();
  return !mimeType || mimeType.startsWith("image/");
}

export default function PublicApiImage({
  src,
  alt,
  fallback = null,
  onError,
  ...imageProps
}) {
  const normalizedSrc = useMemo(() => buildAbsoluteApiAssetUrl(src), [src]);
  const shouldFetchAsBlob = useMemo(
    () => Boolean(normalizedSrc) && isApiAssetUrl(normalizedSrc),
    [normalizedSrc],
  );
  const [state, setState] = useState({
    status: normalizedSrc ? "loading" : "empty",
    objectUrl: null,
  });

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    if (!normalizedSrc) {
      setState({ status: "empty", objectUrl: null });
      return () => {};
    }

    if (!shouldFetchAsBlob) {
      setState({ status: "ready", objectUrl: normalizedSrc });
      return () => {};
    }

    setState({ status: "loading", objectUrl: null });

    async function loadImage() {
      try {
        const response = await api.get(
          normalizedSrc,
          buildPublicRequestConfig({
            responseType: "blob",
            skipAuthRefresh: true,
          }),
        );
        const blob = response?.data;

        if (!isRenderableImageBlob(blob)) {
          throw new Error("El recurso recibido no es una imagen válida.");
        }

        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setState({ status: "ready", objectUrl });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: "error", objectUrl: null });
          if (typeof onError === "function") {
            onError(error);
          }
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [normalizedSrc, onError, shouldFetchAsBlob]);

  if (state.status !== "ready" || !state.objectUrl) {
    return fallback;
  }

  return (
    <img
      {...imageProps}
      src={state.objectUrl}
      alt={alt}
      onError={onError}
    />
  );
}
