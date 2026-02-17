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

export type { BlockChange };

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
      ChangeBlockPlugin,
    ],
    editable,
    content: incomingDoc,
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

  if (!editor) return null;

  return (
    <div ref={wrapperRef} className="relative" onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
      {editable && (
        <div className="flex flex-wrap gap-2 mb-2">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className="px-2 py-1 text-xs border rounded">B</button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className="px-2 py-1 text-xs border rounded">I</button>
          <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className="px-2 py-1 text-xs border rounded">S</button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className="px-2 py-1 text-xs border rounded underline">U</button>
          <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className="px-2 py-1 text-xs border rounded">HL</button>
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
      {tooltip.visible && (
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
    </div>
  );
}

function normalizeDoc(doc?: Record<string, unknown> | null): Record<string, unknown> {
  const type = doc && typeof doc === 'object' ? (doc as { type?: unknown }).type : undefined;
  if (type === 'doc') return doc as Record<string, unknown>;
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };
}

