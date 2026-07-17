import { useEffect, useMemo, useState } from 'react';
import '../../styles/pages/investor-workflow.css';
import type { Lang } from '../../lib/i18n';
import {
  approvedInvestorCountries,
  approvedInvestorStages,
  approvedInvestorTypes,
  investorCriteriaArray,
  investorStageOptionsCanonical,
  investorTypeOptionsCanonical,
  normalizeInvestorCountries,
  normalizeInvestorStages,
  normalizeInvestorTypes,
} from '../../lib/investorCriteria';
import { countryOptions, T } from '../../lib/labels';

export type CriteriaTagOption = {
  value: string;
  label: string;
};

type CriteriaTagPickerProps = {
  name: string;
  values: unknown;
  options: CriteriaTagOption[];
  emptyLabel: string;
  onChange?: (values: string[]) => void;
  min?: number;
  max?: number;
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function CriteriaTagPicker({
  name,
  values,
  options,
  emptyLabel,
  onChange,
  min = 0,
  max = 0,
}: CriteriaTagPickerProps) {
  const allowed = useMemo(
    () => new Set(options.map((option) => option.value)),
    [JSON.stringify(options)],
  );
  const normalized = useMemo(
    () => unique(investorCriteriaArray(values)).filter((value) =>
      allowed.has(value),
    ),
    [JSON.stringify(investorCriteriaArray(values)), allowed],
  );
  const [selected, setSelected] = useState<string[]>(normalized);

  useEffect(() => {
    setSelected(normalized);
  }, [JSON.stringify(normalized)]);

  function toggle(value: string) {
    const hasValue = selected.includes(value);
    if (hasValue && selected.length <= min) return;
    if (!hasValue && max > 0 && selected.length >= max) return;

    const next = hasValue
      ? selected.filter((item) => item !== value)
      : [...selected, value];

    setSelected(next);
    onChange?.(next);
  }

  return (
    <div className="d68-taxonomy-picker">
      <input type="hidden" name={name} value={selected.join(',')} />
      <div className="d68-taxonomy-picker__tags">
        {options.length ? (
          options.map((option) => {
            const active = selected.includes(option.value);
            const disabled =
              (!active && max > 0 && selected.length >= max) ||
              (active && selected.length <= min);

            return (
              <button
                key={option.value}
                type="button"
                className={active ? 'active' : ''}
                aria-pressed={active}
                disabled={disabled}
                onClick={() => toggle(option.value)}
              >
                {option.label}
              </button>
            );
          })
        ) : (
          <span className="d68-taxonomy-picker__empty">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}

export function InvestorTypeTagPicker({
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
  const normalized = normalizeInvestorTypes(values);
  return (
    <CriteriaTagPicker
      name={name}
      values={normalized}
      options={investorTypeOptionsCanonical(lang)}
      emptyLabel={T(lang, 'Chưa chọn loại hình', 'No investor type selected')}
      min={1}
      onChange={onChange}
    />
  );
}

export function InvestorStageTagPicker({
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
  const normalized = normalizeInvestorStages(values);
  return (
    <CriteriaTagPicker
      name={name}
      values={normalized}
      options={investorStageOptionsCanonical(lang)}
      emptyLabel={T(lang, 'Chưa chọn giai đoạn', 'No stage selected')}
      min={1}
      onChange={onChange}
    />
  );
}

export function InvestorMarketTagPicker({
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
  const normalized = normalizeInvestorCountries(values);
  const options = countryOptions
    .filter((item) => item.iso2 !== 'OTHER')
    .map((item) => ({
      value: item.iso2,
      label: T(lang, item.vi, item.en),
    }));

  return (
    <CriteriaTagPicker
      name={name}
      values={normalized}
      options={options}
      emptyLabel={T(lang, 'Chưa chọn thị trường', 'No market selected')}
      min={1}
      onChange={onChange}
    />
  );
}

export function investorTypePickerValues(investor: Record<string, any>) {
  return approvedInvestorTypes(investor);
}

export function investorStagePickerValues(investor: Record<string, any>) {
  return approvedInvestorStages(investor);
}

export function investorMarketPickerValues(investor: Record<string, any>) {
  return approvedInvestorCountries(investor);
}
