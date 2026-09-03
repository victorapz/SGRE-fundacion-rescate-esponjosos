import { useEffect, useRef, useState } from "react";
import { getNoticeAssetPreviewBlob } from "../../../services/notice.service";

export default function AuthenticatedNoticeImage({
  assetUuid,
  alt = "",
  className = "",
  fallback = null,
  loadingFallback = null,
  onStateChange = null,
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState(assetUuid ? "loading" : "empty");
  const objectUrlRef = useRef("");
  const loadedAssetRef = useRef("");

  useEffect(() => {
    if (!assetUuid) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = "";
      }
      loadedAssetRef.current = "";
      onStateChange?.("empty");
      return undefined;
    }

    if (loadedAssetRef.current === assetUuid && objectUrlRef.current) {
      setImageUrl(objectUrlRef.current);
      setStatus("ready");
      onStateChange?.("ready");
      return undefined;
    }

    let isMounted = true;
    setStatus("loading");
    onStateChange?.("loading");

    getNoticeAssetPreviewBlob(assetUuid)
      .then((blob) => {
        if (!isMounted) return;

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        objectUrlRef.current = URL.createObjectURL(blob);
        loadedAssetRef.current = assetUuid;
        setImageUrl(objectUrlRef.current);
        setStatus("ready");
        onStateChange?.("ready");
      })
      .catch(() => {
        if (!isMounted) return;

        setImageUrl("");
        setStatus("error");
        onStateChange?.("error");
      });

    return () => {
      isMounted = false;
    };
  }, [assetUuid, onStateChange]);

  useEffect(() => () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
  }, []);

  if (!assetUuid) {
    return fallback;
  }

  if (status === "ready" && imageUrl) {
    return <img src={imageUrl} alt={alt} className={className} />;
  }

  if (status === "loading" && loadingFallback) {
    return loadingFallback;
  }

  return fallback;
}
