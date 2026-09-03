import { useEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { normalizeNoticeDisplayWidth } from "../../utils/notice-assets";

const MIN_WIDTH = 20;
const MAX_WIDTH = 100;
const WIDTH_STEP = 5;

function normalizeStepWidth(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return MAX_WIDTH;
  }

  const clampedValue = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, numericValue),
  );

  return Math.round(clampedValue / WIDTH_STEP) * WIDTH_STEP;
}

function resolveEditorContainer(wrapperElement) {
  if (!wrapperElement) {
    return null;
  }

  return (
    wrapperElement.closest(".ProseMirror")
    || wrapperElement.closest(".rich-text-editor-prosemirror")
    || wrapperElement.parentElement
    || null
  );
}

export default function NoticeResizableImageNodeView({
  node,
  selected,
  editor,
  updateAttributes,
}) {
  const wrapperRef = useRef(null);
  const dragStateRef = useRef(null);
  const persistedWidthRef = useRef(MAX_WIDTH);

  const [dragWidth, setDragWidth] = useState(null);

  const isEditable = Boolean(editor?.isEditable);

  const persistedWidth = useMemo(
    () => normalizeStepWidth(
      normalizeNoticeDisplayWidth(node?.attrs?.displayWidth ?? MAX_WIDTH),
    ),
    [node?.attrs?.displayWidth],
  );

  const currentWidth = dragWidth ?? persistedWidth;

  useEffect(() => {
    persistedWidthRef.current = persistedWidth;
  }, [persistedWidth]);

  function removeDragListeners(dragState) {
    if (!dragState) {
      return;
    }

    document.removeEventListener("pointermove", dragState.onPointerMove);
    document.removeEventListener("pointerup", dragState.onPointerUp);
    document.removeEventListener("pointercancel", dragState.onPointerCancel);
  }

  function finishDragging({ commit }) {
    const dragState = dragStateRef.current;

    if (!dragState) {
      return;
    }

    dragStateRef.current = null;
    removeDragListeners(dragState);

    if (
      dragState.handleElement
      && typeof dragState.handleElement.releasePointerCapture === "function"
      && dragState.handleElement.hasPointerCapture?.(dragState.pointerId)
    ) {
      dragState.handleElement.releasePointerCapture(dragState.pointerId);
    }

    document.body.style.cursor = dragState.previousCursor;
    document.body.style.userSelect = dragState.previousUserSelect;

    const finalWidth = normalizeStepWidth(dragState.latestWidth);

    setDragWidth(null);

    if (commit && finalWidth !== persistedWidthRef.current) {
      updateAttributes({
        displayWidth: finalWidth,
      });
    }
  }

  useEffect(() => {
    return () => {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      removeDragListeners(dragState);

      document.body.style.cursor = dragState.previousCursor;
      document.body.style.userSelect = dragState.previousUserSelect;

      dragStateRef.current = null;
    };
  }, []);

  function handlePointerDown(event) {
    if (!isEditable || !wrapperRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const wrapperElement = wrapperRef.current;
    const containerElement = resolveEditorContainer(wrapperElement);

    if (!containerElement) {
      return;
    }

    const wrapperRect = wrapperElement.getBoundingClientRect();
    const containerRect = containerElement.getBoundingClientRect();

    /*
     * No usar un fallback de 1 píxel.
     * Si el editor todavía no tiene tamaño medible, cancelamos el resize.
     */
    if (
      !Number.isFinite(containerRect.width)
      || containerRect.width <= 0
      || !Number.isFinite(wrapperRect.width)
      || wrapperRect.width <= 0
    ) {
      return;
    }

    const pointerId = event.pointerId;
    const handleElement = event.currentTarget;

    const dragState = {
      pointerId,
      handleElement,
      startX: event.clientX,
      startWidthPx: wrapperRect.width,
      containerWidthPx: containerRect.width,
      latestWidth: currentWidth,
      previousCursor: document.body.style.cursor,
      previousUserSelect: document.body.style.userSelect,
      onPointerMove: null,
      onPointerUp: null,
      onPointerCancel: null,
    };

    dragState.onPointerMove = (moveEvent) => {
      if (
        !dragStateRef.current
        || moveEvent.pointerId !== dragState.pointerId
      ) {
        return;
      }

      moveEvent.preventDefault();

      const deltaX = moveEvent.clientX - dragState.startX;
      const nextWidthPx = dragState.startWidthPx + deltaX;

      const rawPercentage =
        (nextWidthPx / dragState.containerWidthPx) * 100;

      const normalizedWidth = normalizeStepWidth(rawPercentage);

      /*
       * Actualizar la ref sin esperar un useEffect.
       * Así pointerup siempre recibe el último valor real.
       */
      dragState.latestWidth = normalizedWidth;

      setDragWidth((previousWidth) => (
        previousWidth === normalizedWidth
          ? previousWidth
          : normalizedWidth
      ));
    };

    dragState.onPointerUp = (upEvent) => {
      if (upEvent.pointerId !== dragState.pointerId) {
        return;
      }

      finishDragging({ commit: true });
    };

    dragState.onPointerCancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== dragState.pointerId) {
        return;
      }

      finishDragging({ commit: false });
    };

    dragStateRef.current = dragState;

    setDragWidth(currentWidth);

    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";

    handleElement.setPointerCapture?.(pointerId);

    document.addEventListener("pointermove", dragState.onPointerMove, {
      passive: false,
    });
    document.addEventListener("pointerup", dragState.onPointerUp);
    document.addEventListener("pointercancel", dragState.onPointerCancel);
  }

  function handleKeyDown(event) {
    if (!isEditable) {
      return;
    }

    let nextWidth;

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        nextWidth = currentWidth - WIDTH_STEP;
        break;

      case "ArrowRight":
      case "ArrowUp":
        nextWidth = currentWidth + WIDTH_STEP;
        break;

      case "Home":
        nextWidth = MIN_WIDTH;
        break;

      case "End":
        nextWidth = MAX_WIDTH;
        break;

      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const normalizedWidth = normalizeStepWidth(nextWidth);

    setDragWidth(null);

    if (normalizedWidth !== persistedWidth) {
      updateAttributes({
        displayWidth: normalizedWidth,
      });
    }
  }

  return (
    <NodeViewWrapper
      as="div"
      ref={wrapperRef}
      className={`notice-resizable-image${selected ? " is-selected" : ""}`}
      style={{
        width: `${currentWidth}%`,
      }}
      data-notice-width={currentWidth}
      contentEditable={false}
    >
      <img
        src={node?.attrs?.src || ""}
        alt={node?.attrs?.alt || "Imagen del aviso"}
        title={node?.attrs?.title || ""}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
      />

      {selected ? (
        <span
          className="notice-resizable-image__badge"
          aria-hidden="true"
        >
          {currentWidth}%
        </span>
      ) : null}

      {selected && isEditable ? (
        <button
          type="button"
          className="notice-image-resize-handle"
          aria-label="Cambiar tamaño de la imagen"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={currentWidth}
          aria-valuetext={`${currentWidth}%`}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
          role="slider"
          tabIndex={0}
          contentEditable={false}
        />
      ) : null}
    </NodeViewWrapper>
  );
}