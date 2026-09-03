import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { publicSiteConfig } from "../config/publicSite.config";
import { buildCanonicalPublicUrl } from "../utils/publicSite";

const MANAGED_ATTRIBUTE = "data-public-meta-managed";

function syncMetaAttribute(selector, attributeName, attributeValue, content, ownerId, previousState) {
  if (!attributeValue || !content) return null;

  let element = document.head.querySelector(selector);
  const existed = Boolean(element);
  const previousContent = existed ? element.getAttribute("content") : null;

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
  element.setAttribute(MANAGED_ATTRIBUTE, ownerId);

  previousState.push({
    type: "meta",
    element,
    attributeName,
    attributeValue,
    existed,
    previousContent,
  });

  return element;
}

function syncCanonicalLink(href, ownerId) {
  let element = document.head.querySelector('link[rel="canonical"]');
  const existed = Boolean(element);
  const previousHref = existed ? element.getAttribute("href") : null;

  if (!href) {
    return {
      element,
      existed,
      previousHref,
      created: false,
    };
  }

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
  element.setAttribute(MANAGED_ATTRIBUTE, ownerId);

  return {
    element,
    existed,
    previousHref,
    created: !existed,
  };
}

function restoreManagedMetaState(ownerId, previousState, previousTitle, canonicalState) {
  document.title = previousTitle;

  for (let index = previousState.length - 1; index >= 0; index -= 1) {
    const entry = previousState[index];
    const currentElement = document.head.querySelector(
      `meta[${entry.attributeName}="${entry.attributeValue}"]`,
    );

    if (!currentElement || currentElement.getAttribute(MANAGED_ATTRIBUTE) !== ownerId) {
      continue;
    }

    if (!entry.existed) {
      currentElement.remove();
      continue;
    }

    if (entry.previousContent === null || entry.previousContent === undefined) {
      currentElement.removeAttribute("content");
    } else {
      currentElement.setAttribute("content", entry.previousContent);
    }

    currentElement.removeAttribute(MANAGED_ATTRIBUTE);
  }

  if (!canonicalState?.element) {
    return;
  }

  const currentCanonical = document.head.querySelector('link[rel="canonical"]');
  if (!currentCanonical || currentCanonical.getAttribute(MANAGED_ATTRIBUTE) !== ownerId) {
    return;
  }

  if (!canonicalState.existed) {
    currentCanonical.remove();
    return;
  }

  if (canonicalState.previousHref) {
    currentCanonical.setAttribute("href", canonicalState.previousHref);
  } else {
    currentCanonical.removeAttribute("href");
  }

  currentCanonical.removeAttribute(MANAGED_ATTRIBUTE);
}

export function usePublicPageMeta({
  title,
  description,
  ogType = "website",
  ogImage = null,
  articlePublishedTime = null,
} = {}) {
  const location = useLocation();

  useEffect(() => {
    const ownerId = `public-meta-${location.pathname}-${Date.now()}`;
    const resolvedTitle = title
      ? `${title} | ${publicSiteConfig.name}`
      : publicSiteConfig.name;
    const resolvedDescription = description || publicSiteConfig.description;
    const previousTitle = document.title;
    const previousState = [];

    document.title = resolvedTitle;
    syncMetaAttribute(
      'meta[name="description"]',
      "name",
      "description",
      resolvedDescription,
      ownerId,
      previousState,
    );
    syncMetaAttribute(
      'meta[property="og:title"]',
      "property",
      "og:title",
      resolvedTitle,
      ownerId,
      previousState,
    );
    syncMetaAttribute(
      'meta[property="og:description"]',
      "property",
      "og:description",
      resolvedDescription,
      ownerId,
      previousState,
    );
    syncMetaAttribute(
      'meta[property="og:type"]',
      "property",
      "og:type",
      ogType,
      ownerId,
      previousState,
    );
    syncMetaAttribute(
      'meta[property="og:image"]',
      "property",
      "og:image",
      ogImage,
      ownerId,
      previousState,
    );
    syncMetaAttribute(
      'meta[property="article:published_time"]',
      "property",
      "article:published_time",
      articlePublishedTime,
      ownerId,
      previousState,
    );

    const canonicalUrl = buildCanonicalPublicUrl(location.pathname);
    const canonicalState = syncCanonicalLink(canonicalUrl, ownerId);

    return () => {
      restoreManagedMetaState(ownerId, previousState, previousTitle, canonicalState);
    };
  }, [articlePublishedTime, description, location.pathname, ogImage, ogType, title]);
}
