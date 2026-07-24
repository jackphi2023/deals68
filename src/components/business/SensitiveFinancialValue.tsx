import {
  useId,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import type { Lang } from '../../lib/i18n';

export type SensitiveFinancialSource =
  | 'proposal'
  | 'data_request'
  | 'owner'
  | 'admin'
  | string
  | null
  | undefined;

type Props = {
  lang: Lang;
  value?: ReactNode;
  isAuthorized?: boolean;
  hasData?: boolean;
  requestStatus?: string | null;
  source?: SensitiveFinancialSource;
  compact?: boolean;
  className?: string;
};

function text(lang: Lang, vi: string, en: string) {
  return lang === 'en' ? en : vi;
}

function normalizedSource(source: SensitiveFinancialSource) {
  const value = String(source || '').trim().toLowerCase();
  return value === 'data-request' ? 'data_request' : value;
}

export default function SensitiveFinancialValue({
  lang,
  value,
  isAuthorized = false,
  hasData = true,
  requestStatus,
  source,
  compact = false,
  className = '',
}: Props) {
  const tooltipId = useId();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasExactValue =
    isAuthorized &&
    value !== null &&
    value !== undefined &&
    String(value).trim() !== '';
  const pending =
    !hasExactValue &&
    ['pending', 'forwarded'].includes(
      String(requestStatus || '').trim().toLowerCase(),
    );
  const restricted = !hasExactValue && hasData;
  const sourceType = normalizedSource(source);

  if (!hasExactValue && !hasData && !pending) {
    return (
      <span className={`d68-sensitive-financial is-empty ${className}`.trim()}>
        {text(lang, 'Đang cập nhật', 'Pending')}
      </span>
    );
  }

  const explanation = pending
    ? text(
        lang,
        'Yêu cầu số liệu đang chờ doanh nghiệp chấp thuận.',
        'Your financial data request is awaiting Business approval.',
      )
    : text(
        lang,
        'Chỉ nhà đầu tư được doanh nghiệp gửi Proposal hoặc được doanh nghiệp chấp thuận yêu cầu dữ liệu mới xem được.',
        'Only investors who receive a Proposal from the Business or whose data request is approved by the Business can view this information.',
      );

  const badge =
    hasExactValue && sourceType === 'proposal'
      ? text(
          lang,
          'Được doanh nghiệp chia sẻ qua Proposal.',
          'Shared by the Business through a Proposal.',
        )
      : hasExactValue && sourceType === 'data_request'
        ? text(
            lang,
            'Doanh nghiệp đã cấp quyền xem số liệu.',
            'The Business has granted access to this information.',
          )
        : '';

  function toggle(event: MouseEvent<HTMLSpanElement>) {
    if (!restricted && !pending) return;
    event.preventDefault();
    event.stopPropagation();
    setMobileOpen((current) => !current);
  }

  function handleKey(event: KeyboardEvent<HTMLSpanElement>) {
    if (!restricted && !pending) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    setMobileOpen((current) => !current);
  }

  return (
    <span
      className={[
        'd68-sensitive-financial',
        compact ? 'is-compact' : '',
        hasExactValue ? 'is-authorized' : pending ? 'is-pending' : 'is-restricted',
        mobileOpen ? 'is-open' : '',
        className,
      ].filter(Boolean).join(' ')}
      tabIndex={restricted || pending ? 0 : undefined}
      aria-label={restricted || pending ? explanation : undefined}
      aria-describedby={restricted || pending ? tooltipId : undefined}
      onClick={toggle}
      onKeyDown={handleKey}
    >
      {hasExactValue ? (
        <span className="d68-sensitive-financial__value">{value}</span>
      ) : (
        <span className="d68-sensitive-financial__placeholder" aria-hidden="true">
          ██████████
        </span>
      )}
      {restricted || pending ? (
        <span className="d68-sensitive-financial__info" aria-hidden="true">i</span>
      ) : null}
      {badge ? <small className="d68-sensitive-financial__badge">✓ {badge}</small> : null}
      {restricted || pending ? (
        <span id={tooltipId} role="tooltip" className="d68-sensitive-financial__tooltip">
          {explanation}
        </span>
      ) : null}
    </span>
  );
}
