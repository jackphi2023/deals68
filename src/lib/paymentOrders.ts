import { supabase } from './supabase';

export type PaymentOrderEntity = 'business' | 'investor';

export type CreatePaymentOrderInput = {
  entity: PaymentOrderEntity;
  entityId: string;
  profileId: string;
  title: string;
  payload: Record<string, any>;
  orderCode: string;
};

export type PaymentOrderStatus = 'confirmed' | 'rejected';

function randomPart() {
  const uuid =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random()}-${Math.random()}`;

  return uuid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase();
}

export function normalisePaymentOrderCode(value: unknown) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 40);
}

export function makePaymentOrderCode(prefix: string) {
  const safePrefix =
    String(prefix || 'PAY')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10) || 'PAY';

  return normalisePaymentOrderCode(
    `D68-${safePrefix}-${Date.now().toString(36).toUpperCase()}-${randomPart()}`,
  );
}

export function paymentOrderCode(row: any) {
  return normalisePaymentOrderCode(
    row?.order_code ||
      row?.payload?.orderCode ||
      row?.payload?.bankContent ||
      '',
  );
}

export async function createOwnPaymentOrder(
  input: CreatePaymentOrderInput,
) {
  const orderCode = normalisePaymentOrderCode(input.orderCode);
  if (orderCode.length < 6) {
    throw new Error('Payment order code is invalid.');
  }

  const entityColumn =
    input.entity === 'business'
      ? { business_id: input.entityId, investor_id: null }
      : { business_id: null, investor_id: input.entityId };

  const payload = {
    ...(input.payload || {}),
    orderCode,
    bankContent: orderCode,
  };

  const createResult = await supabase
    .from('payment_orders')
    .insert({
      ...entityColumn,
      profile_id: input.profileId,
      created_by: input.profileId,
      status: 'pending',
      title: input.title,
      payload,
      order_code: orderCode,
      visibility: 'private',
      sort_order: 0,
    })
    .select(
      'id,order_code,status,title,payload,business_id,investor_id,' +
        'profile_id,created_at,updated_at',
    )
    .single();

  const { data, error } = createResult as unknown as {
    data: Record<string, any> | null;
    error: { message?: string } | null;
  };

  if (error) throw error;
  if (!data?.id || !paymentOrderCode(data)) {
    throw new Error('Payment order was not confirmed by the database.');
  }

  return data;
}

export async function adminSetPaymentOrderStatus(
  paymentId: string,
  status: PaymentOrderStatus,
) {
  const rpcResult = await supabase.rpc(
    'admin_set_payment_order_status',
    {
      payment_uuid: paymentId,
      new_status_text: status,
    },
  );

  const { data, error } = rpcResult as unknown as {
    data: Record<string, any> | null;
    error: { message?: string } | null;
  };

  if (error) throw error;
  if (!data || data.status !== status) {
    throw new Error('Payment status was not confirmed by the database.');
  }

  return data;
}

export function formatServiceExpiry(
  value: unknown,
  locale = 'vi-VN',
) {
  const raw = String(value || '').trim();
  if (!raw) return '—';

  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return '—';

  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
