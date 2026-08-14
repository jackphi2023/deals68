import { ChangeEvent, type ClipboardEvent as ReactClipboardEvent, useEffect, useRef, useState } from 'react';
import {
  editorHtmlToNewsContent,
  newsContentToEditorHtml,
  parseYouTubeVideoId,
  plainTextToNewsContent,
  sanitizeNewsHref,
  sanitizePastedNewsHtml,
} from '../../lib/newsContent';
import type { NewsContentJson } from '../../lib/newsTypes';
import { adminUploadNewsInlineImage } from '../../services/newsMediaService';

type Props = {
  value: NewsContentJson | null;
  onChange: (value: NewsContentJson) => void;
  onBusyChange?: (busy: boolean) => void;
  onError?: (message: string) => void;
  ariaLabel?: string;
};

type CommandButtonProps = {
  label: string;
  title?: string;
  onRun: () => void;
  disabled?: boolean;
};

function CommandButton({ label, title, onRun, disabled = false }: CommandButtonProps) {
  return (
    <button
      type="button"
      className="d68-news-editor__tool"
      title={title || label}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault();
        if (!disabled) onRun();
      }}
    >
      {label}
    </button>
  );
}

export default function NewsEditor({
  value,
  onChange,
  onBusyChange,
  onError,
  ariaLabel = 'Nội dung bài viết',
}: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const emittedRef = useRef('');
  const [uploading, setUploading] = useState(false);

  function reportError(message: string) {
    onError?.(message);
  }

  function rememberSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) selectionRef.current = range.cloneRange();
  }

  function restoreSelection() {
    const range = selectionRef.current;
    if (!range) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function focusEditor() {
    editorRef.current?.focus();
    restoreSelection();
  }

  function syncFromDom() {
    const editor = editorRef.current;
    if (!editor) return;
    const next = editorHtmlToNewsContent(editor.innerHTML);
    emittedRef.current = JSON.stringify(next);
    onChange(next);
    rememberSelection();
  }

  function runCommand(command: string, value?: string) {
    focusEditor();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(command, false, value);
    syncFromDom();
  }

  function insertHtml(html: string) {
    focusEditor();
    document.execCommand('insertHTML', false, html);
    syncFromDom();
  }

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const incoming = JSON.stringify(value || { type: 'doc', content: [] });
    if (incoming === emittedRef.current) return;
    editor.innerHTML = newsContentToEditorHtml(value);
    emittedRef.current = incoming;
  }, [value]);

  useEffect(() => {
    const handler = () => rememberSelection();
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  function addLink() {
    rememberSelection();
    const raw = window.prompt('Nhập URL liên kết (https://, http://, /path, #anchor, mailto:, tel:):', 'https://');
    if (raw === null) return;
    const href = sanitizeNewsHref(raw);
    if (!href) {
      reportError('URL liên kết không hợp lệ. Chỉ hỗ trợ HTTP(S), đường dẫn nội bộ, anchor, mailto hoặc tel.');
      return;
    }
    runCommand('createLink', href);
  }

  function addYouTube() {
    rememberSelection();
    const raw = window.prompt('Dán URL YouTube hoặc video ID:');
    if (raw === null) return;
    const videoId = parseYouTubeVideoId(raw);
    if (!videoId) {
      reportError('URL YouTube không hợp lệ.');
      return;
    }
    insertHtml(
      `<div data-news-node="youtube" data-youtube-id="${videoId}" contenteditable="false">YouTube · ${videoId}</div><p><br></p>`,
    );
  }

  async function uploadInlineImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    rememberSelection();
    setUploading(true);
    onBusyChange?.(true);
    try {
      const uploaded = await adminUploadNewsInlineImage(file);
      const alt = String(window.prompt('Alt text cho ảnh (khuyến nghị mô tả nội dung ảnh):', '') || '').trim();
      const caption = String(window.prompt('Chú thích ảnh (có thể để trống):', '') || '').trim();
      const escapeAttr = (text: string) => text
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      insertHtml(
        `<figure data-news-node="image" contenteditable="false"><img src="${escapeAttr(uploaded.publicUrl)}" alt="${escapeAttr(alt)}">${caption ? `<figcaption>${escapeAttr(caption)}</figcaption>` : ''}</figure><p><br></p>`,
      );
    } catch (error: any) {
      reportError(error?.message || 'Không upload được ảnh nội dung.');
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  }

  function handlePaste(event: ReactClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const plain = event.clipboardData.getData('text/plain');
    const cleanHtml = html
      ? sanitizePastedNewsHtml(html)
      : newsContentToEditorHtml(plainTextToNewsContent(plain));
    document.execCommand('insertHTML', false, cleanHtml || '');
    syncFromDom();
  }

  function clearFormatting() {
    focusEditor();
    document.execCommand('removeFormat', false);
    document.execCommand('unlink', false);
    document.execCommand('formatBlock', false, 'p');
    syncFromDom();
  }

  return (
    <div className="d68-news-editor">
      <div className="d68-news-editor__toolbar" role="toolbar" aria-label="Công cụ soạn bài">
        <CommandButton label="P" title="Đoạn văn" onRun={() => runCommand('formatBlock', 'p')} />
        <CommandButton label="H2" onRun={() => runCommand('formatBlock', 'h2')} />
        <CommandButton label="H3" onRun={() => runCommand('formatBlock', 'h3')} />
        <span className="d68-news-editor__divider" />
        <CommandButton label="B" title="Bôi đậm" onRun={() => runCommand('bold')} />
        <CommandButton label="I" title="In nghiêng" onRun={() => runCommand('italic')} />
        <CommandButton label="U" title="Gạch chân" onRun={() => runCommand('underline')} />
        <CommandButton label="• List" title="Danh sách dấu chấm" onRun={() => runCommand('insertUnorderedList')} />
        <CommandButton label="1. List" title="Danh sách đánh số" onRun={() => runCommand('insertOrderedList')} />
        <CommandButton label="❝" title="Trích dẫn" onRun={() => runCommand('formatBlock', 'blockquote')} />
        <span className="d68-news-editor__divider" />
        <CommandButton label="Link" onRun={addLink} />
        <CommandButton label={uploading ? 'Ảnh…' : 'Ảnh'} disabled={uploading} onRun={() => imageInputRef.current?.click()} />
        <CommandButton label="YouTube" onRun={addYouTube} />
        <span className="d68-news-editor__divider" />
        <CommandButton label="↶" title="Undo" onRun={() => runCommand('undo')} />
        <CommandButton label="↷" title="Redo" onRun={() => runCommand('redo')} />
        <CommandButton label="Xóa format" onRun={clearFormatting} />
      </div>

      <div
        ref={editorRef}
        className="d68-news-editor__surface"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-placeholder="Nhập nội dung hoặc dán từ Word/web. Font, màu, CSS và embed lạ sẽ tự động bị loại bỏ."
        onInput={syncFromDom}
        onPaste={handlePaste}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onBlur={syncFromDom}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => void uploadInlineImage(event)}
      />
      <p className="d68-news-editor__hint">
        H1 được dành cho tiêu đề bài. H1 khi paste sẽ chuyển thành H2; ảnh từ nguồn paste và iframe tùy ý sẽ bị loại bỏ.
      </p>
    </div>
  );
}
