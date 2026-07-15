import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { InvestorRow } from '../../lib/investorAdminV10';
import {
  clean,
  investorNeedsReviewV10,
  objectOf,
  pendingInvestorProfile,
  privacyAfterInvestorProfileApproval,
  valueList,
} from '../../lib/investorAdminV10';
import { parseFormattedNumber } from '../../lib/numberFormat';
import { supabase } from '../../lib/supabase';

type SubmitMode = 'save' | 'approve';

function lines(value: unknown) {
  return valueList(value).join('\n');
}

function submitModeFromEvent(event: FormEvent<HTMLFormElement>): SubmitMode {
  const submitter = (event.nativeEvent as SubmitEvent)
    .submitter as HTMLButtonElement | null;
  return submitter?.value === 'approve' ? 'approve' : 'save';
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
      const targetCountries = valueList(form.get('target_countries')).map(
        (item) => item.toUpperCase(),
      );
      const criteria = {
        ...currentCriteria,
        sectors: valueList(form.get('industries')),
        dealTypes: valueList(form.get('deal_types')),
        targetCountries,
        preferredCountries: targetCountries,
        targetCountriesCache: targetCountries,
      };
      const visible = mode === 'approve' || form.get('visible') === 'on';
      const patch: InvestorRow = {
        private_name: clean(form.get('private_name')),
        private_website: clean(form.get('private_website')),
        private_email: clean(form.get('private_email')),
        private_phone: clean(form.get('private_phone')),
        title_vi: clean(form.get('title_vi')),
        title_en: clean(form.get('title_en')),
        desc_vi: clean(form.get('desc_vi')),
        desc_en: clean(form.get('desc_en')),
        type: clean(form.get('type')),
        country: clean(form.get('country')),
        country_iso2: clean(form.get('country_iso2')).toUpperCase(),
        region: clean(form.get('region')),
        industries: criteria.sectors,
        deal_types: criteria.dealTypes,
        stage: clean(form.get('stage')),
        ticket_min: parseFormattedNumber(form.get('ticket_min')),
        ticket_max: parseFormattedNumber(form.get('ticket_max')),
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
          ? 'Đã duyệt hồ sơ khác. Khẩu vị đầu tư vẫn được duyệt riêng.'
          : 'Đã lưu hồ sơ Investor.',
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
      setError(saveError?.message || 'Không lưu được hồ sơ Investor.');
    } finally {
      setBusy(false);
    }
  }

  const criteria = objectOf(investor.criteria);
  const pending = pendingInvestorProfile(investor);

  return (
    <form
      className="d68-admin-card"
      onSubmit={submit}
      key={`${investor.id}:${investor.updated_at || ''}`}
    >
      <div className="d68-v10-section-head">
        <div>
          <h2>Hồ sơ Investor</h2>
          <p>Admin chỉnh sửa thông tin public và thông tin nội bộ.</p>
        </div>
        {investorNeedsReviewV10(investor) ? (
          <span className="d68-admin-badge warn">Cần duyệt</span>
        ) : null}
      </div>
      {message ? <div className="d68-admin-notice ok">{message}</div> : null}
      {warning ? <div data-testid="admin-investor-profile-warning" className="d68-admin-notice warn">{warning}</div> : null}
      {error ? <div data-testid="admin-investor-profile-error" className="d68-admin-notice err">{error}</div> : null}

      <div className="d68-admin-form2">
        <label className="d68-admin-field"><span>Tên nội bộ</span><input name="private_name" className="d68-admin-input" defaultValue={investor.private_name || ''} /></label>
        <label className="d68-admin-field"><span>Website nội bộ</span><input name="private_website" className="d68-admin-input" defaultValue={investor.private_website || ''} /></label>
        <label className="d68-admin-field"><span>Email nội bộ</span><input name="private_email" className="d68-admin-input" defaultValue={investor.private_email || ''} /></label>
        <label className="d68-admin-field"><span>Điện thoại nội bộ</span><input name="private_phone" className="d68-admin-input" defaultValue={investor.private_phone || ''} /></label>
        <label className="d68-admin-field"><span>Tiêu đề public VN</span><input name="title_vi" className="d68-admin-input" defaultValue={pending.title_vi ?? investor.title_vi ?? ''} /></label>
        <label className="d68-admin-field"><span>Tiêu đề public EN</span><input name="title_en" className="d68-admin-input" defaultValue={pending.title_en ?? investor.title_en ?? ''} /></label>
        <label className="d68-admin-field"><span>Loại Investor</span><input name="type" className="d68-admin-input" defaultValue={investor.type || ''} /></label>
        <label className="d68-admin-field"><span>Giai đoạn</span><input name="stage" className="d68-admin-input" defaultValue={investor.stage || ''} /></label>
        <label className="d68-admin-field"><span>Quốc gia</span><input name="country" className="d68-admin-input" defaultValue={investor.country || ''} /></label>
        <label className="d68-admin-field"><span>Mã quốc gia</span><input name="country_iso2" className="d68-admin-input" defaultValue={investor.country_iso2 || ''} /></label>
        <label className="d68-admin-field"><span>Khu vực</span><input name="region" className="d68-admin-input" defaultValue={investor.region || ''} /></label>
        <label className="d68-admin-field"><span>Ticket tối thiểu</span><input name="ticket_min" className="d68-admin-input" defaultValue={investor.ticket_min || ''} /></label>
        <label className="d68-admin-field"><span>Ticket tối đa</span><input name="ticket_max" className="d68-admin-input" defaultValue={investor.ticket_max || ''} /></label>
        <label className="d68-admin-field"><span>Thị trường quan tâm</span><textarea name="target_countries" className="d68-admin-input d68-v10-textarea" defaultValue={lines(criteria.targetCountries || criteria.preferredCountries)} /></label>
      </div>

      <div className="d68-admin-form2">
        <label className="d68-admin-field"><span>Ngành quan tâm</span><textarea name="industries" className="d68-admin-input d68-v10-textarea" defaultValue={lines(investor.industries || criteria.sectors)} /></label>
        <label className="d68-admin-field"><span>Loại giao dịch</span><textarea name="deal_types" className="d68-admin-input d68-v10-textarea" defaultValue={lines(investor.deal_types || criteria.dealTypes)} /></label>
        <label className="d68-admin-field"><span>Mô tả public VN</span><textarea name="desc_vi" className="d68-admin-input d68-v10-textarea" defaultValue={pending.desc_vi ?? investor.desc_vi ?? ''} /></label>
        <label className="d68-admin-field"><span>Mô tả public EN</span><textarea name="desc_en" className="d68-admin-input d68-v10-textarea" defaultValue={pending.desc_en ?? investor.desc_en ?? ''} /></label>
      </div>

      <div className="d68-v10-check-row">
        <label className="d68-admin-check"><input name="verified" type="checkbox" defaultChecked={Boolean(investor.verified)} /> Đã xác minh</label>
        <label className="d68-admin-check"><input name="admin_priority" type="checkbox" defaultChecked={Boolean(investor.admin_priority)} /> Ưu tiên</label>
        <label className="d68-admin-check"><input name="visible" type="checkbox" defaultChecked={Boolean(investor.visible)} /> Public</label>
      </div>

      <div className="d68-admin-actions">
        <button type="submit" name="submit_mode" value="save" className="d68-admin-btn green" disabled={busy}>Lưu hồ sơ</button>
        <button type="submit" name="submit_mode" value="approve" className="d68-admin-btn blue" disabled={busy}>Duyệt hồ sơ khác & Public</button>
        {investor.code ? <Link className="d68-admin-btn" to={`/investors/${investor.code}`} target="_blank" rel="noreferrer">Xem public ↗</Link> : null}
      </div>
    </form>
  );
}
