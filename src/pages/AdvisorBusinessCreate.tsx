import { useMemo, useState, type FormEvent } from 'react';
import {
  createAdvisorBusinessIntake,
  createAdvisorIntakeKey,
  type AdvisorBusinessIntakeResult,
} from '../lib/advisorAuth';
import type { Lang } from '../lib/i18n';
import '../styles/pages/advisor-business-intake.css';

const T = (lang: Lang, vi: string, en: string) => lang === 'en' ? en : vi;

type FormState = {
  companyName: string;
  title: string;
  description: string;
  countryIso2: string;
  city: string;
  industry: string;
  dealType: string;
  declaredOwnerName: string;
  declaredPrincipalName: string;
  declaredAssetAddress: string;
  authorityConfirmed: boolean;
};

const initialState: FormState = {
  companyName: '',
  title: '',
  description: '',
  countryIso2: 'VN',
  city: '',
  industry: '',
  dealType: '',
  declaredOwnerName: '',
  declaredPrincipalName: '',
  declaredAssetAddress: '',
  authorityConfirmed: false,
};

export default function AdvisorBusinessCreate({
  lang,
  advisorName,
  onCreated,
}: {
  lang: Lang;
  advisorName?: string;
  onCreated: (result: AdvisorBusinessIntakeResult) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AdvisorBusinessIntakeResult | null>(null);

  const valid = useMemo(() => (
    form.companyName.trim().length >= 2
    && form.title.trim().length >= 2
    && form.description.trim().length >= 20
    && /^[A-Za-z]{2}$/.test(form.countryIso2.trim())
    && form.industry.trim().length >= 2
    && form.dealType.trim().length >= 2
    && form.declaredOwnerName.trim().length >= 2
    && form.authorityConfirmed
  ), [form]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const intakeKey = createAdvisorIntakeKey();
      const created = await createAdvisorBusinessIntake({
        intakeKey,
        business: {
          company_name: form.companyName.trim(),
          title_vi: lang === 'vi' ? form.title.trim() : '',
          title_en: lang === 'en' ? form.title.trim() : '',
          description_vi: lang === 'vi' ? form.description.trim() : '',
          description_en: lang === 'en' ? form.description.trim() : '',
          country_iso2: form.countryIso2.trim().toUpperCase(),
          city: form.city.trim(),
          industry: form.industry.trim(),
          deal_type: form.dealType.trim(),
        },
        authority: {
          declared_owner_name: form.declaredOwnerName.trim(),
          declared_principal_name: form.declaredPrincipalName.trim(),
          declared_agent_name: advisorName?.trim() || undefined,
          declared_asset_name: form.companyName.trim(),
          declared_asset_address: form.declaredAssetAddress.trim(),
        },
      });
      setResult(created);
      setForm(initialState);
      await onCreated(created);
    } catch (cause: any) {
      setError(cause?.message || T(lang, 'Không thể gửi hồ sơ doanh nghiệp.', 'Could not submit Business intake.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="d68-advisor-intake">
      <div className="d68-advisor-intake-heading">
        <div>
          <span>{T(lang, 'Phiên 4 · Business intake', 'Session 4 · Business intake')}</span>
          <h2>{T(lang, 'Tạo hồ sơ doanh nghiệp mới để Admin thẩm định', 'Submit a new Business for Admin review')}</h2>
          <p>{T(
            lang,
            'Hệ thống tạo một Business draft, authority chờ xác minh và assignment chờ kích hoạt trong cùng một giao dịch. Hồ sơ không được công khai và chưa phát sinh quyền chỉnh sửa.',
            'The system atomically creates a Business draft, pending authority and pending assignment. Nothing is published and no edit access is granted.',
          )}</p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)}>
          {open ? T(lang, 'Đóng biểu mẫu', 'Close form') : T(lang, 'Tạo Business mới', 'Create new Business')}
        </button>
      </div>

      {result ? (
        <div className="d68-advisor-intake-success">
          <b>{T(lang, 'Đã gửi hồ sơ nguyên tử thành công.', 'Atomic intake submitted successfully.')}</b>
          <span>{T(
            lang,
            'Business đang ở trạng thái draft; authority và assignment chờ Admin xác minh. Bạn chưa thể mở hoặc chỉnh sửa Business.',
            'The Business is a draft; authority and assignment await Admin verification. You cannot open or edit it yet.',
          )}</span>
          <code>{result.business_id}</code>
        </div>
      ) : null}

      {open ? (
        <form className="d68-advisor-intake-form" onSubmit={submit}>
          <div className="d68-advisor-intake-warning">
            <b>{T(lang, 'Không tạo quyền sở hữu', 'No ownership is created')}</b>
            <span>{T(
              lang,
              'Chỉ gửi hồ sơ khi bạn có sự đồng ý hoặc ủy quyền phù hợp từ chủ doanh nghiệp/chủ tài sản. Admin phải xác minh trước khi assignment có hiệu lực.',
              'Submit only with appropriate consent or authority from the Business/asset owner. Admin verification is required before the assignment can become effective.',
            )}</span>
          </div>

          <label>
            <span>{T(lang, 'Tên pháp lý / Tên doanh nghiệp', 'Legal / Business name')} *</span>
            <input value={form.companyName} onChange={(e) => patch('companyName', e.target.value)} maxLength={220} required />
          </label>
          <label>
            <span>{T(lang, 'Tiêu đề thương vụ', 'Deal title')} *</span>
            <input value={form.title} onChange={(e) => patch('title', e.target.value)} maxLength={240} required />
            <small>{T(lang, 'Chỉ lưu vào trường ngôn ngữ hiện tại; không tự dịch.', 'Stored only in the current language field; no automatic translation.')}</small>
          </label>
          <label className="wide">
            <span>{T(lang, 'Mô tả ngắn', 'Short description')} *</span>
            <textarea value={form.description} onChange={(e) => patch('description', e.target.value)} maxLength={5000} rows={5} required />
          </label>

          <div className="d68-advisor-intake-grid">
            <label>
              <span>{T(lang, 'Mã quốc gia ISO-2', 'Country ISO-2')} *</span>
              <input value={form.countryIso2} onChange={(e) => patch('countryIso2', e.target.value.toUpperCase().slice(0, 2))} maxLength={2} required />
            </label>
            <label>
              <span>{T(lang, 'Tỉnh / Thành phố', 'City / Province')}</span>
              <input value={form.city} onChange={(e) => patch('city', e.target.value)} maxLength={160} />
            </label>
            <label>
              <span>{T(lang, 'Ngành', 'Industry')} *</span>
              <input value={form.industry} onChange={(e) => patch('industry', e.target.value)} maxLength={180} required />
            </label>
            <label>
              <span>{T(lang, 'Loại giao dịch', 'Deal type')} *</span>
              <input value={form.dealType} onChange={(e) => patch('dealType', e.target.value)} maxLength={120} placeholder={T(lang, 'Ví dụ: Gọi vốn, M&A, Chuyển nhượng', 'Example: Fundraising, M&A, Sale')} required />
            </label>
          </div>

          <h3>{T(lang, 'Khai báo authority', 'Authority declaration')}</h3>
          <div className="d68-advisor-intake-grid">
            <label>
              <span>{T(lang, 'Chủ doanh nghiệp / Chủ tài sản', 'Business / Asset owner')} *</span>
              <input value={form.declaredOwnerName} onChange={(e) => patch('declaredOwnerName', e.target.value)} maxLength={220} required />
            </label>
            <label>
              <span>{T(lang, 'Bên ủy quyền / Principal', 'Authorizing principal')}</span>
              <input value={form.declaredPrincipalName} onChange={(e) => patch('declaredPrincipalName', e.target.value)} maxLength={220} />
            </label>
            <label className="wide">
              <span>{T(lang, 'Địa chỉ tài sản / doanh nghiệp', 'Business / Asset address')}</span>
              <input value={form.declaredAssetAddress} onChange={(e) => patch('declaredAssetAddress', e.target.value)} maxLength={500} />
            </label>
          </div>

          <label className="d68-advisor-intake-confirm">
            <input
              type="checkbox"
              checked={form.authorityConfirmed}
              onChange={(e) => patch('authorityConfirmed', e.target.checked)}
            />
            <span>{T(
              lang,
              'Tôi xác nhận thông tin khai báo là đúng và hiểu rằng hồ sơ chỉ được kích hoạt sau khi Admin xác minh authority.',
              'I confirm the declaration is accurate and understand that activation requires Admin authority verification.',
            )}</span>
          </label>

          {error ? <div className="d68-auth-error">⚠ {error}</div> : null}
          <button className="d68-advisor-intake-submit" type="submit" disabled={!valid || submitting}>
            {submitting ? T(lang, 'Đang tạo hồ sơ...', 'Creating intake...') : T(lang, 'Gửi hồ sơ chờ thẩm định', 'Submit for review')}
          </button>
        </form>
      ) : null}
    </section>
  );
}
