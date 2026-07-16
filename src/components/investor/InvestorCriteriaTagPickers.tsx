import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../../lib/i18n';
import {
  INVESTOR_DEAL_OPTIONS,
  INVESTOR_REGION_OPTIONS,
  INVESTOR_STAGE_OPTIONS,
  INVESTOR_TYPE_OPTIONS,
  normalizeExclusiveSelection,
  optionValue,
  optionValues,
  type InvestorCriteriaOption,
} from '../../lib/investorCriteriaOptions';
import { countryOptions } from '../../lib/labels';
import { T } from '../../lib/labelsBase';

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[;,\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function SingleTagPicker({
  lang,
  name,
  value,
  options,
  emptyVi = 'Chưa chọn',
  emptyEn = 'Not selected',
}: {
  lang: Lang;
  name: string;
  value: unknown;
  options: InvestorCriteriaOption[];
  emptyVi?: string;
  emptyEn?: string;
}) {
  const normalized = useMemo(
    () => optionValue(value, options),
    [String(value || ''), options],
  );
  const [selected, setSelected] = useState(normalized);

  useEffect(() => setSelected(normalized), [normalized]);

  return (
    <div className="d68-taxonomy-picker d68-v10-criteria-picker">
      <input type="hidden" name={name} value={selected} />
      <div className="d68-taxonomy-picker__tags">
        <button
          type="button"
          className={!selected ? 'active' : ''}
          aria-pressed={!selected}
          onClick={() => setSelected('')}
        >
          {T(lang, emptyVi, emptyEn)}
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={selected === option.value ? 'active' : ''}
            aria-pressed={selected === option.value}
            onClick={() => setSelected(option.value)}
          >
            {T(lang, option.vi, option.en)}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiTagPicker({
  lang,
  name,
  values,
  options,
  exclusiveValue,
  minimum = 0,
  emptyVi = 'Chưa chọn',
  emptyEn = 'Not selected',
  onChange,
}: {
  lang: Lang;
  name: string;
  values: unknown;
  options: InvestorCriteriaOption[];
  exclusiveValue?: string;
  minimum?: number;
  emptyVi?: string;
  emptyEn?: string;
  onChange?: (values: string[]) => void;
}) {
  const signature = JSON.stringify(asArray(values));
  const normalized = useMemo(
    () => optionValues(values, options),
    [signature, options],
  );
  const [selected, setSelected] = useState<string[]>(normalized);

  useEffect(() => setSelected(normalized), [JSON.stringify(normalized)]);

  function toggle(value: string) {
    const next = exclusiveValue
      ? normalizeExclusiveSelection(selected, value, exclusiveValue)
      : selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value];
    if (next.length < minimum) return;
    setSelected(next);
    onChange?.(next);
  }

  return (
    <div className="d68-taxonomy-picker d68-v10-criteria-picker">
      <input type="hidden" name={name} value={selected.join(',')} />
      <div className="d68-taxonomy-picker__tags">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={selected.includes(option.value) ? 'active' : ''}
            aria-pressed={selected.includes(option.value)}
            onClick={() => toggle(option.value)}
          >
            {T(lang, option.vi, option.en)}
          </button>
        ))}
        {!selected.length ? (
          <span className="d68-taxonomy-picker__empty">
            {T(lang, emptyVi, emptyEn)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function normalizeCountryValues(value: unknown) {
  const countries = countryOptions.filter((option) => option.iso2 !== 'OTHER');
  return Array.from(new Set(
    asArray(value)
      .map((raw) => {
        const normalized = raw.trim().toLowerCase();
        return countries.find((option) =>
          option.iso2.toLowerCase() === normalized ||
          option.vi.toLowerCase() === normalized ||
          option.en.toLowerCase() === normalized,
        )?.iso2 || '';
      })
      .filter(Boolean),
  ));
}

export function InvestorTypeTagPicker({
  lang,
  value,
  name = 'type',
}: {
  lang: Lang;
  value: unknown;
  name?: string;
}) {
  return (
    <SingleTagPicker
      lang={lang}
      name={name}
      value={value}
      options={INVESTOR_TYPE_OPTIONS}
      emptyVi="Chọn loại hình"
      emptyEn="Select investor type"
    />
  );
}

export function InvestorTypeMultiTagPicker({
  lang,
  values,
  name = 'investor_types',
  onChange,
}: {
  lang: Lang;
  values: unknown;
  name?: string;
  onChange?: (values: string[]) => void;
}) {
  return (
    <MultiTagPicker
      lang={lang}
      name={name}
      values={values}
      options={INVESTOR_TYPE_OPTIONS}
      minimum={1}
      emptyVi="Chọn ít nhất một loại hình"
      emptyEn="Select at least one investor type"
      onChange={onChange}
    />
  );
}

export function InvestorStageTagPicker({
  lang,
  value,
  name = 'stage',
}: {
  lang: Lang;
  value: unknown;
  name?: string;
}) {
  return (
    <SingleTagPicker
      lang={lang}
      name={name}
      value={value}
      options={INVESTOR_STAGE_OPTIONS}
      emptyVi="Chọn giai đoạn"
      emptyEn="Select stage"
    />
  );
}

export function InvestorStageMultiTagPicker({
  lang,
  values,
  name = 'stages',
  onChange,
}: {
  lang: Lang;
  values: unknown;
  name?: string;
  onChange?: (values: string[]) => void;
}) {
  return (
    <MultiTagPicker
      lang={lang}
      name={name}
      values={values}
      options={INVESTOR_STAGE_OPTIONS}
      exclusiveValue="Any"
      minimum={1}
      emptyVi="Chọn ít nhất một giai đoạn"
      emptyEn="Select at least one stage"
      onChange={onChange}
    />
  );
}

export function InvestorRegionTagPicker({
  lang,
  values,
  name = 'target_regions',
  onChange,
}: {
  lang: Lang;
  values: unknown;
  name?: string;
  onChange?: (values: string[]) => void;
}) {
  return (
    <MultiTagPicker
      lang={lang}
      name={name}
      values={values}
      options={INVESTOR_REGION_OPTIONS}
      exclusiveValue="global"
      emptyVi="Chưa chọn khu vực đầu tư"
      emptyEn="No target region selected"
      onChange={onChange}
    />
  );
}

export function InvestorCountryTagPicker({
  lang,
  values,
  name = 'target_countries',
  onChange,
}: {
  lang: Lang;
  values: unknown;
  name?: string;
  onChange?: (values: string[]) => void;
}) {
  const countryChoices = countryOptions
    .filter((option) => option.iso2 !== 'OTHER')
    .map((option) => ({ value: option.iso2, vi: option.vi, en: option.en }));
  const normalized = normalizeCountryValues(values);

  return (
    <MultiTagPicker
      lang={lang}
      name={name}
      values={normalized}
      options={countryChoices}
      emptyVi="Chưa chọn thị trường"
      emptyEn="No target market selected"
      onChange={onChange}
    />
  );
}

export function InvestorDealTypeTagPicker({
  lang,
  values,
  name = 'deal_types',
  onChange,
}: {
  lang: Lang;
  values: unknown;
  name?: string;
  onChange?: (values: string[]) => void;
}) {
  return (
    <MultiTagPicker
      lang={lang}
      name={name}
      values={values}
      options={INVESTOR_DEAL_OPTIONS}
      emptyVi="Chưa chọn loại giao dịch"
      emptyEn="No deal type selected"
      onChange={onChange}
    />
  );
}
