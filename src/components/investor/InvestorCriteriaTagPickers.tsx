import { useEffect, useMemo, useState } from 'react';
import type { Lang } from '../../lib/i18n';
import {
  INVESTOR_DEAL_OPTIONS,
  INVESTOR_STAGE_OPTIONS,
  INVESTOR_TYPE_OPTIONS,
  optionValue,
  type InvestorCriteriaOption,
} from '../../lib/investorCriteriaOptions';
import { T } from '../../lib/labelsBase';

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[;,\n]/)
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
}: {
  lang: Lang;
  name: string;
  values: unknown;
  options: InvestorCriteriaOption[];
}) {
  const signature = JSON.stringify(asArray(values));
  const normalized = useMemo(
    () => Array.from(new Set(
      asArray(values)
        .map((item) => optionValue(item, options))
        .filter(Boolean),
    )),
    [signature, options],
  );
  const [selected, setSelected] = useState<string[]>(normalized);

  useEffect(() => setSelected(normalized), [JSON.stringify(normalized)]);

  function toggle(value: string) {
    setSelected((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
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
      </div>
    </div>
  );
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

export function InvestorDealTypeTagPicker({
  lang,
  values,
  name = 'deal_types',
}: {
  lang: Lang;
  values: unknown;
  name?: string;
}) {
  return (
    <MultiTagPicker
      lang={lang}
      name={name}
      values={values}
      options={INVESTOR_DEAL_OPTIONS}
    />
  );
}
