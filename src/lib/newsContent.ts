import type {
  NewsBlockquoteNode,
  NewsContentJson,
  NewsContentNode,
  NewsHardBreakNode,
  NewsInlineNode,
  NewsListItemNode,
  NewsParagraphNode,
  NewsTextMark,
  NewsTextNode,
} from './newsTypes';

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'LI']);

export function emptyNewsDocument(): NewsContentJson {
  return { type: 'doc', content: [] };
}

export function sanitizeNewsHref(value: unknown): string | null {
  const href = String(value || '').trim();
  if (!href) return null;
  if (href.startsWith('/') || href.startsWith('#')) return href;
  try {
    const url = new URL(href);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) return url.href;
  } catch {
    return null;
  }
  return null;
}

export function sanitizeNewsImageSrc(value: unknown): string | null {
  const src = String(value || '').trim();
  if (!src) return null;
  if (src.startsWith('/')) return src;
  try {
    const url = new URL(src);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')) {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseYouTubeVideoId(value: unknown): string | null {
  const source = String(value || '').trim();
  if (!source) return null;
  if (YOUTUBE_ID_RE.test(source)) return source;
  try {
    const url = new URL(source);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else {
        const parts = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1] || '';
      }
    }
    return YOUTUBE_ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

function textMarkKey(mark: NewsTextMark) {
  return mark.type === 'link' ? `link:${mark.attrs.href}` : mark.type;
}

function mergeMarks(base: NewsTextMark[] = [], extra: NewsTextMark[] = []) {
  const map = new Map<string, NewsTextMark>();
  [...base, ...extra].forEach((mark) => map.set(textMarkKey(mark), mark));
  return Array.from(map.values());
}

function inlineNodesFromDom(node: Node, inheritedMarks: NewsTextMark[] = []): NewsInlineNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (!text) return [];
    const result: NewsTextNode = { type: 'text', text };
    if (inheritedMarks.length) result.marks = inheritedMarks;
    return [result];
  }
  if (!(node instanceof HTMLElement)) return [];

  const tag = node.tagName.toUpperCase();
  if (tag === 'BR') return [{ type: 'hardBreak' } as NewsHardBreakNode];
  if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'VIDEO', 'AUDIO', 'SVG', 'CANVAS'].includes(tag)) return [];
  if (tag === 'IMG') return [];

  let marks = inheritedMarks;
  if (tag === 'STRONG' || tag === 'B') marks = mergeMarks(marks, [{ type: 'bold' }]);
  if (tag === 'EM' || tag === 'I') marks = mergeMarks(marks, [{ type: 'italic' }]);
  if (tag === 'U') marks = mergeMarks(marks, [{ type: 'underline' }]);
  if (tag === 'A') {
    const href = sanitizeNewsHref(node.getAttribute('href'));
    if (href) marks = mergeMarks(marks, [{ type: 'link', attrs: { href } }]);
  }

  return Array.from(node.childNodes).flatMap((child) => inlineNodesFromDom(child, marks));
}

function trimInlineEdges(nodes: NewsInlineNode[]) {
  const copy = nodes.map((node) => ({ ...node })) as NewsInlineNode[];
  while (copy.length && copy[0].type === 'text') {
    const text = copy[0].text.replace(/^\s+/, '');
    if (text) {
      (copy[0] as NewsTextNode).text = text;
      break;
    }
    copy.shift();
  }
  while (copy.length && copy[copy.length - 1].type === 'text') {
    const last = copy[copy.length - 1] as NewsTextNode;
    const text = last.text.replace(/\s+$/, '');
    if (text) {
      last.text = text;
      break;
    }
    copy.pop();
  }
  return copy;
}

function paragraphFromElement(element: HTMLElement): NewsParagraphNode | null {
  const content = trimInlineEdges(Array.from(element.childNodes).flatMap((node) => inlineNodesFromDom(node)));
  if (!content.length) return null;
  return { type: 'paragraph', content };
}

function listItemFromElement(element: HTMLElement): NewsListItemNode | null {
  const paragraphs: NewsParagraphNode[] = [];
  const inlineBuffer: Node[] = [];
  const flushInline = () => {
    if (!inlineBuffer.length) return;
    const wrapper = document.createElement('p');
    inlineBuffer.forEach((node) => wrapper.appendChild(node.cloneNode(true)));
    const paragraph = paragraphFromElement(wrapper);
    if (paragraph) paragraphs.push(paragraph);
    inlineBuffer.length = 0;
  };

  Array.from(element.childNodes).forEach((child) => {
    if (child instanceof HTMLElement && BLOCK_TAGS.has(child.tagName.toUpperCase())) {
      flushInline();
      if (child.tagName.toUpperCase() === 'P' || child.tagName.toUpperCase() === 'DIV') {
        const paragraph = paragraphFromElement(child);
        if (paragraph) paragraphs.push(paragraph);
      } else {
        const content = trimInlineEdges(inlineNodesFromDom(child));
        if (content.length) paragraphs.push({ type: 'paragraph', content });
      }
    } else {
      inlineBuffer.push(child);
    }
  });
  flushInline();
  return paragraphs.length ? { type: 'listItem', content: paragraphs } : null;
}

function blockNodesFromElement(element: HTMLElement, trustedEditorNodes: boolean): NewsContentNode[] {
  const tag = element.tagName.toUpperCase();
  if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'VIDEO', 'AUDIO', 'SVG', 'CANVAS'].includes(tag)) return [];

  if (trustedEditorNodes && element.dataset.newsNode === 'image') {
    const image = element.querySelector('img');
    const src = sanitizeNewsImageSrc(image?.getAttribute('src'));
    if (!src) return [];
    const alt = String(image?.getAttribute('alt') || '').trim();
    const caption = String(element.querySelector('figcaption')?.textContent || '').trim();
    return [{ type: 'image', attrs: { src, ...(alt ? { alt } : {}), ...(caption ? { caption } : {}) } }];
  }

  if (trustedEditorNodes && element.dataset.newsNode === 'youtube') {
    const videoId = parseYouTubeVideoId(element.dataset.youtubeId);
    return videoId ? [{ type: 'youtube', attrs: { videoId } }] : [];
  }

  if (tag === 'P' || tag === 'DIV') {
    const paragraph = paragraphFromElement(element);
    return paragraph ? [paragraph] : [];
  }

  if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
    const content = trimInlineEdges(Array.from(element.childNodes).flatMap((node) => inlineNodesFromDom(node)));
    if (!content.length) return [];
    return [{ type: 'heading', attrs: { level: tag === 'H3' ? 3 : 2 }, content }];
  }

  if (tag === 'BLOCKQUOTE') {
    const children = Array.from(element.children).flatMap((child) => blockNodesFromElement(child as HTMLElement, false));
    const allowed = children.filter((node): node is NewsParagraphNode | { type: 'heading'; attrs: { level: 2 | 3 }; content?: NewsInlineNode[] } => node.type === 'paragraph' || node.type === 'heading');
    if (allowed.length) return [{ type: 'blockquote', content: allowed } as NewsBlockquoteNode];
    const paragraph = paragraphFromElement(element);
    return paragraph ? [{ type: 'blockquote', content: [paragraph] }] : [];
  }

  if (tag === 'UL' || tag === 'OL') {
    const items = Array.from(element.children)
      .filter((child) => child.tagName.toUpperCase() === 'LI')
      .map((child) => listItemFromElement(child as HTMLElement))
      .filter(Boolean) as NewsListItemNode[];
    if (!items.length) return [];
    return [{ type: tag === 'UL' ? 'bulletList' : 'orderedList', content: items } as NewsContentNode];
  }

  if (tag === 'LI') {
    const item = listItemFromElement(element);
    return item?.content || [];
  }

  if (tag === 'IMG') return [];

  const blockChildren = Array.from(element.children).filter((child) => BLOCK_TAGS.has(child.tagName.toUpperCase()));
  if (blockChildren.length) {
    return blockChildren.flatMap((child) => blockNodesFromElement(child as HTMLElement, trustedEditorNodes));
  }
  const paragraph = paragraphFromElement(element);
  return paragraph ? [paragraph] : [];
}

function domToNewsDocument(root: HTMLElement, trustedEditorNodes: boolean): NewsContentJson {
  const content: NewsContentNode[] = [];
  const inlineBuffer: Node[] = [];
  const flushInline = () => {
    if (!inlineBuffer.length) return;
    const wrapper = document.createElement('p');
    inlineBuffer.forEach((node) => wrapper.appendChild(node.cloneNode(true)));
    const paragraph = paragraphFromElement(wrapper);
    if (paragraph) content.push(paragraph);
    inlineBuffer.length = 0;
  };

  Array.from(root.childNodes).forEach((child) => {
    if (child instanceof HTMLElement) {
      const tag = child.tagName.toUpperCase();
      const isSystemNode = trustedEditorNodes && Boolean(child.dataset.newsNode);
      if (BLOCK_TAGS.has(tag) || isSystemNode || ['FIGURE'].includes(tag)) {
        flushInline();
        content.push(...blockNodesFromElement(child, trustedEditorNodes));
        return;
      }
    }
    inlineBuffer.push(child);
  });
  flushInline();
  return { type: 'doc', content };
}

export function editorHtmlToNewsContent(html: string): NewsContentJson {
  if (typeof document === 'undefined') return emptyNewsDocument();
  const root = document.createElement('div');
  root.innerHTML = html;
  return domToNewsDocument(root, true);
}

export function pastedHtmlToNewsContent(html: string): NewsContentJson {
  if (typeof document === 'undefined') return emptyNewsDocument();
  const root = document.createElement('div');
  root.innerHTML = html;
  return domToNewsDocument(root, false);
}

export function plainTextToNewsContent(value: string): NewsContentJson {
  const source = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!source) return emptyNewsDocument();
  return {
    type: 'doc',
    content: source
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => ({
        type: 'paragraph',
        content: paragraph.split('\n').flatMap((line, index) => [
          ...(index ? [{ type: 'hardBreak' } as NewsHardBreakNode] : []),
          { type: 'text', text: line } as NewsTextNode,
        ]),
      })),
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inlineToHtml(nodes: NewsInlineNode[] = []) {
  return nodes.map((node) => {
    if (node.type === 'hardBreak') return '<br>';
    let html = escapeHtml(node.text);
    (node.marks || []).forEach((mark) => {
      if (mark.type === 'bold') html = `<strong>${html}</strong>`;
      else if (mark.type === 'italic') html = `<em>${html}</em>`;
      else if (mark.type === 'underline') html = `<u>${html}</u>`;
      else if (mark.type === 'link') {
        const href = sanitizeNewsHref(mark.attrs.href);
        if (href) html = `<a href="${escapeHtml(href)}">${html}</a>`;
      }
    });
    return html;
  }).join('');
}

export function newsContentToEditorHtml(doc: NewsContentJson | null | undefined) {
  const nodes = Array.isArray(doc?.content) ? doc!.content! : [];
  return nodes.map((node) => {
    if (node.type === 'paragraph') return `<p>${inlineToHtml(node.content)}</p>`;
    if (node.type === 'heading') return `<h${node.attrs.level}>${inlineToHtml(node.content)}</h${node.attrs.level}>`;
    if (node.type === 'blockquote') {
      const body = (node.content || []).map((child) => child.type === 'heading'
        ? `<h${child.attrs.level}>${inlineToHtml(child.content)}</h${child.attrs.level}>`
        : `<p>${inlineToHtml(child.content)}</p>`).join('');
      return `<blockquote>${body}</blockquote>`;
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const tag = node.type === 'bulletList' ? 'ul' : 'ol';
      const items = (node.content || []).map((item) => `<li>${(item.content || []).map((paragraph) => `<p>${inlineToHtml(paragraph.content)}</p>`).join('')}</li>`).join('');
      return `<${tag}>${items}</${tag}>`;
    }
    if (node.type === 'image') {
      const src = sanitizeNewsImageSrc(node.attrs.src);
      if (!src) return '';
      const alt = escapeHtml(node.attrs.alt || '');
      const caption = String(node.attrs.caption || '').trim();
      return `<figure data-news-node="image" contenteditable="false"><img src="${escapeHtml(src)}" alt="${alt}">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
    }
    if (node.type === 'youtube') {
      const id = parseYouTubeVideoId(node.attrs.videoId);
      return id ? `<div data-news-node="youtube" data-youtube-id="${id}" contenteditable="false">YouTube · ${id}</div>` : '';
    }
    return '';
  }).join('');
}

export function sanitizePastedNewsHtml(html: string) {
  return newsContentToEditorHtml(pastedHtmlToNewsContent(html));
}

export function newsContentPlainText(doc: NewsContentJson | null | undefined) {
  const readInline = (nodes: NewsInlineNode[] = []) => nodes.map((node) => node.type === 'hardBreak' ? '\n' : node.text).join('');
  const readNode = (node: NewsContentNode): string => {
    if (node.type === 'paragraph' || node.type === 'heading') return readInline(node.content);
    if (node.type === 'blockquote') return (node.content || []).map((child) => readInline(child.content)).join('\n');
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      return (node.content || []).map((item) => (item.content || []).map((p) => readInline(p.content)).join(' ')).join('\n');
    }
    if (node.type === 'image') return node.attrs.alt || node.attrs.caption || '';
    if (node.type === 'youtube') return 'YouTube';
    return '';
  };
  return (doc?.content || []).map(readNode).filter(Boolean).join('\n\n').trim();
}

export function newsContentHasMeaningfulContent(doc: NewsContentJson | null | undefined) {
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) return false;
  return doc.content.some((node) => {
    if (node.type === 'image') return Boolean(sanitizeNewsImageSrc(node.attrs.src));
    if (node.type === 'youtube') return Boolean(parseYouTubeVideoId(node.attrs.videoId));
    return Boolean(newsContentPlainText({ type: 'doc', content: [node] }));
  });
}
