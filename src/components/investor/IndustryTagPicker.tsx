import { useEffect, useMemo, useState } from 'react';
import '../../styles/pages/investor-workflow.css';
import type { Lang } from '../../lib/i18n';
import {
  industryKeyFromLabel,
  industryOptions,
} from '../../lib/industryTaxonomy';
import {
  investorDealOptions,
  normalizeInvestorDealForDb,
  T,
} from '../../lib/labels';

type IndustryTagPickerProps = {
  lang: Lang;
  values: unknown;
  name?: string;
  expandVi?: string;
  expandEn?: string;
  collapseVi?: string;
  collapseEn?: string;
  defaultExpanded?: boolean;
  onChange?: (keys: string[]) => void;
};

type DealTypeTagPickerProps = {
  lang: Lang;
  values: unknown;
  name?: string;
  onChange?: (values: string[]) => void;
};

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function normalizeIndustryKeys(value: unknown): string[] {
  return unique(
    asArray(value)
      .map((item) => industryKeyFromLabel(item))
      .filter(Boolean),
  );
}

function normalizeDealTypes(value: unknown): string[] {
  return unique(
    asArray(value)
      .map((item) => normalizeInvestorDealForDb(item))
      .filter(Boolean),
  );
}

export function IndustryTagPicker({
  lang,
  values,
  name = 'industries',
  expandVi = 'Đầy đủ',
  expandEn = 'Show all',
  collapseVi = 'Thu gọn',
  collapseEn = 'Collapse',
  defaultExpanded = false,
  onChange,
}: IndustryTagPickerProps) {
  const signature = JSON.stringify(asArray(values));
  const normalized = useMemo(
    () => normalizeIndustryKeys(values),
    [signature],
  );
  const [selected, setSelected] = useState<string[]>(normalized);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setSelected(normalized);
  }, [JSON.stringify(normalized)]);

  function toggle(key: string) {
    const next = selected.includes(key)
      ? selected.filter((item) => item !== key)
      : [...selected, key];
    setSelected(next);
    onChange?.(next);
  }

  const options = expanded
    ? industryOptions
    : industryOptions.filter((item) => selected.includes(item.key));

  return (
    <div className="d68-taxonomy-picker">
      <input type="hidden" name={name} value={selected.join(',')} />
      <div className="d68-taxonomy-picker__tags">
        {options.length ? (
          options.map((item) => (
            <button
              key={item.key}
              type="button"
              className={selected.includes(item.key) ? 'active' : ''}
              aria-pressed={selected.includes(item.key)}
              onClick={() => toggle(item.key)}
            >
              {T(lang, item.vi, item.en)}
            </button>
          ))
        ) : (
          <span className="d68-taxonomy-picker__empty">
            {T(lang, 'Chưa chọn ngành', 'No industries selected')}
          </span>
        )}
      </div>
      <button
        type="button"
        className="d68-taxonomy-picker__expand"
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded
          ? T(lang, collapseVi, collapseEn)
          : T(lang, expandVi, expandEn)}
      </button>
    </div>
  );
}

export function DealTypeTagPicker({
  lang,
  values,
  name = 'deal_types',
  onChange,
}: DealTypeTagPickerProps) {
  const signature = JSON.stringify(asArray(values));
  const normalized = useMemo(
    () => normalizeDealTypes(values),
    [signature],
  );
  const [selected, setSelected] = useState<string[]>(normalized);

  useEffect(() => {
    setSelected(normalized);
  }, [JSON.stringify(normalized)]);

  const options = investorDealOptions.map((item) => ({
    value: normalizeInvestorDealForDb(item.en),
    vi: item.vi,
    en: item.en,
  }));

  function toggle(value: string) {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    setSelected(next);
    onChange?.(next);
  }

  return (
    <div className="d68-taxonomy-picker">
      <input type="hidden" name={name} value={selected.join(',')} />
      <div className="d68-taxonomy-picker__tags">
        {options.map((item) => (
          <button
            key={item.value}
            type="button"
            className={selected.includes(item.value) ? 'active' : ''}
            aria-pressed={selected.includes(item.value)}
            onClick={() => toggle(item.value)}
          >
            {T(lang, item.vi, item.en)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Explicit alias used by Register/Dashboard/Admin while preserving the
// original export for existing MAIN call sites.
export const InvestorDealTypeTagPicker = DealTypeTagPicker;
