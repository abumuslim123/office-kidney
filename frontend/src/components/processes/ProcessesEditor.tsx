import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import ListKeymap from '@tiptap/extension-list-keymap';
import { ChangeBlockPlugin, changeBlockKey, BlockChange } from './ChangeBlockPlugin';
import { IndentParagraph } from './IndentExtension';
import { TaggedDeleted, TaggedChanged, TaggedNew } from './TaggedMarks';

export type { BlockChange };

const ENABLE_HOVER_DIFF_TOOLTIP = false;
const ENABLE_DIFF_BLOCK_HIGHLIGHT = false;

function transformTaggedPastedHTML(html: string): string {
  if (!html || typeof html !== 'string') return html;
  return html
    .replace(/<del\b[^>]*>/gi, '<span class="tag-del">')
    .replace(/<\/del>/gi, '</span>')
    .replace(/<change\b[^>]*>/gi, '<span class="tag-change">')
    .replace(/<\/change>/gi, '</span>')
    .replace(/<new\b[^>]*>/gi, '<span class="tag-new">')
    .replace(/<\/new>/gi, '</span>');
}

type ProcessesEditorProps = {
  editable: boolean;
  contentDoc?: Record<string, unknown> | null;
  changes?: BlockChange[];
  onChange?: (payload: { doc: Record<string, unknown>; text: string }) => void;
  minHeightClassName?: string;
};

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  info: string;
  oldText: string;
  newText: string;
  changeType: string;
};

type DiffModalState = {
  visible: boolean;
  info: string;
  oldText: string;
  newText: string;
  changeType: string;
};

export default function ProcessesEditor({
  editable,
  contentDoc,
  changes = [],
  onChange,
  minHeightClassName = 'min-h-40',
}: ProcessesEditorProps) {
  const incomingDoc = useMemo(() => normalizeDoc(contentDoc), [contentDoc]);
  const incomingDocSig = useMemo(() => JSON.stringify(incomingDoc), [incomingDoc]);
  const changesSig = useMemo(() => JSON.stringify(changes ?? []), [changes]);
  const lastAppliedSigRef = useRef<string>('');
  const lastAppliedChangesRef = useRef<string>('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    info: '',
    oldText: '',
    newText: '',
    changeType: '',
  });
  const [diffModal, setDiffModal] = useState<DiffModalState>({
    visible: false,
    info: '',
    oldText: '',
    newText: '',
    changeType: '',
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false }),
      IndentParagraph,
      Link.configure({ openOnClick: false, autolink: true }),
      TextStyle,
      Color,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ListKeymap,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaggedDeleted,
      TaggedChanged,
      TaggedNew,
      ChangeBlockPlugin,
    ],
    editable,
    content: incomingDoc,
    editorProps: {
      transformPastedHTML(html) {
        return transformTaggedPastedHTML(html);
      },
    },
    onUpdate: ({ editor: current }) => {
      if (!onChange) return;
      onChange({
        doc: current.getJSON() as Record<string, unknown>,
        text: current.getText({ blockSeparator: ' ' }).replace(/\s+/g, ' ').trim(),
      });
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const currentSig = JSON.stringify(editor.getJSON());
    const docChangedExternally = incomingDocSig !== currentSig;

    if (docChangedExternally && incomingDocSig !== lastAppliedSigRef.current) {
      editor.commands.setContent(incomingDoc, { emitUpdate: false });
      lastAppliedSigRef.current = incomingDocSig;
    }

    if (lastAppliedChangesRef.current !== changesSig) {
      const tr = editor.state.tr.setMeta(changeBlockKey, changes);
      editor.view.dispatch(tr);
      lastAppliedChangesRef.current = changesSig;
    }
  }, [editor, incomingDoc, incomingDocSig, changes, changesSig]);

  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      if (!ENABLE_HOVER_DIFF_TOOLTIP) return;
      const target = e.target as HTMLElement;
      const block = target.closest('.process-changed-block');
      if (!block || !wrapperRef.current) {
        return;
      }
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const blockRect = block.getBoundingClientRect();
      setTooltip({
        visible: true,
        x: blockRect.left - wrapperRect.left,
        y: blockRect.top - wrapperRect.top - 4,
        info: block.getAttribute('data-change-info') || '',
        oldText: block.getAttribute('data-old-text') || '',
        newText: block.getAttribute('data-new-text') || '',
        changeType: block.getAttribute('data-change-type') || 'added',
      });
    },
    [],
  );

  const handleMouseOut = useCallback(
    (e: React.MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest?.('.process-changed-block')) return;
      if (related?.closest?.('.process-change-tooltip')) return;
      setTooltip((t) => ({ ...t, visible: false }));
    },
    [],
  );

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const block = target.closest('.process-changed-block');
    if (!block) return;
    setDiffModal({
      visible: true,
      info: block.getAttribute('data-change-info') || '',
      oldText: block.getAttribute('data-old-text') || '',
      newText: block.getAttribute('data-new-text') || '',
      changeType: block.getAttribute('data-change-type') || 'added',
    });
  }, []);

  if (!editor) return null;

  return (
    <div
      ref={wrapperRef}
      className={`relative${!ENABLE_DIFF_BLOCK_HIGHLIGHT ? ' process-editor-no-block-highlight' : ''}`}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onDoubleClick={handleDoubleClick}
    >
      {editable && (
        <div className="flex flex-wrap gap-2 mb-2 items-center">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className="px-2 py-1 text-xs border rounded">B</button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className="px-2 py-1 text-xs border rounded">I</button>
          <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className="px-2 py-1 text-xs border rounded">S</button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className="px-2 py-1 text-xs border rounded underline">U</button>
          <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className="px-2 py-1 text-xs border rounded">HL</button>
          <span className="text-gray-400 mx-1">|</span>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleMark('taggedDeleted').run()}
            className={`px-2 py-1 text-xs border rounded ${editor.isActive('taggedDeleted') ? 'bg-red-100 border-red-400' : ''}`}
            title="Удалено"
          >
            Удалено
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleMark('taggedChanged').run()}
            className={`px-2 py-1 text-xs border rounded ${editor.isActive('taggedChanged') ? 'bg-amber-100 border-amber-400' : ''}`}
            title="Изменено"
          >
            Изменено
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleMark('taggedNew').run()}
            className={`px-2 py-1 text-xs border rounded ${editor.isActive('taggedNew') ? 'bg-green-100 border-green-400' : ''}`}
            title="Новое"
          >
            Новое
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="px-2 py-1 text-xs border rounded">H2</button>
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className="px-2 py-1 text-xs border rounded">•</button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className="px-2 py-1 text-xs border rounded">1.</button>
          <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className="px-2 py-1 text-xs border rounded">"</button>
          <button
            type="button"
            onClick={() => {
              const href = window.prompt('Ссылка', 'https://');
              if (!href) return;
              editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
            }}
            className="px-2 py-1 text-xs border rounded"
          >Link</button>
          <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="px-2 py-1 text-xs border rounded">Table</button>
          <button type="button" onClick={() => editor.chain().focus().undo().run()} className="px-2 py-1 text-xs border rounded">↶</button>
          <button type="button" onClick={() => editor.chain().focus().redo().run()} className="px-2 py-1 text-xs border rounded">↷</button>
        </div>
      )}
      <EditorContent
        editor={editor}
        className={`process-editor border border-gray-300 rounded text-sm px-3 py-2 ${minHeightClassName}`}
      />
      {ENABLE_HOVER_DIFF_TOOLTIP && tooltip.visible && (
        <div
          className="process-change-tooltip absolute z-50 bg-gray-900 text-white text-xs rounded-md px-3 py-2 shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateY(-100%)',
            maxWidth: 480,
          }}
        >
          <div className="font-medium">{tooltip.info}</div>
          {tooltip.changeType === 'modified' && tooltip.oldText && (
            <div className="mt-1 pt-1 border-t border-gray-700">
              <span className="text-red-400">Удалено: </span>
              <span className="text-gray-300 break-words line-through">
                {tooltip.oldText.length > 250
                  ? tooltip.oldText.slice(0, 250) + '...'
                  : tooltip.oldText}
              </span>
            </div>
          )}
          {tooltip.newText && (
            <div className={tooltip.oldText ? 'mt-1' : 'mt-1 pt-1 border-t border-gray-700'}>
              <span className="text-green-400">Добавлено: </span>
              <span className="text-gray-200 break-words">
                {tooltip.newText.length > 250
                  ? tooltip.newText.slice(0, 250) + '...'
                  : tooltip.newText}
              </span>
            </div>
          )}
        </div>
      )}
      {diffModal.visible && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDiffModal((m) => ({ ...m, visible: false }))}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Изменения</h3>
              <button
                type="button"
                onClick={() => setDiffModal((m) => ({ ...m, visible: false }))}
                className="text-gray-500 hover:text-gray-700"
              >
                Закрыть
              </button>
            </div>
            {diffModal.info && (
              <div className="px-4 py-2 text-sm text-gray-600 border-b border-gray-100">
                {diffModal.info}
              </div>
            )}
            <div className="px-4 py-3 overflow-auto flex-1 space-y-3">
              {diffModal.changeType === 'modified' && diffModal.oldText && (
                <div>
                  <span className="text-sm font-medium text-red-600">Удалено: </span>
                  <div className="mt-1 p-2 bg-red-50 rounded text-sm text-gray-800 line-through whitespace-pre-wrap break-words">
                    {diffModal.oldText}
                  </div>
                </div>
              )}
              {diffModal.newText && (
                <div>
                  <span className="text-sm font-medium text-green-600">Добавлено: </span>
                  <div className="mt-1 p-2 bg-green-50 rounded text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {diffModal.newText}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TAGGED_TAG_TO_MARK: Record<string, string> = {
  del: 'taggedDeleted',
  change: 'taggedChanged',
  new: 'taggedNew',
};
const TAGGED_REGEX = /<(del|change|new)>([^<]*)<\/\1>/gi;

/** Разбивает текст с тегами <del>, <change>, <new> на массив inline-узлов с марками */
function splitTextWithTaggedMarks(text: string): Array<{ type: 'text'; text: string; marks?: { type: string }[] }> {
  const parts: Array<{ type: 'text'; text: string; marks?: { type: string }[] }> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  TAGGED_REGEX.lastIndex = 0;
  while ((m = TAGGED_REGEX.exec(text)) !== null) {
    if (m.index > lastIndex) {
      const plain = text.slice(lastIndex, m.index);
      if (plain.length) parts.push({ type: 'text', text: plain });
    }
    const markType = TAGGED_TAG_TO_MARK[m[1].toLowerCase()];
    if (markType) parts.push({ type: 'text', text: m[2], marks: [{ type: markType }] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    const plain = text.slice(lastIndex);
    if (plain.length) parts.push({ type: 'text', text: plain });
  }
  return parts.length ? parts : [{ type: 'text', text }];
}

function hasTaggedTags(text: string): boolean {
  return /<(?:del|change|new)>/i.test(text);
}

/** Рекурсивно заменяет в документе текст вида <del>...</del> на узлы с марками */
function normalizeDocTaggedMarks(node: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(node.content)) return node;
  const newContent: Record<string, unknown>[] = [];
  for (const child of node.content as Record<string, unknown>[]) {
    if (child && typeof child === 'object' && child.type === 'text' && typeof (child as { text?: string }).text === 'string') {
      const text = (child as { text: string }).text;
      if (hasTaggedTags(text)) {
        newContent.push(...splitTextWithTaggedMarks(text));
        continue;
      }
    }
    newContent.push(normalizeDocTaggedMarks(child as Record<string, unknown>));
  }
  return { ...node, content: newContent };
}

function normalizeDoc(doc?: Record<string, unknown> | null): Record<string, unknown> {
  const type = doc && typeof doc === 'object' ? (doc as { type?: unknown }).type : undefined;
  if (type !== 'doc') {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  const withMarks = normalizeDocTaggedMarks(doc as Record<string, unknown>);
  return withMarks as Record<string, unknown>;
}

