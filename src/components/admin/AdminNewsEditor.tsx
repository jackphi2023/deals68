import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  adminCreateNews,
  adminEnsureNewsTags,
  adminGetNewsById,
  adminSetNewsArticleTags,
  adminUpdateNews,
} from '../../services/newsService';
import { adminUploadNewsFeaturedImage } from '../../services/newsMediaService';
import {
  emptyNewsDocument,
  newsContentHasMeaningfulContent,
} from '../../lib/newsContent';
import {
  normalizeNewsSlug,
  type NewsArticle,
  type NewsArticleStatus,
  type NewsArticleWriteInput,
  type NewsContentJson,
  type NewsLanguage,
  type NewsTagWriteInput,
} from '../../lib/newsTypes';
import NewsEditor from '../news/NewsEditor';
import NewsContentRenderer from '../news/NewsContentRenderer';

type Props = {
  articleId?: string;
  onCancel: () => void;
  onSaved: (articleId: string) => void;
};

type EditorForm = {
  status: Exclude<NewsArticleStatus, 'deleted'>;
  title_vi: string;
  title_en: string;
  slug_vi: string;
  slug_en: string;
  excerpt_vi: string;
  excerpt_en: string;
  content_vi: NewsContentJson;
  content_en: NewsContentJson;
  featured_image_url: string;
  featured_image_alt_vi: string;
  featured_image_alt_en: string;
  is_featured: boolean;
  published_date: string;
  author_name: string;
  seo_title_vi: string;
  seo_title_en: string;
  seo_description_vi: string;
  seo_description_en: string;
  tags: string;
};

function emptyForm(): EditorForm {
  return {
    status: 'draft',
    title_vi: '',
    title_en: '',
    slug_vi: '',
    slug_en: '',
    excerpt_vi: '',
    excerpt_en: '',
    content_vi: emptyNewsDocument(),
    content_en: emptyNewsDocument(),
    featured_image_url: '',
    featured_image_alt_vi: '',
    featured_image_alt_en: '',
    is_featured: false,
    published_date: '',
    author_name: 'Deals68.com',
    seo_title_vi: '',
    seo_title_en: '',
    seo_description_vi: '',
    seo_description_en: '',
    tags: '',
  };
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function articleToForm(article: NewsArticle): EditorForm {
  return {
    status: article.status === 'published' ? 'published' : 'draft',
    title_vi: article.title_vi || '',
    title_en: article.title_en || '',
    slug_vi: article.slug_vi || '',
    slug_en: article.slug_en || '',
    excerpt_vi: article.excerpt_vi || '',
    excerpt_en: article.excerpt_en || '',
    content_vi: article.content_json_vi || emptyNewsDocument(),
    content_en: article.content_json_en || emptyNewsDocument(),
    featured_image_url: article.featured_image_url || '',
    featured_image_alt_vi: article.featured_image_alt_vi || '',
    featured_image_alt_en: article.featured_image_alt_en || '',
    is_featured: Boolean(article.is_featured),
    published_date: article.published_date || '',
    author_name: article.author_name || 'Deals68.com',
    seo_title_vi: article.seo_title_vi || '',
    seo_title_en: article.seo_title_en || '',
    seo_description_vi: article.seo_description_vi || '',
    seo_description_en: article.seo_description_en || '',
    tags: article.tags
      .map((tag) => tag.label_en ? `${tag.label_vi} | ${tag.label_en}` : tag.label_vi)
      .join(', '),
  };
}

function parseTags(raw: string): NewsTagWriteInput[] {
  const values = String(raw || '')
    .split(/[,\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const deduped = new Map<string, NewsTagWriteInput>();
  values.forEach((value) => {
    const [viRaw, ...enParts] = value.split('|');
    const labelVi = clean(viRaw);
    const labelEn = clean(enParts.join('|'));
    const slug = normalizeNewsSlug(labelVi);
    if (!labelVi || !slug) return;
    deduped.set(slug, {
      slug,
      label_vi: labelVi,
      label_en: labelEn || null,
    });
  });
  return Array.from(deduped.values());
}

function readImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const result = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được kích thước ảnh.'));
    };
    image.src = url;
  });
}

function validateForPublish(form: EditorForm) {
  const missing: string[] = [];
  if (!clean(form.title_vi)) missing.push('Tiêu đề VI');
  if (!clean(form.slug_vi)) missing.push('Slug VI');
  if (!clean(form.excerpt_vi)) missing.push('Mô tả ngắn VI');
  if (!newsContentHasMeaningfulContent(form.content_vi)) missing.push('Nội dung VI');
  if (!clean(form.published_date)) missing.push('Ngày đăng');
  if (!clean(form.featured_image_url)) missing.push('Ảnh đại diện 4:3');
  if (missing.length) return `Chưa đủ thông tin để xuất bản: ${missing.join(', ')}.`;

  const hasAnyEn = [
    clean(form.title_en),
    clean(form.slug_en),
    clean(form.excerpt_en),
    newsContentHasMeaningfulContent(form.content_en) ? 'content' : '',
  ].some(Boolean);
  if (hasAnyEn) {
    const missingEn: string[] = [];
    if (!clean(form.title_en)) missingEn.push('Title');
    if (!clean(form.slug_en)) missingEn.push('Slug');
    if (!clean(form.excerpt_en)) missingEn.push('Short description');
    if (!newsContentHasMeaningfulContent(form.content_en)) missingEn.push('Content');
    if (missingEn.length) {
      return `Bản EN đang nhập dở. Hãy hoàn tất ${missingEn.join(', ')} hoặc để trống toàn bộ bản EN.`;
    }
  }
  return '';
}

function languageLabel(language: NewsLanguage) {
  return language === 'vi' ? 'Tiếng Việt' : 'English';
}

export default function AdminNewsEditor({ articleId, onCancel, onSaved }: Props) {
  const [form, setForm] = useState<EditorForm>(() => emptyForm());
  const [language, setLanguage] = useState<NewsLanguage>('vi');
  const [loading, setLoading] = useState(Boolean(articleId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [slugTouched, setSlugTouched] = useState({ vi: Boolean(articleId), en: Boolean(articleId) });
  const isEditing = Boolean(articleId);

  useEffect(() => {
    let cancelled = false;
    if (!articleId) {
      setForm(emptyForm());
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError('');
    void adminGetNewsById(articleId)
      .then((article) => {
        if (cancelled) return;
        if (!article) throw new Error('Không tìm thấy bài News.');
        if (article.status === 'deleted') throw new Error('Bài đã xóa mềm và không thể chỉnh sửa.');
        setForm(articleToForm(article));
        setSlugTouched({ vi: true, en: true });
      })
      .catch((loadError: any) => {
        if (!cancelled) setError(loadError?.message || 'Không tải được bài News.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const tagCount = useMemo(() => parseTags(form.tags).length, [form.tags]);
  const activeContent = language === 'vi' ? form.content_vi : form.content_en;

  function patch(values: Partial<EditorForm>) {
    setForm((current) => ({ ...current, ...values }));
  }

  function updateTitle(lang: NewsLanguage, value: string) {
    if (lang === 'vi') {
      patch({ title_vi: value, ...(!slugTouched.vi ? { slug_vi: normalizeNewsSlug(value) } : {}) });
    } else {
      patch({ title_en: value, ...(!slugTouched.en ? { slug_en: normalizeNewsSlug(value) } : {}) });
    }
  }

  async function uploadFeaturedImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const { width, height } = await readImageDimensions(file);
      const ratio = width / height;
      if (Math.abs(ratio - 4 / 3) > 0.02) {
        throw new Error(`Ảnh đại diện phải có tỷ lệ 4:3. Ảnh hiện tại là ${width}×${height}px.`);
      }
      const uploaded = await adminUploadNewsFeaturedImage(file);
      patch({ featured_image_url: uploaded.publicUrl });
      setMessage(`Đã upload ảnh đại diện ${width}×${height}px vào news-media.`);
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Không upload được ảnh đại diện.');
    } finally {
      setUploading(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (form.status === 'published') {
      const validation = validateForPublish(form);
      if (validation) {
        setError(validation);
        return;
      }
    }

    setSaving(true);
    try {
      const payload: NewsArticleWriteInput = {
        status: form.status,
        title_vi: clean(form.title_vi) || null,
        title_en: clean(form.title_en) || null,
        slug_vi: normalizeNewsSlug(form.slug_vi) || null,
        slug_en: normalizeNewsSlug(form.slug_en) || null,
        excerpt_vi: clean(form.excerpt_vi) || null,
        excerpt_en: clean(form.excerpt_en) || null,
        content_json_vi: newsContentHasMeaningfulContent(form.content_vi) ? form.content_vi : null,
        content_json_en: newsContentHasMeaningfulContent(form.content_en) ? form.content_en : null,
        featured_image_url: clean(form.featured_image_url) || null,
        featured_image_alt_vi: clean(form.featured_image_alt_vi) || null,
        featured_image_alt_en: clean(form.featured_image_alt_en) || null,
        is_featured: form.is_featured,
        published_date: clean(form.published_date) || null,
        author_name: clean(form.author_name) || 'Deals68.com',
        seo_title_vi: clean(form.seo_title_vi) || null,
        seo_title_en: clean(form.seo_title_en) || null,
        seo_description_vi: clean(form.seo_description_vi) || null,
        seo_description_en: clean(form.seo_description_en) || null,
      };

      const article = articleId
        ? await adminUpdateNews(articleId, payload)
        : await adminCreateNews(payload);

      const tags = await adminEnsureNewsTags(parseTags(form.tags));
      await adminSetNewsArticleTags(article.id, tags.map((tag) => tag.id));
      setMessage(form.status === 'published' ? 'Đã lưu và xuất bản bài News.' : 'Đã lưu bản nháp News.');
      onSaved(article.id);
    } catch (saveError: any) {
      setError(saveError?.message || 'Không lưu được bài News.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="d68-admin-news__loading">Đang tải bài News...</div>;

  return (
    <form className="d68-admin-news-editor" onSubmit={save}>
      <div className="d68-admin-news__toolbar">
        <div>
          <h2>{isEditing ? 'Chỉnh sửa tin' : 'Tạo tin mới'}</h2>
          <p>Rich editor lưu structured JSON. Nội dung paste được làm sạch; ảnh nội dung và YouTube chỉ lưu bằng node được kiểm soát.</p>
        </div>
        <div className="d68-admin-actions">
          <button type="button" className="d68-admin-btn light" onClick={onCancel} disabled={saving}>Hủy</button>
          <button type="submit" className="d68-admin-btn blue" disabled={saving || uploading || editorBusy}>{saving ? 'Đang lưu...' : 'Lưu tin'}</button>
        </div>
      </div>

      {message ? <div className="d68-admin-notice ok">{message}</div> : null}
      {error ? <div className="d68-admin-notice err">{error}</div> : null}

      <div className="d68-admin-news-editor__layout">
        <section className="d68-admin-card d68-admin-news-editor__main">
          <div className="d68-admin-news__lang-tabs" role="tablist" aria-label="Ngôn ngữ bài viết">
            {(['vi', 'en'] as NewsLanguage[]).map((item) => (
              <button key={item} type="button" className={language === item ? 'active' : ''} onClick={() => setLanguage(item)}>
                {languageLabel(item)}
              </button>
            ))}
          </div>

          {language === 'en' ? <div className="d68-admin-notice warn">Không tự động dịch VI → EN. Chỉ xuất bản EN khi đủ Title, Slug, Short description và Content.</div> : null}

          {language === 'vi' ? (
            <>
              <label className="d68-admin-field"><span>Tiêu đề *</span><input className="d68-admin-input" value={form.title_vi} onChange={(event) => updateTitle('vi', event.target.value)} maxLength={180} /></label>
              <label className="d68-admin-field"><span>Slug VI *</span><input className="d68-admin-input" value={form.slug_vi} onChange={(event) => { setSlugTouched((value) => ({ ...value, vi: true })); patch({ slug_vi: normalizeNewsSlug(event.target.value) }); }} placeholder="tin-moi-ma" /></label>
              <label className="d68-admin-field"><span>Mô tả ngắn *</span><textarea className="d68-admin-input textarea d68-admin-news__excerpt" value={form.excerpt_vi} onChange={(event) => patch({ excerpt_vi: event.target.value })} maxLength={320} /></label>
              <div className="d68-admin-field"><span>Nội dung *</span><NewsEditor value={form.content_vi} onChange={(content) => patch({ content_vi: content })} onBusyChange={setEditorBusy} onError={setError} ariaLabel="Nội dung tiếng Việt" /></div>
              <label className="d68-admin-field"><span>SEO title VI</span><input className="d68-admin-input" value={form.seo_title_vi} onChange={(event) => patch({ seo_title_vi: event.target.value })} maxLength={180} /></label>
              <label className="d68-admin-field"><span>SEO description VI</span><textarea className="d68-admin-input textarea" value={form.seo_description_vi} onChange={(event) => patch({ seo_description_vi: event.target.value })} maxLength={320} /></label>
            </>
          ) : (
            <>
              <label className="d68-admin-field"><span>Title</span><input className="d68-admin-input" value={form.title_en} onChange={(event) => updateTitle('en', event.target.value)} maxLength={180} /></label>
              <label className="d68-admin-field"><span>Slug EN</span><input className="d68-admin-input" value={form.slug_en} onChange={(event) => { setSlugTouched((value) => ({ ...value, en: true })); patch({ slug_en: normalizeNewsSlug(event.target.value) }); }} placeholder="news-slug" /></label>
              <label className="d68-admin-field"><span>Short description</span><textarea className="d68-admin-input textarea d68-admin-news__excerpt" value={form.excerpt_en} onChange={(event) => patch({ excerpt_en: event.target.value })} maxLength={320} /></label>
              <div className="d68-admin-field"><span>Content</span><NewsEditor value={form.content_en} onChange={(content) => patch({ content_en: content })} onBusyChange={setEditorBusy} onError={setError} ariaLabel="English content" /></div>
              <label className="d68-admin-field"><span>SEO title EN</span><input className="d68-admin-input" value={form.seo_title_en} onChange={(event) => patch({ seo_title_en: event.target.value })} maxLength={180} /></label>
              <label className="d68-admin-field"><span>SEO description EN</span><textarea className="d68-admin-input textarea" value={form.seo_description_en} onChange={(event) => patch({ seo_description_en: event.target.value })} maxLength={320} /></label>
            </>
          )}

          <details className="d68-admin-news__preview">
            <summary>Xem trước nội dung {languageLabel(language)}</summary>
            <NewsContentRenderer content={activeContent} />
          </details>
        </section>

        <aside className="d68-admin-news-editor__side">
          <section className="d68-admin-card">
            <h3>Xuất bản</h3>
            <label className="d68-admin-field"><span>Trạng thái</span><select className="d68-admin-input" value={form.status} onChange={(event) => patch({ status: event.target.value as EditorForm['status'] })}><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option></select></label>
            <label className="d68-admin-field"><span>Ngày đăng</span><input className="d68-admin-input" type="date" value={form.published_date} onChange={(event) => patch({ published_date: event.target.value })} /></label>
            <label className="d68-admin-field"><span>Tác giả</span><input className="d68-admin-input" value={form.author_name} onChange={(event) => patch({ author_name: event.target.value })} /></label>
            <label className="d68-admin-check"><input type="checkbox" checked={form.is_featured} onChange={(event) => patch({ is_featured: event.target.checked })} /> Tin nổi bật</label>
          </section>

          <section className="d68-admin-card">
            <h3>Ảnh đại diện 4:3</h3>
            {form.featured_image_url ? <img className="d68-admin-news__featured-preview" src={form.featured_image_url} alt="Preview" /> : <div className="d68-admin-news__featured-empty">Khuyến nghị 1200 × 900 px</div>}
            <label className="d68-admin-btn light d68-admin-news__file-button">{uploading ? 'Đang upload...' : 'Chọn ảnh 4:3'}<input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => void uploadFeaturedImage(event)} /></label>
            <label className="d68-admin-field"><span>Alt ảnh VI</span><input className="d68-admin-input" value={form.featured_image_alt_vi} onChange={(event) => patch({ featured_image_alt_vi: event.target.value })} /></label>
            <label className="d68-admin-field"><span>Alt ảnh EN</span><input className="d68-admin-input" value={form.featured_image_alt_en} onChange={(event) => patch({ featured_image_alt_en: event.target.value })} /></label>
          </section>

          <section className="d68-admin-card">
            <h3>Tags</h3>
            <label className="d68-admin-field"><span>Nhiều tags, cách nhau dấu phẩy hoặc xuống dòng</span><textarea className="d68-admin-input textarea" value={form.tags} onChange={(event) => patch({ tags: event.target.value })} placeholder={'M&A | M&A, Gọi vốn | Fundraising'} /></label>
            <p className="d68-admin-subtle">{tagCount} tag · Cú pháp song ngữ: VI | EN.</p>
          </section>
        </aside>
      </div>
    </form>
  );
}
