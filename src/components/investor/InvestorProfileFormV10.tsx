import { type FormEvent, useState } from 'react';
import type { Lang } from '../../lib/i18n';
import type { InvestorRow } from '../../lib/investorAdminV10';
import { objectOf, valueList } from '../../lib/investorAdminV10';
import { T } from '../../lib/labels';
import { parseFormattedNumber } from '../../lib/numberFormat';
import { supabase } from '../../lib/supabase';

function lines(value: unknown) {
  return valueList(value).join('\n');
}

export default function InvestorProfileFormV10({
  investor,
  lang,
  onRefresh,
}: {
  investor: InvestorRow;
  lang: Lang;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setWarning('');
    setError('');
    try {
      const form = new FormData(event.currentTarget);
      const criteria = objectOf(investor.criteria);
      const targetCountries = valueList(form.get('target_countries')).map(
        (item) => item.toUpperCase(),
      );
      const industries = valueList(form.get('industries'));
      const dealTypes = valueList(form.get('deal_types'));
      const profilePatch = {
        private_name: String(form.get('private_name') || '').trim(),
        private_website: String(form.get('private_website') || '').trim(),
        type: String(form.get('type') || '').trim(),
        country_iso2: String(form.get('country_iso2') || '').trim().toUpperCase(),
        country: String(form.get('country') || '').trim(),
        region: String(form.get('region') || '').trim(),
        industries,
        deal_types: dealTypes,
        stage: String(form.get('stage') || '').trim(),
        ticket_min: parseFormattedNumber(form.get('ticket_min')),
        ticket_max: parseFormattedNumber(form.get('ticket_max')),
        criteria: {
          ...criteria,
          sectors: industries,
          dealTypes,
          targetCountries,
          preferredCountries: targetCountries,
        },
      };
      const descriptionPatch = {
        desc_vi: String(form.get('desc_vi') || ''),
        desc_en: String(form.get('desc_en') || ''),
      };
      const { data, error: saveError } = await supabase.rpc(
        'update_my_investor_profile',
        { profile_patch: profilePatch, description_patch: descriptionPatch },
      );
      if (saveError) throw saveError;

      const pending = Boolean(data?.description_pending);
      setMessage(
        pending
          ? T(lang, 'Đã lưu. Mô tả mới cần Admin duyệt trước khi public.', 'Saved. The new description requires administrator approval before publication.')
          : T(lang, 'Cập nhật hồ sơ thành công.', 'Profile updated successfully.'),
      );
      try {
        await onRefresh();
      } catch (refreshError: any) {
        setWarning(
          T(lang, 'Dữ liệu đã lưu nhưng giao diện chưa tải lại được.', 'Data was saved, but the page could not refresh.') +
            (refreshError?.message ? ` ${refreshError.message}` : ''),
        );
      }
    } catch (saveError: any) {
      setError(saveError?.message || T(lang, 'Không lưu được hồ sơ.', 'Could not save profile.'));
    } finally {
      setBusy(false);
    }
  }

  const criteria = objectOf(investor.criteria);
  const pending = objectOf(objectOf(investor.privacy).pending_profile_changes);

  return (
    <form
      className="d68-dashboard-card d68-investor-profile-form"
      onSubmit={submit}
      key={`${investor.id}:${investor.updated_at || ''}`}
    >
      <h2>{T(lang, 'Hồ sơ Nhà đầu tư', 'Investor profile')}</h2>
      <p>{T(lang, 'Thông tin hồ sơ và tiêu chí đầu tư của bạn.', 'Your profile and investment criteria.')}</p>
      {message ? <div className="d68-dashboard-notice ok">{message}</div> : null}
      {warning ? <div className="d68-dashboard-notice warn">{warning}</div> : null}
      {error ? <div className="d68-dashboard-notice err">{error}</div> : null}

      <div className="d68-dashboard-form2">
        <label className="d68-dashboard-field"><span>{T(lang, 'Tên nội bộ', 'Internal name')}</span><input name="private_name" className="d68-dashboard-input" defaultValue={investor.private_name || ''} /></label>
        <label className="d68-dashboard-field"><span>Website</span><input name="private_website" className="d68-dashboard-input" defaultValue={investor.private_website || ''} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Tên public VN — Admin quản lý', 'Public Vietnamese name — administrator managed')}</span><input className="d68-dashboard-input d68-dashboard-input--locked" value={investor.title_vi || ''} disabled readOnly /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Tên public EN — Admin quản lý', 'Public English name — administrator managed')}</span><input className="d68-dashboard-input d68-dashboard-input--locked" value={investor.title_en || ''} disabled readOnly /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Loại Investor', 'Investor type')}</span><input name="type" className="d68-dashboard-input" defaultValue={investor.type || ''} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Giai đoạn', 'Stage')}</span><input name="stage" className="d68-dashboard-input" defaultValue={investor.stage || ''} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Quốc gia', 'Country')}</span><input name="country" className="d68-dashboard-input" defaultValue={investor.country || ''} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Mã quốc gia', 'Country code')}</span><input name="country_iso2" className="d68-dashboard-input" defaultValue={investor.country_iso2 || ''} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Khu vực', 'Region')}</span><input name="region" className="d68-dashboard-input" defaultValue={investor.region || ''} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Ticket tối thiểu', 'Minimum ticket')}</span><input name="ticket_min" className="d68-dashboard-input" defaultValue={investor.ticket_min || ''} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Ticket tối đa', 'Maximum ticket')}</span><input name="ticket_max" className="d68-dashboard-input" defaultValue={investor.ticket_max || ''} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Thị trường quan tâm', 'Target markets')}</span><textarea name="target_countries" className="d68-dashboard-input d68-v10-textarea" defaultValue={lines(criteria.targetCountries || criteria.preferredCountries)} /></label>
      </div>
      <div className="d68-dashboard-form2">
        <label className="d68-dashboard-field"><span>{T(lang, 'Ngành quan tâm', 'Industries')}</span><textarea name="industries" className="d68-dashboard-input d68-v10-textarea" defaultValue={lines(investor.industries || criteria.sectors)} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Loại giao dịch', 'Deal types')}</span><textarea name="deal_types" className="d68-dashboard-input d68-v10-textarea" defaultValue={lines(investor.deal_types || criteria.dealTypes)} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Mô tả public VN', 'Public Vietnamese description')}</span><textarea name="desc_vi" className="d68-dashboard-input d68-v10-textarea" defaultValue={pending.desc_vi ?? investor.desc_vi ?? ''} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Mô tả public EN', 'Public English description')}</span><textarea name="desc_en" className="d68-dashboard-input d68-v10-textarea" defaultValue={pending.desc_en ?? investor.desc_en ?? ''} /></label>
      </div>
      <button className="d68-dashboard-btn blue" disabled={busy}>
        {busy ? T(lang, 'Đang lưu...', 'Saving...') : T(lang, 'Lưu hồ sơ', 'Save profile')}
      </button>
    </form>
  );
}
