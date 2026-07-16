import { type FormEvent, useState } from 'react';
import type { Lang } from '../../lib/i18n';
import type { InvestorRow } from '../../lib/investorAdminV10';
import { objectOf, valueList } from '../../lib/investorAdminV10';
import { countryOptions, T } from '../../lib/labels';
import { parseFormattedNumber } from '../../lib/numberFormat';
import { supabase } from '../../lib/supabase';
import { IndustryTagPicker } from './IndustryTagPicker';
import {
  InvestorCountryTagPicker,
  InvestorDealTypeTagPicker,
  InvestorRegionTagPicker,
  InvestorStageMultiTagPicker,
  InvestorTypeMultiTagPicker,
} from './InvestorCriteriaTagPickers';

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
      const currentCriteria = objectOf(investor.criteria);
      const investorTypes = valueList(form.get('investor_types'));
      const stages = valueList(form.get('stages'));
      const targetRegions = valueList(form.get('target_regions'));
      const targetCountries = valueList(form.get('target_countries')).map((item) => item.toUpperCase());
      const industries = valueList(form.get('industries'));
      const dealTypes = valueList(form.get('deal_types'));
      const countryIso2 = String(form.get('country_iso2') || investor.country_iso2 || 'VN').trim().toUpperCase();
      const country = countryOptions.find((item) => item.iso2 === countryIso2);

      if (!investorTypes.length) throw new Error(T(lang, 'Vui lòng chọn ít nhất một loại hình nhà đầu tư.', 'Select at least one investor type.'));
      if (!stages.length) throw new Error(T(lang, 'Vui lòng chọn ít nhất một giai đoạn phù hợp.', 'Select at least one preferred stage.'));
      if (!industries.length) throw new Error(T(lang, 'Vui lòng chọn ít nhất một ngành quan tâm.', 'Select at least one industry.'));
      if (!dealTypes.length) throw new Error(T(lang, 'Vui lòng chọn ít nhất một loại giao dịch.', 'Select at least one deal type.'));

      const profilePatch = {
        private_name: String(form.get('private_name') || '').trim(),
        private_website: String(form.get('private_website') || '').trim(),
        type: first(investorTypes, investor.type || 'Individual/Angel'),
        country_iso2: countryIso2,
        country: country?.en || investor.country || countryIso2,
        region: officeRegion(countryIso2),
        industries,
        deal_types: dealTypes,
        stage: first(stages, investor.stage || 'Any'),
        ticket_min: parseFormattedNumber(form.get('ticket_min')),
        ticket_max: parseFormattedNumber(form.get('ticket_max')),
        criteria: {
          ...currentCriteria,
          investorTypes,
          stages,
          targetRegions,
          targetCountries,
          preferredCountries: targetCountries,
          targetCountriesCache: targetCountries,
          sectors: industries,
          dealTypes,
        },
      };

      if (Number(profilePatch.ticket_min || 0) > Number(profilePatch.ticket_max || 0)) {
        throw new Error(T(lang, 'Khoản đầu tư tối thiểu không được lớn hơn khoản đầu tư tối đa.', 'Minimum ticket cannot exceed maximum ticket.'));
      }

      const descriptionPatch = {
        desc_vi: String(form.get('desc_vi') || ''),
        desc_en: String(form.get('desc_en') || ''),
      };
      const { data, error: saveError } = await supabase.rpc(
        'update_my_investor_profile',
        { profile_patch: profilePatch, description_patch: descriptionPatch },
      );
      if (saveError) throw saveError;

      const pending = Boolean(data?.description_pending || data?.has_other_pending_changes);
      setMessage(
        pending
          ? T(lang, 'Đã lưu. Thông tin public mới cần Admin duyệt trước khi hiển thị.', 'Saved. New public information requires administrator approval before display.')
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
  const investorTypes = criteria.investorTypes || [investor.type].filter(Boolean);
  const stages = criteria.stages || [investor.stage].filter(Boolean);
  const targetRegions = criteria.targetRegions || [];
  const targetCountries = criteria.targetCountries || criteria.preferredCountries || objectOf(investor.privacy).preferredCountries || [];
  const industries = investor.industries || criteria.sectors || [];
  const dealTypes = investor.deal_types || criteria.dealTypes || [];

  return (
    <form
      className="d68-dashboard-card d68-investor-profile-form"
      onSubmit={submit}
      key={`${investor.id}:${investor.updated_at || ''}`}
    >
      <div className="d68-dashboard-row-head">
        <div>
          <h2>{T(lang, 'Hồ sơ Nhà đầu tư', 'Investor profile')}</h2>
          <p>{T(lang, 'Thông tin hồ sơ và cấu trúc tiêu chí đầu tư của bạn.', 'Your profile and investment criteria structure.')}</p>
        </div>
      </div>
      {message ? <div className="d68-dashboard-notice ok">{message}</div> : null}
      {warning ? <div className="d68-dashboard-notice warn">{warning}</div> : null}
      {error ? <div className="d68-dashboard-notice err">{error}</div> : null}

      <section className="d68-investor-profile-section">
        <h3>{T(lang, 'Thông tin hồ sơ', 'Profile information')}</h3>
        <div className="d68-dashboard-form2">
          <label className="d68-dashboard-field"><span>{T(lang, 'Tên Quỹ đầu tư / Nhà đầu tư — nội bộ, không công khai', 'Fund / Investor name — internal, not public')}</span><input name="private_name" className="d68-dashboard-input" defaultValue={investor.private_name || ''} /></label>
          <label className="d68-dashboard-field"><span>Website</span><input name="private_website" className="d68-dashboard-input" defaultValue={investor.private_website || ''} /></label>
          <label className="d68-dashboard-field"><span>{T(lang, 'Tên hiển thị công khai (VN)', 'Public display name (VI)')}</span><input className="d68-dashboard-input d68-dashboard-input--locked" value={investor.title_vi || ''} disabled readOnly /><small>{T(lang, 'Liên hệ quản trị Deals68 nếu cần thay đổi.', 'Contact Deals68 administration to change this field.')}</small></label>
          <label className="d68-dashboard-field"><span>{T(lang, 'Tên hiển thị công khai (EN)', 'Public display name (EN)')}</span><input className="d68-dashboard-input d68-dashboard-input--locked" value={investor.title_en || ''} disabled readOnly /><small>{T(lang, 'Liên hệ quản trị Deals68 nếu cần thay đổi.', 'Contact Deals68 administration to change this field.')}</small></label>
          <label className="d68-dashboard-field"><span>{T(lang, 'Quốc gia trụ sở', 'Headquarters country')}</span><select name="country_iso2" className="d68-dashboard-input" defaultValue={investor.country_iso2 || 'VN'}>{countryOptions.map((item) => <option key={item.iso2} value={item.iso2}>{T(lang, item.vi, item.en)}</option>)}</select></label>
          <label className="d68-dashboard-field"><span>{T(lang, 'Khoản đầu tư tối thiểu (USD)', 'Minimum ticket (USD)')}</span><input name="ticket_min" className="d68-dashboard-input" inputMode="numeric" defaultValue={investor.ticket_min || ''} /></label>
          <label className="d68-dashboard-field"><span>{T(lang, 'Khoản đầu tư tối đa (USD)', 'Maximum ticket (USD)')}</span><input name="ticket_max" className="d68-dashboard-input" inputMode="numeric" defaultValue={investor.ticket_max || ''} /></label>
        </div>
      </section>

      <section className="d68-investor-profile-section">
        <h3>{T(lang, 'Cấu trúc và tiêu chí đầu tư', 'Investment structure and criteria')}</h3>
        <label className="d68-dashboard-field"><span>{T(lang, 'Loại hình nhà đầu tư', 'Investor type')}</span><small>{T(lang, 'Có thể chọn một hoặc nhiều.', 'Select one or more.')}</small><InvestorTypeMultiTagPicker lang={lang} values={investorTypes} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Giai đoạn phù hợp', 'Preferred stages')}</span><small>{T(lang, 'Có thể chọn nhiều; “Linh hoạt” loại trừ các giai đoạn cụ thể.', 'Multiple selections; “Flexible” excludes specific stages.')}</small><InvestorStageMultiTagPicker lang={lang} values={stages} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Khu vực đầu tư', 'Investment regions')}</span><InvestorRegionTagPicker lang={lang} values={targetRegions} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Thị trường quan tâm', 'Target markets')}</span><InvestorCountryTagPicker lang={lang} values={targetCountries} /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Ngành quan tâm', 'Preferred industries')}</span><IndustryTagPicker lang={lang} values={industries} name="industries" expandVi="Đầy đủ" expandEn="Show all" defaultExpanded /></label>
        <label className="d68-dashboard-field"><span>{T(lang, 'Loại giao dịch quan tâm', 'Preferred deal types')}</span><InvestorDealTypeTagPicker lang={lang} values={dealTypes} /></label>
      </section>

      <section className="d68-investor-profile-section">
        <h3>{T(lang, 'Mô tả công khai', 'Public description')}</h3>
        <div className="d68-dashboard-form2">
          <label className="d68-dashboard-field"><span>{T(lang, 'Mô tả ẩn danh công khai (VN)', 'Public anonymous description (VI)')}</span><textarea name="desc_vi" className="d68-dashboard-input d68-v10-textarea" defaultValue={pending.desc_vi ?? investor.desc_vi ?? ''} /></label>
          <label className="d68-dashboard-field"><span>{T(lang, 'Mô tả ẩn danh công khai (EN)', 'Public anonymous description (EN)')}</span><textarea name="desc_en" className="d68-dashboard-input d68-v10-textarea" defaultValue={pending.desc_en ?? investor.desc_en ?? ''} /></label>
        </div>
        <div className="d68-investor-profile-review-note">{T(lang, 'Các thay đổi thông tin public cần quản trị Deals68 kiểm tra trước khi hiển thị.', 'Public information changes require Deals68 administrator review before display.')}</div>
      </section>

      <div className="d68-dashboard-actions">
        <button className="d68-dashboard-btn blue" disabled={busy}>{busy ? T(lang, 'Đang lưu...', 'Saving...') : T(lang, 'Lưu hồ sơ', 'Save profile')}</button>
      </div>
    </form>
  );
}
