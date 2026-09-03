import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export default function TaskDescriptionEditor({
	value,
	onChange,
	disabled = false,
	label = "Descripción",
}) {
	const editor = useEditor({
		extensions: [StarterKit],
		content: value || "<p></p>",
		onUpdate: ({ editor: editorInstance }) => {
			onChange(editorInstance.getHTML());
		},
	});

	useEffect(() => {
		if (!editor) {
			return;
		}

		const html = value || "<p></p>";
		if (editor.getHTML() !== html) {
			editor.commands.setContent(html, false);
		}
	}, [editor, value]);

	useEffect(() => {
		if (!editor) {
			return;
		}

		editor.setEditable(!disabled);
	}, [disabled, editor]);

	return (
		<div className="notice-field notice-editor">
			<span>{label}</span>
			<div className="notice-editor-toolbar">
				<button
					type="button"
					className={editor?.isActive("bold") ? "is-active" : ""}
					onClick={() => editor?.chain().focus().toggleBold().run()}
				>
					B
				</button>
				<button
					type="button"
					className={editor?.isActive("italic") ? "is-active" : ""}
					onClick={() => editor?.chain().focus().toggleItalic().run()}
				>
					I
				</button>
				<button
					type="button"
					className={editor?.isActive("strike") ? "is-active" : ""}
					onClick={() => editor?.chain().focus().toggleStrike().run()}
				>
					S
				</button>
				<button
					type="button"
					className={editor?.isActive("bulletList") ? "is-active" : ""}
					onClick={() => editor?.chain().focus().toggleBulletList().run()}
				>
					UL
				</button>
				<button
					type="button"
					className={editor?.isActive("orderedList") ? "is-active" : ""}
					onClick={() => editor?.chain().focus().toggleOrderedList().run()}
				>
					OL
				</button>
			</div>
			<EditorContent editor={editor} className="notice-editor-content" />
		</div>
	);
}
