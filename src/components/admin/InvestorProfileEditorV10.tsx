import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  InvestorCountryTagPicker,
  InvestorDealTypeTagPicker,
  InvestorRegionTagPicker,
  InvestorStageMultiTagPicker,
  InvestorTypeMultiTagPicker,
} from '../investor/InvestorCriteriaTagPickers';
import { IndustryTagPicker } from '../investor/IndustryTagPicker';
import type { InvestorRow } from '../../lib/investorAdminV10';
import {
  clean,
  investorNeedsReviewV10,
  objectOf,
  pendingInvestorProfile,
  privacyAfterInvestorProfileApproval,
  valueList,
} from '../../lib/investorAdminV10';
import { countryOptions } from '../../lib/labels';
import { parseFormattedNumber } from '../../lib/numberFormat';
import { supabase } from '../../lib/supabase';

type SubmitMode = 'save' | 'approve';

function submitModeFromEvent(event: FormEvent<HTMLFormElement>): SubmitMode {
  const submitter = (event.nativeEvent as SubmitEvent)
    .submitter as HTMLButtonElement | null;
  return submitter?.value === 'approve' ? 'approve' : 'save';
}

function first(values: string[], fallback = '') {
  return values.find(Boolean) || fallback;
}

function officeRegion(iso2: string) {
  if (['US', 'CA', 'BR'].includes(iso2)) return 'americas';
  if (['DE', 'GB', 'CZ'].includes(iso2)) return 'europe';
  if (['AU'].includes(iso2)) return 'oceania';
  if (['AE'].includes(iso2)) return 'middle_east';
  return 'asia';
}

export default function InvestorProfileEditorV10({
  investor,
  onRefresh,
}: {
  investor: InvestorRow;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setMessage('');
    setWarning('');
    setError('');
  }, [investor.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mode = submitModeFromEvent(event);
    setBusy(true);
    setMessage('');
    setWarning('');
    setError('');

    try {
      const form = new FormData(event.currentTarget);
      const currentCriteria = objectOf(investor.criteria);
      const investorTypes = valueList(form.get('investor_types'));
      const stages = valueList(form.get('stages'));
      const targetRegions = valueList(form.get('target_regions'));
      const targetCountries = valueList(form.get('target_countries')).map((item) => item.toUpperCase());
      const industries = valueList(form.get('industries'));
      const dealTypes = valueList(form.get('deal_types'));
      const countryIso2 = clean(form.get('country_iso2')).toUpperCase() || 'VN';
      const country = countryOptions.find((item) => item.iso2 === countryIso2);
      const ticketMin = parseFormattedNumber(form.get('ticket_min'));
      const ticketMax = parseFormattedNumber(form.get('ticket_max'));

      if (!investorTypes.length) throw new Error('Chọn ít nhất một loại hình Nhà đầu tư.');
      if (!stages.length) throw new Error('Chọn ít nhất một giai đoạn phù hợp.');
      if (!industries.length) throw new Error('Chọn ít nhất một ngành quan tâm.');
      if (!dealTypes.length) throw new Error('Chọn ít nhất một loại giao dịch.');
      if (ticketMin > ticketMax) throw new Error('Ticket tối thiểu không được lớn hơn Ticket tối đa.');

      const criteria = {
        ...currentCriteria,
        investorTypes,
        stages,
        targetRegions,
        targetCountries,
        preferredCountries: targetCountries,
        targetCountriesCache: targetCountries,
        sectors: industries,
        dealTypes,
      };
      const visible = form.get('visible') === 'on';
      const patch: InvestorRow = {
        private_name: clean(form.get('private_name')),
        private_website: clean(form.get('private_website')),
        private_email: clean(form.get('private_email')),
        private_phone: clean(form.get('private_phone')),
        title_vi: clean(form.get('title_vi')),
        title_en: clean(form.get('title_en')),
        desc_vi: clean(form.get('desc_vi')),
        desc_en: clean(form.get('desc_en')),
        type: first(investorTypes, investor.type || 'Individual/Angel'),
        country: country?.en || clean(form.get('country')) || investor.country || countryIso2,
        country_iso2: countryIso2,
        region: officeRegion(countryIso2),
        industries,
        deal_types: dealTypes,
        stage: first(stages, investor.stage || 'Any'),
        ticket_min: ticketMin,
        ticket_max: ticketMax,
        criteria,
        verified: form.get('verified') === 'on',
        admin_priority: form.get('admin_priority') === 'on',
        visible,
        status: visible ? 'active' : 'hidden',
        updated_at: new Date().toISOString(),
      };

      if (mode === 'approve') {
        patch.privacy = privacyAfterInvestorProfileApproval(investor);
      }

      const { error: saveError } = await supabase
        .from('investors')
        .update(patch)
        .eq('id', investor.id);
      if (saveError) throw saveError;

      setMessage(
        mode === 'approve'
          ? `Đã duyệt hồ sơ và giữ trạng thái ${visible ? 'hiển thị' : 'ẩn'} theo lựa chọn. Khẩu vị và tiêu chí chờ duyệt vẫn được xử lý riêng.`
          : `Đã lưu hồ sơ Nhà đầu tư với trạng thái ${visible ? 'hiển thị' : 'ẩn'}.`,
      );
      try {
        await onRefresh();
      } catch (refreshError: any) {
        setWarning(
          'Dữ liệu đã lưu nhưng giao diện chưa tải lại được. ' +
            (refreshError?.message || 'Hãy bấm Làm mới.'),
        );
      }
    } catch (saveError: any) {
      setError(saveError?.message || 'Không lưu được hồ sơ Nhà đầu tư.');
    } finally {
      setBusy(false);
    }
  }

  const criteria = objectOf(investor.criteria);
  const pending = pendingInvestorProfile(investor);
  const pendingCriteria = objectOf(pending.criteria);
  const investorTypes = pendingCriteria.investorTypes || criteria.investorTypes || [investor.type].filter(Boolean);
  const stages = pendingCriteria.stages || criteria.stages || [investor.stage].filter(Boolean);
  const targetRegions = pendingCriteria.targetRegions || criteria.targetRegions || [];
  const targetCountries = pendingCriteria.targetCountries || criteria.targetCountries || criteria.preferredCountries || [];
  const industries = pending.industries || pendingCriteria.sectors || investor.industries || criteria.sectors || [];
  const dealTypes = pending.deal_types || pendingCriteria.dealTypes || investor.deal_types || criteria.dealTypes || [];

  return (
    <form
      className="d68-admin-card"
      onSubmit={submit}
      key={`${investor.id}:${investor.updated_at || ''}`}
      data-testid="admin-investor-profile-editor"
    >
      <div className="d68-v10-section-head">
        <div>
          <h2>Hồ sơ Nhà đầu tư</h2>
          <p>Admin chỉnh sửa thông tin nội bộ, thông tin public và cấu trúc đầu tư.</p>
        </div>
        {investorNeedsReviewV10(investor) ? (
          <span className="d68-admin-badge warn">Cần duyệt</span>
        ) : null}
      </div>
      {message ? <div className="d68-admin-notice ok">{message}</div> : null}
      {warning ? <div data-testid="admin-investor-profile-warning" className="d68-admin-notice warn">{warning}</div> : null}
      {error ? <div data-testid="admin-investor-profile-error" className="d68-admin-notice err">{error}</div> : null}

      <section className="d68-v10-admin-taxonomy-section">
        <h3>Thông tin nội bộ và public</h3>
        <div className="d68-admin-form2">
          <label className="d68-admin-field"><span>Tên nội bộ</span><input name="private_name" className="d68-admin-input" defaultValue={investor.private_name || ''} /></label>
          <label className="d68-admin-field"><span>Website nội bộ</span><input name="private_website" className="d68-admin-input" defaultValue={investor.private_website || ''} /></label>
          <label className="d68-admin-field"><span>Email nội bộ</span><input name="private_email" className="d68-admin-input" defaultValue={investor.private_email || ''} /></label>
          <label className="d68-admin-field"><span>Điện thoại nội bộ</span><input name="private_phone" className="d68-admin-input" defaultValue={investor.private_phone || ''} /></label>
          <label className="d68-admin-field"><span>Tên hiển thị công khai (VN)</span><input name="title_vi" className="d68-admin-input" defaultValue={pending.title_vi ?? investor.title_vi ?? ''} /></label>
          <label className="d68-admin-field"><span>Tên hiển thị công khai (EN)</span><input name="title_en" className="d68-admin-input" defaultValue={pending.title_en ?? investor.title_en ?? ''} /></label>
          <label className="d68-admin-field"><span>Quốc gia trụ sở</span><select name="country_iso2" className="d68-admin-input" defaultValue={pending.country_iso2 ?? investor.country_iso2 ?? 'VN'}>{countryOptions.map((item) => <option key={item.iso2} value={item.iso2}>{item.vi}</option>)}</select></label>
          <input type="hidden" name="country" value={investor.country || ''} />
          <label className="d68-admin-field"><span>Ticket tối thiểu (USD)</span><input name="ticket_min" className="d68-admin-input" defaultValue={pending.ticket_min ?? investor.ticket_min ?? ''} /></label>
          <label className="d68-admin-field"><span>Ticket tối đa (USD)</span><input name="ticket_max" className="d68-admin-input" defaultValue={pending.ticket_max ?? investor.ticket_max ?? ''} /></label>
        </div>
      </section>

      <section className="d68-v10-admin-taxonomy-section">
        <h3>Cấu trúc và tiêu chí đầu tư</h3>
        <label className="d68-admin-field"><span>Loại hình Nhà đầu tư</span><small>Chọn một hoặc nhiều; giá trị đầu tiên được giữ làm loại hình chính để tương thích dữ liệu cũ.</small><InvestorTypeMultiTagPicker lang="vi" values={investorTypes} /></label>
        <label className="d68-admin-field"><span>Giai đoạn phù hợp</span><small>Chọn một hoặc nhiều; “Linh hoạt” loại trừ các giai đoạn cụ thể.</small><InvestorStageMultiTagPicker lang="vi" values={stages} /></label>
        <label className="d68-admin-field"><span>Khu vực đầu tư</span><InvestorRegionTagPicker lang="vi" values={targetRegions} /></label>
        <label className="d68-admin-field"><span>Thị trường quan tâm</span><InvestorCountryTagPicker lang="vi" values={targetCountries} /></label>
        <label className="d68-admin-field"><span>Ngành quan tâm</span><IndustryTagPicker lang="vi" name="industries" values={industries} expandVi="Đầy đủ" expandEn="Show all" defaultExpanded /></label>
        <label className="d68-admin-field"><span>Ưu tiên giao dịch</span><InvestorDealTypeTagPicker lang="vi" values={dealTypes} /></label>
      </section>

      <section className="d68-v10-admin-taxonomy-section">
        <h3>Mô tả public</h3>
        <div className="d68-admin-form2">
          <label className="d68-admin-field"><span>Mô tả public (VN)</span><textarea name="desc_vi" className="d68-admin-input d68-v10-textarea" defaultValue={pending.desc_vi ?? investor.desc_vi ?? ''} /></label>
          <label className="d68-admin-field"><span>Mô tả public (EN)</span><textarea name="desc_en" className="d68-admin-input d68-v10-textarea" defaultValue={pending.desc_en ?? investor.desc_en ?? ''} /></label>
        </div>
      </section>

      <div className="d68-v10-check-row">
        <label className="d68-admin-check"><input name="verified" type="checkbox" defaultChecked={Boolean(investor.verified)} /> Đã xác minh</label>
        <label className="d68-admin-check"><input name="admin_priority" type="checkbox" defaultChecked={Boolean(investor.admin_priority)} /> Ưu tiên</label>
        <label className="d68-admin-check"><input name="visible" type="checkbox" defaultChecked={Boolean(investor.visible)} /> Hiển thị public</label>
      </div>
      <div className="d68-admin-notice">Duyệt hồ sơ không tự bật hiển thị. Trạng thái Public/Ẩn luôn theo checkbox “Hiển thị public”.</div>

      <div className="d68-admin-actions">
        <button type="submit" name="submit_mode" value="save" className="d68-admin-btn green" disabled={busy}>Lưu hồ sơ</button>
        <button type="submit" name="submit_mode" value="approve" className="d68-admin-btn blue" disabled={busy}>Duyệt hồ sơ & lưu trạng thái</button>
        {investor.code ? <Link className="d68-admin-btn" to={`/investors/${investor.code}`} target="_blank" rel="noreferrer">Xem public ↗</Link> : null}
      </div>
    </form>
  );
}
