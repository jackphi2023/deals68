import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  IndustryTagPicker,
  InvestorDealTypeTagPicker,
  normalizeIndustryKeys,
} from '../investor/IndustryTagPicker';
import {
  InvestorMarketTagPicker,
  InvestorStageTagPicker,
  InvestorTypeTagPicker,
} from '../investor/InvestorCriteriaTagPickers';
import {
  approvedInvestorCountries,
  approvedInvestorDealTypes,
  approvedInvestorSectors,
  approvedInvestorStages,
  approvedInvestorTypes,
  normalizeInvestorCountries,
  normalizeInvestorDealTypes,
  normalizeInvestorStages,
  normalizeInvestorTypes,
} from '../../lib/investorCriteria';
import {
  countryOptions,
  labelCountry,
  labelDealType,
  labelInvestorType,
  labelStage,
} from '../../lib/labels';
import { labelIndustryTaxonomy } from '../../lib/industryTaxonomy';
import {
  formatInitialNumber,
  formatNumberTyping,
  parseFormattedNumber,
} from '../../lib/numberFormat';
import {
  INVESTOR_COVER_FALLBACK,
  uploadInvestorCoverImage,
} from '../../lib/banners';

type Row = Record<string, any>;

type Props = {
  investors: Row[];
  profiles: Row[];
  payments?: Row[];
  search?: string;
  reviewFilter: string;
  visibilityFilter: string;
  officeCountryFilter: string;
  targetCountryFilter: string;
  industryFilter: string;
  typeFilter: string;
  page: number;
  pageSize?: number;
  officeCountryLabel?: string;
  renderPagination?: (
    page: number,
    pageCount: number,
    onPage: (value: number) => void,
  ) => ReactNode;
  onReviewFilterChange: (value: string) => void;
  onVisibilityFilterChange: (value: string) => void;
  onOfficeCountryFilterChange: (value: string) => void;
  onTargetCountryFilterChange: (value: string) => void;
  onIndustryFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onPageChange: (value: number) => void;
  onReload: () => void | Promise<void>;
  setMessage: (value: string) => void;
  setError: (value: string) => void;
};

const PAGE_SIZE = 30;

function objectOf(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function arrayOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pendingOf(investor: Row) {
  return objectOf(investor?.privacy?.pending_profile_changes);
}

function pendingCriteriaOf(investor: Row) {
  return objectOf(pendingOf(investor).criteria);
}

function reviewReasons(investor: Row) {
  const pending = pendingOf(investor);
  const pendingCriteria = objectOf(pending.criteria);
  const status = String(investor.status || '').toLowerCase();
  const newAccount = ['draft', 'payment_pending', 'pending_admin_review'].includes(status);
  const introUpdated = Object.prototype.hasOwnProperty.call(pending, 'desc_vi') ||
    Object.prototype.hasOwnProperty.call(pending, 'desc_en');
  const appetiteUpdated = Object.prototype.hasOwnProperty.call(
    pendingCriteria,
    'investment_appetite_vi',
  ) || Object.prototype.hasOwnProperty.call(
    pendingCriteria,
    'investment_appetite_en',
  );

  return {
    newAccount,
    introUpdated,
    appetiteUpdated,
    any: newAccount || introUpdated || appetiteUpdated,
  };
}

function paymentFor(investor: Row, payments: Row[]) {
  return payments
    .filter((payment) =>
      String(payment.investor_id || '') === String(investor.id || '') ||
      String(payment.profile_id || '') === String(investor.owner_id || ''),
    )
    .sort((left, right) =>
      String(right.created_at || '').localeCompare(String(left.created_at || '')),
    )[0] || null;
}

function loginProfileFor(investor: Row, profiles: Row[]) {
  return profiles.find((profile) =>
    String(profile.id || '') === String(investor.owner_id || '') ||
    String(profile.username || '') === String(investor.username || '') ||
    String(profile.email || '') === String(investor.private_email || ''),
  ) || {};
}

function NumberInput({ name, value, placeholder }: { name: string; value: unknown; placeholder: string }) {
  const [display, setDisplay] = useState(() => formatInitialNumber(value));
  return (
    <input
      name={name}
      className="d68-admin-input"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={(event) => setDisplay(formatNumberTyping(event.target.value))}
    />
  );
}

function Comparison({ label, approved, pending }: { label: string; approved: unknown; pending: unknown }) {
  const approvedText = Array.isArray(approved) ? approved.join(', ') : String(approved ?? '');
  const pendingText = Array.isArray(pending) ? pending.join(', ') : String(pending ?? '');
  const changed = pending !== undefined && JSON.stringify(approved) !== JSON.stringify(pending);
  return (
    <div className={`d68-admin-investor-comparison${changed ? ' changed' : ''}`}>
      <b>{label}</b>
      <div><span>Đang public</span><p>{approvedText || '—'}</p></div>
      <div><span>Investor đề xuất</span><p>{pending === undefined ? 'Không thay đổi' : pendingText || 'Để trống'}</p></div>
    </div>
  );
}

function InvestorReviewEditor({
  investor,
  profiles,
  payments,
  onReload,
  setMessage,
  setError,
}: {
  investor: Row;
  profiles: Row[];
  payments: Row[];
  onReload: () => void | Promise<void>;
  setMessage: (value: string) => void;
  setError: (value: string) => void;
}) {
  const pending = pendingOf(investor);
  const pendingCriteria = pendingCriteriaOf(investor);
  const approvedCriteria = objectOf(investor.criteria);
  const reasons = reviewReasons(investor);
  const profile = loginProfileFor(investor, profiles);
  const payment = paymentFor(investor, payments);

  const approvedTypes = approvedInvestorTypes(investor);
  const approvedStages = approvedInvestorStages(investor);
  const approvedIndustries = approvedInvestorSectors(investor);
  const approvedDeals = approvedInvestorDealTypes(investor);
  const approvedCountries = approvedInvestorCountries(investor);

  const reviewTypes = normalizeInvestorTypes(
    pendingCriteria.investorTypes || pending.investor_types || approvedTypes,
  );
  const reviewStages = normalizeInvestorStages(
    pendingCriteria.stages || pending.stages || approvedStages,
  );
  const reviewIndustries = normalizeIndustryKeys(
    pending.industries || pendingCriteria.sectors || approvedIndustries,
  );
  const reviewDeals = normalizeInvestorDealTypes(
    pending.deal_types || pendingCriteria.dealTypes || approvedDeals,
  );
  const reviewCountries = normalizeInvestorCountries(
    pendingCriteria.targetCountries || approvedCountries,
  );

  const reviewDescVi = pending.desc_vi ?? investor.desc_vi ?? '';
  const reviewDescEn = pending.desc_en ?? investor.desc_en ?? '';
  const reviewAppetiteVi =
    pendingCriteria.investment_appetite_vi ??
    approvedCriteria.investment_appetite_vi ??
    approvedCriteria.investmentAppetiteVi ??
    '';
  const reviewAppetiteEn =
    pendingCriteria.investment_appetite_en ??
    approvedCriteria.investment_appetite_en ??
    approvedCriteria.investmentAppetiteEn ??
    '';
  const reviewRiskAppetite =
    pendingCriteria.riskAppetite ?? approvedCriteria.riskAppetite ?? '';
  const reviewReturnExpectation = Object.prototype.hasOwnProperty.call(
    pendingCriteria,
    'returnExpectation',
  )
    ? pendingCriteria.returnExpectation ?? ''
    : approvedCriteria.returnExpectation ?? '';
  const approvedCoverUrl = String(
    approvedCriteria.cover_image_url ||
      approvedCriteria.coverImageUrl ||
      investor.cover_image_url ||
      investor.hero_image_url ||
      '',
  ).trim();
  const approvedCoverPath = String(
    approvedCriteria.cover_image_path || '',
  ).trim();
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(approvedCoverUrl);
  const [removeCover, setRemoveCover] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    setCoverFile(null);
    setCoverPreviewUrl(approvedCoverUrl);
    setRemoveCover(false);
  }, [approvedCoverUrl, investor.id]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  function selectCover(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Cover chỉ hỗ trợ JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Ảnh cover phải nhỏ hơn hoặc bằng 10 MB.');
      return;
    }

    setError('');
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
    setRemoveCover(false);
  }

  async function saveInvestor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    const form = new FormData(event.currentTarget);
    const approveIntroduction = submitter?.value === 'approve_introduction';
    const investorTypes = normalizeInvestorTypes(arrayOf(form.get('investor_types')));
    const stages = normalizeInvestorStages(arrayOf(form.get('stages')));
    const industries = normalizeIndustryKeys(arrayOf(form.get('industries')));
    const dealTypes = normalizeInvestorDealTypes(arrayOf(form.get('deal_types')));
    const targetCountries = normalizeInvestorCountries(arrayOf(form.get('target_countries')));
    const visible = form.get('visible') === 'on';

    if (!investorTypes.length || !stages.length || !industries.length || !dealTypes.length || !targetCountries.length) {
      setError('Cần chọn ít nhất một Loại hình, Giai đoạn, Ngành, Loại giao dịch và Thị trường.');
      return;
    }

    setApproving(true);
    setError('');

    let coverImageUrl = removeCover ? '' : approvedCoverUrl;
    let coverImagePath = removeCover ? '' : approvedCoverPath;
    try {
      if (coverFile) {
        const uploaded = await uploadInvestorCoverImage(
          coverFile,
          String(investor.id),
        );
        coverImageUrl = uploaded.publicUrl;
        coverImagePath = uploaded.path;
      }
    } catch (uploadError: any) {
      setApproving(false);
      setError(uploadError?.message || 'Không upload được cover Investor.');
      return;
    }

    const adminPatch = {
      title_vi: String(form.get('title_vi') || '').trim(),
      title_en: String(form.get('title_en') || '').trim(),
      desc_vi: String(form.get('desc_vi') || '').trim(),
      desc_en: String(form.get('desc_en') || '').trim(),
      country_iso2: String(form.get('country_iso2') || 'VN').toUpperCase(),
      country: String(form.get('country') || '').trim(),
      region: String(form.get('region') || '').trim(),
      investor_types: investorTypes,
      type: investorTypes[0],
      stages,
      stage: stages[0],
      industries,
      deal_types: dealTypes,
      target_countries: targetCountries,
      ticket_min: parseFormattedNumber(form.get('ticket_min')),
      ticket_max: parseFormattedNumber(form.get('ticket_max')),
      criteria: {
        ...approvedCriteria,
        ...pendingCriteria,
        investorTypes,
        stages,
        sectors: industries,
        dealTypes,
        targetCountries,
        preferredCountries: targetCountries,
        targetCountriesCache: targetCountries,
        investment_appetite_vi: String(form.get('investment_appetite_vi') || '').trim(),
        investment_appetite_en: String(form.get('investment_appetite_en') || '').trim(),
        riskAppetite: String(form.get('riskAppetite') || ''),
        returnExpectation: String(form.get('returnExpectation') || '').trim()
          ? Number(form.get('returnExpectation'))
          : null,
        revenueRange: String(form.get('revenueRange') || ''),
        revenueBand: String(form.get('revenueRange') || ''),
        cover_image_url: coverImageUrl,
        cover_image_path: coverImagePath,
      },
      verified: form.get('verified') === 'on',
      admin_priority: form.get('admin_priority') === 'on',
      visible,
      status: visible ? 'active' : 'hidden',
      private_name: String(form.get('private_name') || '').trim(),
      private_email: String(form.get('private_email') || '').trim(),
      private_phone: String(form.get('private_phone') || '').trim(),
      private_website: String(form.get('private_website') || '').trim(),
    };

    const { data, error } = await supabase.rpc('admin_update_investor_profile', {
      investor_uuid: investor.id,
      admin_patch: adminPatch,
      approve_introduction: approveIntroduction,
    });
    if (error) {
      setApproving(false);
      setError(error.message);
      return;
    }
    setApproving(false);
    setError('');
    setMessage(
      approveIntroduction
        ? 'Đã lưu và duyệt Giới thiệu cùng Khẩu vị đầu tư VN/EN.'
        : `Đã lưu hồ sơ và duyệt Khẩu vị đầu tư VN/EN${data?.visible ? '' : '; hồ sơ vẫn đang ẩn'}.`,
    );
    await onReload();
  }

  async function toggleVisible() {
    const visible = !investor.visible;
    const { error } = await supabase
      .from('investors')
      .update({ visible, status: visible ? 'active' : 'hidden' })
      .eq('id', investor.id);
    if (error) {
      setError(error.message);
      return;
    }
    setError('');
    setMessage(visible ? 'Đã bật hiển thị Investor.' : 'Đã ẩn Investor.');
    await onReload();
  }

  return (
    <article className="d68-admin-card d68-admin-investor-review-card">
      <div className="d68-admin-row-head">
        <div>
          <b>{investor.code} · {investor.private_name || investor.title_vi || investor.title_en || 'Investor'}</b>
          <div className="d68-admin-subtle">
            {investor.status} · {investor.visible ? 'visible' : 'not public'} · Trụ sở: {labelCountry(investor.country_iso2 || investor.country, 'vi')}
          </div>
        </div>
        <span className={`d68-admin-badge ${investor.visible ? 'ok' : 'warn'}`}>{investor.visible ? 'Hiển thị' : 'Ẩn'}</span>
        {reasons.any ? <span className="d68-admin-badge warn">Cần duyệt</span> : null}
      </div>

      {reasons.any ? (
        <div className="d68-admin-notice warn">
          {[
            reasons.newAccount ? 'Tài khoản mới' : '',
            reasons.introUpdated ? 'Giới thiệu vừa sửa, cần duyệt' : '',
            reasons.appetiteUpdated ? 'Khẩu vị đầu tư vừa sửa, cần duyệt' : '',
          ].filter(Boolean).join(' · ')}
        </div>
      ) : null}

      <div className="d68-admin-investor-summary-grid">
        <div><b>Tài khoản đăng nhập</b><span>{profile.username || investor.username || '—'}</span><span>{profile.email || investor.private_email || '—'}</span><span>Mật khẩu: Quản lý bằng Supabase Auth · không lưu trong database</span></div>
        <div><b>Gói dịch vụ gần nhất</b><span>{payment?.title || payment?.price?.planLabel || 'Chưa có đơn'}</span><span>{payment?.status || '—'} {payment?.created_at ? `· ${new Date(payment.created_at).toLocaleDateString('vi-VN')}` : ''}</span></div>
        <div><b>Ticket size</b><span>{Number(investor.ticket_min || 0).toLocaleString('en-US')} – {Number(investor.ticket_max || 0).toLocaleString('en-US')} USD</span><span>{investor.membership_expires_at ? `Hết hạn ${new Date(investor.membership_expires_at).toLocaleDateString('vi-VN')}` : 'Chưa có ngày hết hạn'}</span></div>
      </div>

      {reasons.any ? (
        <div className="d68-admin-investor-comparison-grid">
          <Comparison label="Giới thiệu (VN)" approved={investor.desc_vi} pending={pending.desc_vi} />
          <Comparison label="Giới thiệu (EN)" approved={investor.desc_en} pending={pending.desc_en} />
          <Comparison label="Khẩu vị đầu tư (VN)" approved={approvedCriteria.investment_appetite_vi ?? approvedCriteria.investmentAppetiteVi} pending={pendingCriteria.investment_appetite_vi} />
          <Comparison label="Khẩu vị đầu tư (EN)" approved={approvedCriteria.investment_appetite_en ?? approvedCriteria.investmentAppetiteEn} pending={pendingCriteria.investment_appetite_en} />
        </div>
      ) : null}

      <form onSubmit={saveInvestor} className="d68-admin-investor-review-form">
        <div className="d68-admin-form4">
          <label className="d68-admin-field"><span>Tên hiển thị công khai (VN)</span><input name="title_vi" className="d68-admin-input" defaultValue={investor.title_vi || ''} /></label>
          <label className="d68-admin-field"><span>Tên hiển thị công khai (EN)</span><input name="title_en" className="d68-admin-input" defaultValue={investor.title_en || ''} /></label>
          <label className="d68-admin-field"><span>Quốc gia trụ sở</span><select name="country_iso2" className="d68-admin-input" defaultValue={pending.country_iso2 || investor.country_iso2 || 'VN'}>{countryOptions.map((item) => <option key={item.iso2} value={item.iso2}>{item.vi}</option>)}</select></label>
          <label className="d68-admin-field"><span>Tên quốc gia lưu DB</span><input name="country" className="d68-admin-input" defaultValue={pending.country || investor.country || ''} /></label>
          <label className="d68-admin-field"><span>Khu vực</span><input name="region" className="d68-admin-input" defaultValue={pending.region || investor.region || ''} /></label>
          <label className="d68-admin-field"><span>Ticket tối thiểu</span><NumberInput name="ticket_min" value={pending.ticket_min ?? investor.ticket_min} placeholder="Ticket min" /></label>
          <label className="d68-admin-field"><span>Ticket tối đa</span><NumberInput name="ticket_max" value={pending.ticket_max ?? investor.ticket_max} placeholder="Ticket max" /></label>
          <label className="d68-admin-check"><input name="verified" type="checkbox" defaultChecked={!!investor.verified} /> Verified</label>
          <label className="d68-admin-check"><input name="admin_priority" type="checkbox" defaultChecked={!!investor.admin_priority} /> Ưu tiên Homepage</label>
          <label className="d68-admin-check"><input name="visible" type="checkbox" defaultChecked={!!investor.visible} /> Hiển thị public</label>
        </div>

        <div className="d68-admin-field"><span>Loại hình nhà đầu tư</span><InvestorTypeTagPicker lang="vi" values={reviewTypes} name="investor_types" /></div>
        <div className="d68-admin-field"><span>Giai đoạn đầu tư</span><InvestorStageTagPicker lang="vi" values={reviewStages} name="stages" /></div>
        <div className="d68-admin-field"><span>Ngành quan tâm</span><IndustryTagPicker lang="vi" values={reviewIndustries} name="industries" expandVi="Mở rộng" expandEn="Expand" /></div>
        <div className="d68-admin-field"><span>Loại giao dịch quan tâm</span><InvestorDealTypeTagPicker lang="vi" values={reviewDeals} name="deal_types" /></div>
        <div className="d68-admin-field"><span>Thị trường quan tâm</span><InvestorMarketTagPicker lang="vi" values={reviewCountries} name="target_countries" /></div>

        <div className="d68-admin-investor-cover-editor">
          <div className="d68-admin-investor-cover-preview">
            <img
              src={removeCover ? INVESTOR_COVER_FALLBACK : coverPreviewUrl || INVESTOR_COVER_FALLBACK}
              alt={`Cover ${investor.code || 'Investor'}`}
            />
          </div>
          <div className="d68-admin-investor-cover-controls">
            <b>Ảnh cover riêng của Nhà đầu tư</b>
            <span>JPG, PNG hoặc WebP · tối đa 10 MB. Cover riêng đã duyệt luôn ưu tiên hơn cover mặc định chung.</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => selectCover(event.target.files?.[0])}
            />
            {approvedCoverUrl || coverFile ? (
              <button
                type="button"
                className="d68-admin-btn light"
                onClick={() => {
                  setCoverFile(null);
                  setCoverPreviewUrl('');
                  setRemoveCover(true);
                }}
              >
                Dùng lại cover mặc định chung
              </button>
            ) : null}
          </div>
        </div>

        <div className="d68-admin-form4">
          <label className="d68-admin-field d68-admin-span2"><span>Giới thiệu (VN)</span><textarea name="desc_vi" className="d68-admin-input textarea" defaultValue={reviewDescVi} /></label>
          <label className="d68-admin-field d68-admin-span2"><span>Giới thiệu (EN)</span><textarea name="desc_en" className="d68-admin-input textarea" defaultValue={reviewDescEn} /></label>
          <label className="d68-admin-field d68-admin-span2"><span>Khẩu vị đầu tư (VN)</span><textarea name="investment_appetite_vi" className="d68-admin-input textarea" defaultValue={reviewAppetiteVi} /></label>
          <label className="d68-admin-field d68-admin-span2"><span>Khẩu vị đầu tư (EN)</span><textarea name="investment_appetite_en" className="d68-admin-input textarea" defaultValue={reviewAppetiteEn} /></label>
          <label className="d68-admin-field"><span>Khẩu vị rủi ro</span><select name="riskAppetite" className="d68-admin-input" defaultValue={reviewRiskAppetite}><option value="">Chưa chọn</option><option value="conservative">Thận trọng</option><option value="balanced">Cân bằng</option><option value="aggressive">Ưu tiên tăng trưởng</option></select></label>
          <label className="d68-admin-field"><span>Kỳ vọng lợi nhuận (%)</span><input name="returnExpectation" type="number" min="0" step="0.1" className="d68-admin-input" defaultValue={reviewReturnExpectation} /></label>
          <label className="d68-admin-field"><span>Quy mô doanh thu mục tiêu</span><select name="revenueRange" className="d68-admin-input" defaultValue={pendingCriteria.revenueRange || pendingCriteria.revenueBand || approvedCriteria.revenueRange || approvedCriteria.revenueBand || ''}><option value="">Bất kỳ</option><option value="under_1m">Dưới 1 triệu USD</option><option value="1_10m">1–10 triệu USD</option><option value="10_100m">10–100 triệu USD</option><option value="over_100m">Trên 100 triệu USD</option></select></label>
        </div>

        <div className="d68-admin-form4 d68-admin-investor-private-form">
          <label className="d68-admin-field"><span>Tên nội bộ</span><input name="private_name" className="d68-admin-input" defaultValue={investor.private_name || ''} /></label>
          <label className="d68-admin-field"><span>Email nội bộ</span><input name="private_email" className="d68-admin-input" defaultValue={investor.private_email || investor.privacy?.email || ''} /></label>
          <label className="d68-admin-field"><span>Điện thoại nội bộ</span><input name="private_phone" className="d68-admin-input" defaultValue={investor.private_phone || investor.privacy?.phone || ''} /></label>
          <label className="d68-admin-field"><span>Website nội bộ</span><input name="private_website" className="d68-admin-input" defaultValue={investor.private_website || investor.privacy?.website || ''} /></label>
        </div>

        <div className="d68-admin-actions">
          <button name="action" value="save" className="d68-admin-btn green" disabled={approving}>{approving ? 'Đang lưu…' : 'Lưu & duyệt Khẩu vị đầu tư'}</button>
          <button name="action" value="approve_introduction" className="d68-admin-btn gold" disabled={approving}>{approving ? 'Đang lưu…' : 'Lưu & duyệt Giới thiệu + Khẩu vị'}</button>
          <button type="button" onClick={toggleVisible} className={`d68-admin-btn ${investor.visible ? 'red' : 'blue'}`}>{investor.visible ? 'Ẩn public' : 'Bật visible'}</button>
          {investor.code ? <Link to={`/investors/${investor.code}`} target="_blank" className="d68-admin-btn blue">Xem public ↗</Link> : null}
        </div>
      </form>
    </article>
  );
}

export default function InvestorAdminReviewPanel({
  investors,
  profiles,
  payments = [],
  search = '',
  reviewFilter,
  visibilityFilter,
  officeCountryFilter,
  targetCountryFilter,
  industryFilter,
  typeFilter,
  page,
  pageSize = PAGE_SIZE,
  officeCountryLabel = 'Quốc gia trụ sở',
  renderPagination,
  onReviewFilterChange,
  onVisibilityFilterChange,
  onOfficeCountryFilterChange,
  onTargetCountryFilterChange,
  onIndustryFilterChange,
  onTypeFilterChange,
  onPageChange,
  onReload,
  setMessage,
  setError,
}: Props) {
  const [stageFilter, setStageFilter] = useState('');
  const [dealFilter, setDealFilter] = useState('');

  const queueStats = useMemo(() => {
    const result = { total: 0, newAccount: 0, intro: 0, appetite: 0 };
    investors.forEach((investor) => {
      const reasons = reviewReasons(investor);
      if (reasons.any) result.total += 1;
      if (reasons.newAccount) result.newAccount += 1;
      if (reasons.introUpdated) result.intro += 1;
      if (reasons.appetiteUpdated) result.appetite += 1;
    });
    return result;
  }, [investors]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return investors
      .filter((investor) => {
        const reasons = reviewReasons(investor);
        if (reviewFilter === 'pending' && !reasons.any) return false;
        if (reviewFilter === 'new' && !reasons.newAccount) return false;
        if (reviewFilter === 'intro' && !reasons.introUpdated && !reasons.appetiteUpdated) return false;
        if (visibilityFilter === 'visible' && !investor.visible) return false;
        if (visibilityFilter === 'hidden' && investor.visible) return false;
        if (officeCountryFilter && String(investor.country_iso2 || '').toUpperCase() !== officeCountryFilter) return false;
        if (targetCountryFilter && !approvedInvestorCountries(investor).includes(targetCountryFilter)) return false;
        if (industryFilter && !approvedInvestorSectors(investor).includes(industryFilter)) return false;
        if (typeFilter && !approvedInvestorTypes(investor).includes(typeFilter as any)) return false;
        if (stageFilter && !approvedInvestorStages(investor).includes(stageFilter as any)) return false;
        if (dealFilter && !approvedInvestorDealTypes(investor).includes(dealFilter)) return false;
        if (keyword) {
          const haystack = [investor.code, investor.private_name, investor.title_vi, investor.title_en, investor.private_email, investor.country, investor.country_iso2]
            .map((value) => String(value || '').toLowerCase())
            .join(' ');
          if (!haystack.includes(keyword)) return false;
        }
        return true;
      })
      .sort((left, right) => {
        const leftPending = reviewReasons(left).any ? 1 : 0;
        const rightPending = reviewReasons(right).any ? 1 : 0;
        if (leftPending !== rightPending) return rightPending - leftPending;
        return String(right.created_at || right.updated_at || '').localeCompare(String(left.created_at || left.updated_at || ''));
      });
  }, [investors, search, reviewFilter, visibilityFilter, officeCountryFilter, targetCountryFilter, industryFilter, typeFilter, stageFilter, dealFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const officeCountries = unique(investors.map((item) => String(item.country_iso2 || '').toUpperCase()).filter(Boolean));
  const targetCountries = unique(investors.flatMap(approvedInvestorCountries));
  const industries = unique(investors.flatMap(approvedInvestorSectors));
  const types = unique(investors.flatMap(approvedInvestorTypes));
  const stages = unique(investors.flatMap(approvedInvestorStages));
  const deals = unique(investors.flatMap(approvedInvestorDealTypes));

  function resetPage() {
    onPageChange(1);
  }

  return (
    <>
      <div className="d68-admin-card">
        <div className="d68-admin-row-head">
          <div>
            <h3>Quản trị Nhà đầu tư</h3>
            <div className="d68-admin-subtle">Hiển thị {rows.length}/{filtered.length} kết quả · {pageSize}/trang · Giữ nguyên Admin shell MAIN</div>
          </div>
          {queueStats.total ? <span className="d68-admin-badge warn">⚠️ {queueStats.total} cần duyệt</span> : <span className="d68-admin-badge ok">Không có hồ sơ cần duyệt</span>}
        </div>

        {queueStats.total ? (
          <div className="d68-admin-notice warn">
            Có {queueStats.total} Investor cần kiểm tra: {queueStats.newAccount} tài khoản mới · {queueStats.intro} Giới thiệu sửa · {queueStats.appetite} Khẩu vị đầu tư sửa. Các tiêu chí khác được lưu ngay.
          </div>
        ) : null}

        <div className="d68-admin-investor-filter-grid">
          <label>Hàng chờ<select value={reviewFilter} onChange={(event) => onReviewFilterChange(event.target.value)} className="d68-admin-input"><option value="">Tất cả hồ sơ</option><option value="pending">Tất cả cần duyệt</option><option value="new">Tài khoản mới</option><option value="intro">Giới thiệu / Khẩu vị vừa sửa</option></select></label>
          <label>Trạng thái<select value={visibilityFilter} onChange={(event) => onVisibilityFilterChange(event.target.value)} className="d68-admin-input"><option value="">Tất cả</option><option value="visible">Hiển thị</option><option value="hidden">Ẩn</option></select></label>
          <label>{officeCountryLabel}<select value={officeCountryFilter} onChange={(event) => onOfficeCountryFilterChange(event.target.value)} className="d68-admin-input"><option value="">Tất cả</option>{officeCountries.map((value) => <option key={value} value={value}>{labelCountry(value, 'vi')}</option>)}</select></label>
          <label>Thị trường quan tâm<select value={targetCountryFilter} onChange={(event) => onTargetCountryFilterChange(event.target.value)} className="d68-admin-input"><option value="">Tất cả</option>{targetCountries.map((value) => <option key={value} value={value}>{labelCountry(value, 'vi')}</option>)}</select></label>
          <label>Loại hình<select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value)} className="d68-admin-input"><option value="">Tất cả</option>{types.map((value) => <option key={value} value={value}>{labelInvestorType(value, 'vi')}</option>)}</select></label>
          <label>Giai đoạn<select value={stageFilter} onChange={(event) => { setStageFilter(event.target.value); resetPage(); }} className="d68-admin-input"><option value="">Tất cả</option>{stages.map((value) => <option key={value} value={value}>{labelStage(value, 'vi')}</option>)}</select></label>
          <label>Ngành<select value={industryFilter} onChange={(event) => onIndustryFilterChange(event.target.value)} className="d68-admin-input"><option value="">Tất cả</option>{industries.map((value) => <option key={value} value={value}>{labelIndustryTaxonomy(value, 'vi')}</option>)}</select></label>
          <label>Loại giao dịch<select value={dealFilter} onChange={(event) => { setDealFilter(event.target.value); resetPage(); }} className="d68-admin-input"><option value="">Tất cả</option>{deals.map((value) => <option key={value} value={value}>{labelDealType(value, 'vi', true)}</option>)}</select></label>
        </div>
      </div>

      {rows.map((investor) => (
        <InvestorReviewEditor
          key={investor.id}
          investor={investor}
          profiles={profiles}
          payments={payments}
          onReload={onReload}
          setMessage={setMessage}
          setError={setError}
        />
      ))}

      {!rows.length ? <div className="d68-admin-empty">Không có nhà đầu tư phù hợp bộ lọc.</div> : null}

      {renderPagination
        ? renderPagination(safePage, pageCount, onPageChange)
        : (
          <div className="d68-admin-pagination">
            <button className="d68-admin-btn" disabled={safePage <= 1} onClick={() => onPageChange(Math.max(1, safePage - 1))}>← Trang trước</button>
            <span>{safePage} / {pageCount}</span>
            <button className="d68-admin-btn" disabled={safePage >= pageCount} onClick={() => onPageChange(Math.min(pageCount, safePage + 1))}>Trang sau →</button>
          </div>
        )}
    </>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
