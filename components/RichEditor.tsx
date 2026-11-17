"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { toHtml } from "@/lib/text";

type Props = {
  initialContent: string;
  onChange: (html: string) => void;
};

export default function RichEditor({ initialContent, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing..." }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: toHtml(initialContent),
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { dir: "auto" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  const buttons: { label: string; title: string; active: boolean; run: () => void }[] = [
    { label: "B", title: "Bold", active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "I", title: "Italic", active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "S", title: "Strikethrough", active: editor.isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
    { label: "H1", title: "Heading 1", active: editor.isActive("heading", { level: 1 }), run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: "H2", title: "Heading 2", active: editor.isActive("heading", { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "•", title: "Bullet list", active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "1.", title: "Numbered list", active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "☑", title: "Checklist", active: editor.isActive("taskList"), run: () => editor.chain().focus().toggleTaskList().run() },
    { label: "❝", title: "Quote", active: editor.isActive("blockquote"), run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "</>", title: "Code block", active: editor.isActive("codeBlock"), run: () => editor.chain().focus().toggleCodeBlock().run() },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
            <div
        className="glass no-scrollbar sticky top-0 z-10 mb-4 flex gap-1 overflow-x-auto p-1.5 md:flex-wrap"
        style={{ borderRadius: 999 }}
      >
        {buttons.map((b) => (
          <button
            key={b.title}
            title={b.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={b.run}
            className={`shrink-0 min-w-9 rounded-full px-3 py-1.5 text-sm transition ${
              b.active ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/10"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}