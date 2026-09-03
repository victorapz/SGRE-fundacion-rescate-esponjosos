import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
} from "lucide-react";
import { normalizeRichTextValue } from "../../utils/rich-text";
import { normalizeNoticeDisplayWidth } from "../../utils/notice-assets";
import NoticeResizableImageNodeView from "./NoticeResizableImageNodeView";
import IconButton from "./IconButton";

function createNoticeImageExtension(enableResizableNodeView = false) {
  return Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        assetUuid: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-notice-asset-id"),
          renderHTML: (attributes) => (
            attributes.assetUuid
              ? { "data-notice-asset-id": attributes.assetUuid }
              : {}
          ),
        },
        displayWidth: {
          default: 100,
          parseHTML: (element) => normalizeNoticeDisplayWidth(
            element.getAttribute("data-notice-width"),
          ),
          renderHTML: (attributes) => (
            attributes.displayWidth
              ? { "data-notice-width": String(normalizeNoticeDisplayWidth(attributes.displayWidth)) }
              : {}
          ),
        },
      };
    },
    addNodeView() {
      if (!enableResizableNodeView) {
        return null;
      }

      return ReactNodeViewRenderer(NoticeResizableImageNodeView);
    },
  });
}

function extractImageFile(items = []) {
  const collection = Array.from(items || []);

  for (const item of collection) {
    if (item?.type?.startsWith("image/")) {
      if (typeof item.getAsFile === "function") {
        const file = item.getAsFile();
        if (file) {
          return file;
        }
      }

      if (item instanceof File) {
        return item;
      }
    }
  }

  return null;
}

export default function RichTextEditor({
  value,
  onChange,
  onUploadImage,
  disabled = false,
  placeholder = "",
}) {
  const inputId = useId();
  const fileInputRef = useRef(null);
  const [uploadError, setUploadError] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const enableResizableImages = Boolean(onUploadImage);

  const extensions = useMemo(
    () => [
      StarterKit,
      createNoticeImageExtension(enableResizableImages),
    ],
    [enableResizableImages],
  );

  const editor = useEditor({
    extensions,
    content: normalizeRichTextValue(value),
    editorProps: {
      attributes: {
        class: "rich-text-editor-prosemirror",
      },
      handlePaste: (_view, event) => {
        if (!onUploadImage || disabled || isUploadingImage) {
          return false;
        }

        const file = extractImageFile(event?.clipboardData?.items || []);
        if (!file) {
          return false;
        }

        event.preventDefault();
        void handleImageUpload(file);
        return true;
      },
      handleDrop: (_view, event) => {
        if (!onUploadImage || disabled || isUploadingImage) {
          return false;
        }

        const file = extractImageFile(event?.dataTransfer?.files || event?.dataTransfer?.items || []);
        if (!file) {
          return false;
        }

        event.preventDefault();
        void handleImageUpload(file);
        return true;
      },
    },
    onUpdate: ({ editor: editorInstance }) => {
      onChange(editorInstance.getHTML());
    },
    immediatelyRender: false,
  });

  async function handleImageUpload(file) {
    if (!onUploadImage || !file || disabled || isUploadingImage) {
      return;
    }

    setUploadError("");
    setIsUploadingImage(true);

    try {
      const uploadedImage = await onUploadImage(file);
      if (!uploadedImage?.assetUuid || !uploadedImage?.src) {
        throw new Error("No se pudo insertar la imagen en el editor.");
      }

      editor?.chain().focus().setImage({
        src: uploadedImage.src,
        alt: uploadedImage.alt || "Imagen del aviso",
        title: uploadedImage.title || null,
        assetUuid: uploadedImage.assetUuid,
        displayWidth: normalizeNoticeDisplayWidth(uploadedImage.displayWidth || 100),
      }).run();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "No se pudo subir la imagen.");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  useEffect(() => {
    if (!editor) return;

    const html = normalizeRichTextValue(value);
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html, false);
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div className="notice-editor rich-text-editor">
      <div className="notice-editor-toolbar">
        <IconButton
          icon={Bold}
          label="Negrita"
          variant="ghost"
          className={editor?.isActive("bold") ? "is-active" : ""}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={disabled}
        />
        <IconButton
          icon={Italic}
          label="Cursiva"
          variant="ghost"
          className={editor?.isActive("italic") ? "is-active" : ""}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={disabled}
        />
        <IconButton
          icon={Strikethrough}
          label="Tachado"
          variant="ghost"
          className={editor?.isActive("strike") ? "is-active" : ""}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          disabled={disabled}
        />
        <IconButton
          icon={Heading2}
          label="Encabezado"
          variant="ghost"
          className={editor?.isActive("heading", { level: 2 }) ? "is-active" : ""}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={disabled}
        />
        <IconButton
          icon={List}
          label="Lista con viñetas"
          variant="ghost"
          className={editor?.isActive("bulletList") ? "is-active" : ""}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          disabled={disabled}
        />
        <IconButton
          icon={ListOrdered}
          label="Lista numerada"
          variant="ghost"
          className={editor?.isActive("orderedList") ? "is-active" : ""}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
        />
        {onUploadImage ? (
          <>
            <input
              id={inputId}
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                const [file] = Array.from(event.target.files || []);
                if (file) {
                  void handleImageUpload(file);
                }
              }}
            />
            <IconButton
              icon={ImagePlus}
              label="Insertar imagen en editor"
              variant="secondary"
              disabled={disabled || isUploadingImage}
              onClick={() => fileInputRef.current?.click()}
            />
          </>
        ) : null}
      </div>
      <EditorContent
        editor={editor}
        className="notice-editor-content rich-text-editor-content"
        data-placeholder={placeholder}
      />
      {isUploadingImage ? (
        <p className="notice-editor-helper">Subiendo imagen...</p>
      ) : null}
      {onUploadImage ? (
        <p className="notice-editor-helper">
          Selecciona una imagen y arrastra su esquina inferior derecha para ajustar el ancho.
        </p>
      ) : null}
      {uploadError ? <p className="error-text">{uploadError}</p> : null}
    </div>
  );
}
