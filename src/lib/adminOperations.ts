export type AdminQueueCounts = {
  businesses: number;
  investors: number;
  payments: number;
  proposals: number;
  requests: number;
  leads: number;
};

export type AdminTotals = {
  businesses: number;
  investors: number;
  profiles: number;
  payments: number;
  proposals: number;
};

function statusOf(row: any) {
  return String(row?.status || '').trim().toLowerCase();
}

function timeOf(row: any) {
  const value =
    row?.updated_at ||
    row?.sent_at ||
    row?.created_at ||
    row?.pending_submitted_at ||
    0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function isPendingAdminPayment(row: any) {
  return ['pending', 'payment_pending', 'new'].includes(
    statusOf(row),
  );
}

export function isPendingAdminProposal(row: any) {
  return statusOf(row) === 'sent';
}

export function isPendingAdminRequest(row: any) {
  return [
    '',
    'new',
    'pending',
    'requested',
    'submitted',
  ].includes(statusOf(row));
}

export function isPendingAdminLead(row: any) {
  return ![
    'handled',
    'approved',
    'rejected',
    'closed',
    'archived',
  ].includes(statusOf(row));
}

export function sortAdminQueueFirst<T>(
  rows: T[],
  predicate: (row: T) => boolean,
) {
  return [...rows].sort((left, right) => {
    const priority =
      Number(predicate(right)) - Number(predicate(left));
    if (priority) return priority;
    return timeOf(right) - timeOf(left);
  });
}

export function adminRefreshLabel(
  value: string | null | undefined,
) {
  if (!value) return 'Chưa tải dữ liệu';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Chưa tải dữ liệu';

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
