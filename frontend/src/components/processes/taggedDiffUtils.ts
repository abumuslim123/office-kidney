import type { BlockChange } from './ChangeBlockPlugin';

const TAGGED_DEL = 'taggedDeleted';
const TAGGED_CHANGE = 'taggedChanged';
const TAGGED_NEW = 'taggedNew';

function getBlockContent(node: Record<string, unknown>): unknown[] {
  const content = node.content;
  if (Array.isArray(content)) return content;
  return [];
}

function getNodeText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;
  if (typeof n.text === 'string') return n.text;
  if (Array.isArray(n.content)) {
    return (n.content as unknown[]).map(getNodeText).join('');
  }
  return '';
}

function hasTaggedMark(marks: unknown[], name: string): boolean {
  if (!Array.isArray(marks)) return false;
  return marks.some(
    (m) => typeof m === 'object' && m !== null && (m as Record<string, unknown>).type === name,
  );
}

/** oldText = только удалённое (del), newText = только изменённое/новое (change, new). Без марки — не считается изменением. */
function extractBlockTaggedTexts(blockNode: Record<string, unknown>): { oldText: string; newText: string } {
  const oldParts: string[] = [];
  const newParts: string[] = [];
  const content = getBlockContent(blockNode);

  function walk(nodes: unknown[]) {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const n = node as Record<string, unknown>;
      const text = getNodeText(node);
      if (!text) continue;
      const marks = (n.marks as unknown[]) ?? [];
      if (hasTaggedMark(marks, TAGGED_DEL)) {
        oldParts.push(text);
      } else if (hasTaggedMark(marks, TAGGED_CHANGE) || hasTaggedMark(marks, TAGGED_NEW)) {
        newParts.push(text);
      }
    }
  }

  walk(content);
  return {
    oldText: oldParts.join('').replace(/\s+/g, ' ').trim(),
    newText: newParts.join('').replace(/\s+/g, ' ').trim(),
  };
}

function getDocBlocks(doc: Record<string, unknown>): Record<string, unknown>[] {
  const inner = (doc.doc ?? doc) as Record<string, unknown>;
  const content = inner.content as unknown[] | undefined;
  if (!Array.isArray(content)) return [];
  return content as Record<string, unknown>[];
}

/** Текст документа без фрагментов с маркой taggedDeleted (для отправки в AI). */
export function getTextExcludingDeleted(
  doc: Record<string, unknown> | null | undefined,
): string {
  if (!doc || typeof doc !== 'object') return '';
  const blocks = getDocBlocks(doc);
  const parts: string[] = [];
  for (const block of blocks) {
    const content = getBlockContent(block);
    const blockParts: string[] = [];
    for (const node of content) {
      if (!node || typeof node !== 'object') continue;
      const n = node as Record<string, unknown>;
      const text = getNodeText(node);
      if (!text) continue;
      const marks = (n.marks as unknown[]) ?? [];
      if (hasTaggedMark(marks, TAGGED_DEL)) continue;
      blockParts.push(text);
    }
    parts.push(blockParts.join('').replace(/\s+/g, ' ').trim());
  }
  return parts.filter(Boolean).join('\n');
}

export function hasDocTaggedMarks(doc: Record<string, unknown> | null | undefined): boolean {
  if (!doc || typeof doc !== 'object') return false;
  const blocks = getDocBlocks(doc);
  for (const block of blocks) {
    const content = getBlockContent(block);
    for (const node of content) {
      if (!node || typeof node !== 'object') continue;
      const marks = ((node as Record<string, unknown>).marks as unknown[]) ?? [];
      if (
        hasTaggedMark(marks, TAGGED_DEL) ||
        hasTaggedMark(marks, TAGGED_CHANGE) ||
        hasTaggedMark(marks, TAGGED_NEW)
      ) {
        return true;
      }
    }
  }
  return false;
}

export function buildDiffFromTaggedDoc(
  doc: Record<string, unknown> | null | undefined,
  changedByName = '',
  changedAt = '',
): BlockChange[] {
  if (!doc || typeof doc !== 'object') return [];
  const blocks = getDocBlocks(doc);
  const changes: BlockChange[] = [];
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const { oldText, newText } = extractBlockTaggedTexts(blocks[blockIndex]);
    if (oldText || newText) {
      changes.push({
        blockIndex,
        changeType: oldText ? 'modified' : 'added',
        oldText,
        newText,
        changedByName,
        changedAt,
      });
    }
  }
  return changes;
}
