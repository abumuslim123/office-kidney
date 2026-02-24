import { Paragraph } from '@tiptap/extension-paragraph';

/**
 * Extends the default Paragraph node to preserve indent level
 * (margin-left / padding-left) when pasting from Word or other rich sources.
 */
export const IndentParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      indent: {
        default: 0,
        parseHTML: (element) => {
          const ml = element.style.marginLeft || element.style.paddingLeft || '';
          const match = ml.match(/(\d+)/);
          if (!match) return 0;
          const px = parseInt(match[1], 10);
          return Math.min(Math.round(px / 40), 10);
        },
        renderHTML: (attributes) => {
          if (!attributes.indent || attributes.indent <= 0) return {};
          return {
            style: `margin-left: ${attributes.indent * 40}px`,
          };
        },
      },
    };
  },
});
