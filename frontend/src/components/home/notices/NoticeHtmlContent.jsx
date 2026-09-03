import { useEffect, useMemo, useRef, useState } from "react";
import { getNoticeAssetPreviewBlob } from "../../../services/notice.service";
import { getPublicNoticeAssetPreviewBlob } from "../../../services/publicNotice.service";
import {
  extractNoticeAssetUuids,
  toEditorNoticeHtml,
} from "../../../utils/notice-assets";
import { sanitizeNoticeHtml } from "../../../utils/notice-ui";

function normalizeDisplayWidth(rawValue) {
  const parsedWidth = Number.parseInt(
    String(rawValue || "").trim(),
    10,
  );

  if (!Number.isInteger(parsedWidth)) {
    return 100;
  }

  const roundedWidth = Math.round(parsedWidth / 5) * 5;

  if (roundedWidth < 20) return 20;
  if (roundedWidth > 100) return 100;

  return roundedWidth;
}

function applyNoticeImageLayout(container) {
  if (!container) {
    return;
  }

  const images = container.querySelectorAll(
    "img[data-notice-asset-id]",
  );

  images.forEach((imageElement) => {
    const displayWidth = normalizeDisplayWidth(
      imageElement.getAttribute("data-notice-width"),
    );

    imageElement.setAttribute(
      "data-notice-width",
      String(displayWidth),
    );
    imageElement.removeAttribute("width");
    imageElement.removeAttribute("height");
    imageElement.style.display = "block";
    imageElement.style.width = `${displayWidth}%`;
    imageElement.style.maxWidth = "100%";
    imageElement.style.height = "auto";
    imageElement.style.objectFit = "contain";
    imageElement.style.marginInline = "auto";
    imageElement.classList.remove(
      "notice-content-image-loading",
      "notice-content-image-error",
    );
    imageElement.classList.add("notice-content-image-ready");
  });
}

function buildPendingAdminHtml(html = "") {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(
    String(html || ""),
    "text/html",
  );
  const images = documentNode.body.querySelectorAll(
    "img[data-notice-asset-id]",
  );

  images.forEach((imageElement) => {
    imageElement.removeAttribute("src");
    imageElement.classList.remove(
      "notice-content-image-ready",
      "notice-content-image-error",
    );
    imageElement.classList.add("notice-content-image-loading");
  });

  return documentNode.body.innerHTML;
}

function markFailedImages(html = "", failedUuids = new Set()) {
  if (failedUuids.size === 0) {
    return html;
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(
    String(html || ""),
    "text/html",
  );
  const images = documentNode.body.querySelectorAll(
    "img[data-notice-asset-id]",
  );

  images.forEach((imageElement) => {
    const assetUuid = String(
      imageElement.getAttribute("data-notice-asset-id") || "",
    )
      .trim()
      .toLowerCase();

    if (!failedUuids.has(assetUuid)) {
      return;
    }

    imageElement.removeAttribute("src");
    imageElement.setAttribute(
      "data-notice-image-error",
      "true",
    );
    imageElement.classList.remove(
      "notice-content-image-loading",
      "notice-content-image-ready",
    );
    imageElement.classList.add("notice-content-image-error");
  });

  return documentNode.body.innerHTML;
}

function revokeObjectUrls(objectUrls) {
  objectUrls.forEach((objectUrl) => {
    URL.revokeObjectURL(objectUrl);
  });

  objectUrls.clear();
}

export default function NoticeHtmlContent({
  html,
  className = "",
  mode = "public",
  publicSlug = "",
}) {
  const containerRef = useRef(null);
  const sanitizedHtml = useMemo(
    () => sanitizeNoticeHtml(
      html || "<p>Sin descripción.</p>",
    ),
    [html],
  );
  const adminPendingHtml = useMemo(
    () => buildPendingAdminHtml(sanitizedHtml),
    [sanitizedHtml],
  );
  const assetUuids = useMemo(
    () => extractNoticeAssetUuids(sanitizedHtml),
    [sanitizedHtml],
  );
  const sourceKey = `${mode}::${publicSlug || ""}::${sanitizedHtml}`;
  const requiresAdminHydration =
    mode === "admin" && assetUuids.length > 0;
  const requiresPublicHydration =
    mode === "public" && Boolean(publicSlug) && assetUuids.length > 0;
  const requiresBlobHydration = requiresAdminHydration || requiresPublicHydration;
  const [imageHydration, setImageHydration] = useState({
    key: "",
    html: null,
  });

  const hydratedHtmlForCurrentSource =
    imageHydration.key === sourceKey
      ? imageHydration.html
      : null;

  const renderHtml = requiresBlobHydration
    ? hydratedHtmlForCurrentSource ?? adminPendingHtml
    : sanitizedHtml;

  useEffect(() => {
    const localObjectUrls = new Set();
    let cancelled = false;

    if (!requiresBlobHydration) {
      return () => {
        cancelled = true;
        revokeObjectUrls(localObjectUrls);
      };
    }

    async function hydrateHtml() {
      const results = await Promise.allSettled(
        assetUuids.map(async (assetUuid) => {
          const blob = requiresPublicHydration
            ? await getPublicNoticeAssetPreviewBlob(publicSlug, assetUuid)
            : await getNoticeAssetPreviewBlob(assetUuid);

          if (!(blob instanceof Blob) || blob.size <= 0) {
            throw new Error(
              "El asset recibido no contiene una imagen válida.",
            );
          }

          const objectUrl = URL.createObjectURL(blob);
          localObjectUrls.add(objectUrl);

          return {
            assetUuid,
            objectUrl,
          };
        }),
      );

      if (cancelled) {
        revokeObjectUrls(localObjectUrls);
        return;
      }

      const previewUrlMap = {};
      const failedUuids = new Set();

      results.forEach((result, index) => {
        const assetUuid = assetUuids[index];

        if (result.status === "fulfilled") {
          previewUrlMap[result.value.assetUuid] =
            result.value.objectUrl;
          return;
        }

        failedUuids.add(assetUuid);
      });

      const hydratedHtml = toEditorNoticeHtml(
        sanitizedHtml,
        previewUrlMap,
      );

      setImageHydration({
        key: sourceKey,
        html: markFailedImages(hydratedHtml, failedUuids),
      });
    }

    hydrateHtml().catch(() => {
      if (cancelled) {
        return;
      }

      setImageHydration({
        key: sourceKey,
        html: markFailedImages(
          adminPendingHtml,
          new Set(assetUuids),
        ),
      });
    });

    return () => {
      cancelled = true;
      revokeObjectUrls(localObjectUrls);
    };
  }, [
    adminPendingHtml,
    assetUuids,
    publicSlug,
    requiresBlobHydration,
    requiresPublicHydration,
    sanitizedHtml,
    sourceKey,
  ]);

  useEffect(() => {
    applyNoticeImageLayout(containerRef.current);
  }, [renderHtml]);

  const combinedClassName = [
    "notice-html-content",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={containerRef}
      className={combinedClassName}
      dangerouslySetInnerHTML={{
        __html: renderHtml,
      }}
    />
  );
}
