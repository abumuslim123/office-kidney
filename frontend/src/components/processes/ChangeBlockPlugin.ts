import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export type BlockChange = {
  blockIndex: number;
  changeType: 'added' | 'modified';
  oldText: string;
  newText: string;
  changedByName: string;
  changedAt: string;
};

export const changeBlockKey = new PluginKey<DecorationSet>('changeBlock');

function buildDecorations(
  doc: ProseMirrorNode,
  changes: BlockChange[],
): DecorationSet {
  if (!changes.length) return DecorationSet.empty;
  const changeMap = new Map<number, BlockChange>();
  for (const c of changes) changeMap.set(c.blockIndex, c);

  const decorations: Decoration[] = [];
  let blockIndex = 0;
  doc.forEach((node, offset) => {
    const change = changeMap.get(blockIndex);
    if (change) {
      const info =
        change.changedByName +
        (change.changedAt
          ? ', ' + new Date(change.changedAt).toLocaleString('ru-RU')
          : '');
      decorations.push(
        Decoration.node(offset, offset + node.nodeSize, {
          class: 'process-changed-block',
          'data-change-info': info,
          'data-old-text': change.oldText || '',
          'data-new-text': change.newText || '',
          'data-change-type': change.changeType,
        }),
      );
    }
    blockIndex++;
  });
  return DecorationSet.create(doc, decorations);
}

export const ChangeBlockPlugin = Extension.create({
  name: 'changeBlockPlugin',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: changeBlockKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldDecos, _oldState, newState) {
            const meta = tr.getMeta(changeBlockKey) as
              | BlockChange[]
              | undefined;
            if (meta !== undefined) {
              return buildDecorations(newState.doc, meta);
            }
            if (tr.docChanged) {
              return oldDecos.map(tr.mapping, tr.doc);
            }
            return oldDecos;
          },
        },
        props: {
          decorations(state) {
            return changeBlockKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
