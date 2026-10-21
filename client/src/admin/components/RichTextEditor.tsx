import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold, Heading2, Heading3, Image as ImageIcon, Italic, Link2, List, ListOrdered, Quote, Redo2, Strikethrough,
  Table as TableIcon, Underline as UnderlineIcon, Undo2, Unlink,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { cn } from '../../components/ui/cn';
import { MediaPicker } from './MediaPicker';

function ToolButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn('inline-flex h-9 w-9 items-center justify-center rounded text-ink hover:bg-primary-50 disabled:opacity-40', active && 'bg-primary-100 text-primary-800')}
    >
      {children}
    </button>
  );
}

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i;

function Toolbar({ editor, onImage, onLink }: { editor: Editor; onImage: () => void; onLink: () => void }) {
  const icon = 'h-4 w-4';
  return (
    <div role="toolbar" aria-label="Matn formati" className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface px-2 py-1.5">
      <ToolButton label="Qalin" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className={icon} /></ToolButton>
      <ToolButton label="Kursiv" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className={icon} /></ToolButton>
      <ToolButton label="Tagiga chizilgan" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className={icon} /></ToolButton>
      <ToolButton label="O‘chirilgan matn" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className={icon} /></ToolButton>
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <ToolButton label="Sarlavha 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className={icon} /></ToolButton>
      <ToolButton label="Sarlavha 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className={icon} /></ToolButton>
      <ToolButton label="Markerli ro‘yxat" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className={icon} /></ToolButton>
      <ToolButton label="Raqamli ro‘yxat" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className={icon} /></ToolButton>
      <ToolButton label="Iqtibos" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className={icon} /></ToolButton>
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <ToolButton label="Havola qo‘shish" active={editor.isActive('link')} onClick={onLink}><Link2 className={icon} /></ToolButton>
      <ToolButton label="Havolani olib tashlash" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}><Unlink className={icon} /></ToolButton>
      <ToolButton label="Rasm qo‘shish" onClick={onImage}><ImageIcon className={icon} /></ToolButton>
      <ToolButton label="Jadval qo‘shish" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className={icon} /></ToolButton>
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <ToolButton label="Bekor qilish" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className={icon} /></ToolButton>
      <ToolButton label="Qaytarish" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className={icon} /></ToolButton>
    </div>
  );
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  label: string;
  invalid?: boolean;
}

/** Tiptap asosidagi boy matn muharriri. Chiqish HTML'i serverda yana tozalanadi (allowlist). */
export function RichTextEditor({ value, onChange, label, invalid }: Props) {
  const [imageOpen, setImageOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState('');
  const [hrefError, setHrefError] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: false } }),
      Image,
      TableKit,
    ],
    content: value,
    editorProps: {
      attributes: { class: 'prose-content min-h-[16rem] max-h-[36rem] overflow-y-auto p-4 focus:outline-none', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  // Tashqaridan o'zgargan qiymat (masalan, versiyani tiklash) muharrirga o'tkaziladi
  useEffect(() => {
    if (editor && value !== (editor.isEmpty ? '' : editor.getHTML())) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const openLink = () => {
    setHref((editor.getAttributes('link').href as string | undefined) ?? '');
    setHrefError('');
    setLinkOpen(true);
  };
  const applyLink = () => {
    const v = href.trim();
    if (!SAFE_HREF.test(v)) {
      setHrefError('Manzil http://, https://, mailto:, tel: yoki "/" bilan boshlanishi kerak');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: v }).run();
    setLinkOpen(false);
  };

  return (
    <div className={cn('overflow-hidden rounded-md border bg-white', invalid ? 'border-danger-600' : 'border-line')}>
      <Toolbar editor={editor} onImage={() => setImageOpen(true)} onLink={openLink} />
      <EditorContent editor={editor} />
      <MediaPicker
        open={imageOpen}
        kind="IMAGE"
        title="Rasm qo‘shish"
        onClose={() => setImageOpen(false)}
        onSelect={(m) => {
          if (m.url) editor.chain().focus().setImage({ src: m.url, alt: m.translations.uz.alt || m.originalName }).run();
          setImageOpen(false);
        }}
      />
      <Modal
        open={linkOpen}
        title="Havola"
        onClose={() => setLinkOpen(false)}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setLinkOpen(false)}>Bekor qilish</Button><Button onClick={applyLink}>Qo‘llash</Button></>}
      >
        <label htmlFor="rte-href" className="mb-1 block text-sm font-medium">Havola manzili</label>
        <Input id="rte-href" value={href} placeholder="https://…" aria-invalid={hrefError ? true : undefined} onChange={(e) => setHref(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }} />
        {hrefError && <p role="alert" className="mt-1 text-sm font-medium text-danger-600">{hrefError}</p>}
      </Modal>
    </div>
  );
}
