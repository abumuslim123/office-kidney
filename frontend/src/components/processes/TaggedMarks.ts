import { Mark, markPasteRule } from '@tiptap/core';

// При вставке текста вида <del>...</del>, <change>...</change>, <new>...</new> применяем марки
const delPasteRegex = /<del>([^<]*)<\/del>/gi;
const changePasteRegex = /<change>([^<]*)<\/change>/gi;
const newPasteRegex = /<new>([^<]*)<\/new>/gi;

export const TaggedDeleted = Mark.create({
  name: 'taggedDeleted',
  excludes: 'taggedChanged taggedNew',
  parseHTML() {
    return [
      { tag: 'span.tag-del' },
      { tag: 'span[data-tagged="deleted"]' },
      { tag: 'del' }, // прямой тег <del>
    ];
  },
  renderHTML() {
    return ['span', { class: 'tag-del' }, 0];
  },
  addPasteRules() {
    return [markPasteRule({ find: delPasteRegex, type: this.type })];
  },
});

export const TaggedChanged = Mark.create({
  name: 'taggedChanged',
  excludes: 'taggedDeleted taggedNew',
  parseHTML() {
    return [
      { tag: 'span.tag-change' },
      { tag: 'span[data-tagged="changed"]' },
      { tag: 'change' }, // прямой тег <change>
    ];
  },
  renderHTML() {
    return ['span', { class: 'tag-change' }, 0];
  },
  addPasteRules() {
    return [markPasteRule({ find: changePasteRegex, type: this.type })];
  },
});

export const TaggedNew = Mark.create({
  name: 'taggedNew',
  excludes: 'taggedDeleted taggedChanged',
  parseHTML() {
    return [
      { tag: 'span.tag-new' },
      { tag: 'span[data-tagged="new"]' },
      { tag: 'new' }, // прямой тег <new>
    ];
  },
  renderHTML() {
    return ['span', { class: 'tag-new' }, 0];
  },
  addPasteRules() {
    return [markPasteRule({ find: newPasteRegex, type: this.type })];
  },
});
