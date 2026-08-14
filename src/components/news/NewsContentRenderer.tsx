import { Fragment, type ReactNode } from 'react';
import {
  parseYouTubeVideoId,
  sanitizeNewsHref,
  sanitizeNewsImageSrc,
} from '../../lib/newsContent';
import type {
  NewsContentJson,
  NewsContentNode,
  NewsInlineNode,
  NewsTextNode,
} from '../../lib/newsTypes';

type Props = {
  content: NewsContentJson | null | undefined;
  className?: string;
};

function renderText(node: NewsTextNode, key: string): ReactNode {
  let child: ReactNode = node.text;
  (node.marks || []).forEach((mark, index) => {
    const markKey = `${key}-mark-${index}`;
    if (mark.type === 'bold') child = <strong key={markKey}>{child}</strong>;
    else if (mark.type === 'italic') child = <em key={markKey}>{child}</em>;
    else if (mark.type === 'underline') child = <u key={markKey}>{child}</u>;
    else if (mark.type === 'link') {
      const href = sanitizeNewsHref(mark.attrs.href);
      if (!href) return;
      const external = /^https?:/i.test(href);
      child = (
        <a
          key={markKey}
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {child}
        </a>
      );
    }
  });
  return child;
}

function renderInline(nodes: NewsInlineNode[] | undefined, keyPrefix: string) {
  return (nodes || []).map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === 'hardBreak') return <br key={key} />;
    return <Fragment key={key}>{renderText(node, key)}</Fragment>;
  });
}

function renderNode(node: NewsContentNode, key: string): ReactNode {
  if (node.type === 'paragraph') return <p key={key}>{renderInline(node.content, key)}</p>;
  if (node.type === 'heading') {
    return node.attrs.level === 3
      ? <h3 key={key}>{renderInline(node.content, key)}</h3>
      : <h2 key={key}>{renderInline(node.content, key)}</h2>;
  }
  if (node.type === 'blockquote') {
    return (
      <blockquote key={key}>
        {(node.content || []).map((child, index) => (
          child.type === 'heading'
            ? child.attrs.level === 3
              ? <h3 key={`${key}-${index}`}>{renderInline(child.content, `${key}-${index}`)}</h3>
              : <h2 key={`${key}-${index}`}>{renderInline(child.content, `${key}-${index}`)}</h2>
            : <p key={`${key}-${index}`}>{renderInline(child.content, `${key}-${index}`)}</p>
        ))}
      </blockquote>
    );
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const items = (node.content || []).map((item, index) => (
      <li key={`${key}-${index}`}>
        {(item.content || []).map((paragraph, pIndex) => (
          <p key={`${key}-${index}-${pIndex}`}>{renderInline(paragraph.content, `${key}-${index}-${pIndex}`)}</p>
        ))}
      </li>
    ));
    return node.type === 'bulletList' ? <ul key={key}>{items}</ul> : <ol key={key}>{items}</ol>;
  }
  if (node.type === 'image') {
    const src = sanitizeNewsImageSrc(node.attrs.src);
    if (!src) return null;
    return (
      <figure key={key} className="d68-news-content__image">
        <img src={src} alt={node.attrs.alt || ''} loading="lazy" decoding="async" />
        {node.attrs.caption ? <figcaption>{node.attrs.caption}</figcaption> : null}
      </figure>
    );
  }
  if (node.type === 'youtube') {
    const videoId = parseYouTubeVideoId(node.attrs.videoId);
    if (!videoId) return null;
    return (
      <div key={key} className="d68-news-content__video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title="YouTube video"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }
  return null;
}

export default function NewsContentRenderer({ content, className = '' }: Props) {
  if (!content || content.type !== 'doc' || !Array.isArray(content.content)) return null;
  return (
    <div className={`d68-news-content ${className}`.trim()}>
      {content.content.map((node, index) => renderNode(node, `news-node-${index}`))}
    </div>
  );
}
