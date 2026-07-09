import { supabase } from './supabase';
import type { Lang } from './i18n';
import { businessProposalQuotaForPlan } from './businessPlans';

export type ProposalStatus = 'sent' | 'approved' | 'declined' | 'request_data' | 'connected';
export type ProposalSendReason = 'duplicate' | 'quota_exceeded' | 'missing_profile' | 'error';

export type ProposalSendResult = {
  ok: boolean;
  reason?: ProposalSendReason;
  proposal?: any;
  quotaTotal?: number;
  quotaUsed?: number;
  remainingQuota?: number;
  message?: string;
};

const VALID_STATUSES: ProposalStatus[] = ['sent', 'approved', 'declined', 'request_data', 'connected'];

function cleanText(value: any) {
  return String(value ?? '').trim();
}

export function proposalQuotaTotal(business: any) {
  return businessProposalQuotaForPlan(business?.plan);
}

export function proposalStatusLabel(status: any, lang: Lang = 'vi') {
  const value = cleanText(status || 'sent') as ProposalStatus;
  const map: Record<ProposalStatus, { vi: string; en: string; cls: 'blue' | 'green' | 'gold' | 'red' }> = {
    sent: { vi: 'Chưa duyệt', en: 'Sent', cls: 'blue' },
    approved: { vi: 'Đã duyệt', en: 'Approved', cls: 'green' },
    declined: { vi: 'Bỏ qua', en: 'Declined', cls: 'red' },
    request_data: { vi: 'Yêu cầu tài liệu', en: 'Data requested', cls: 'gold' },
    connected: { vi: 'Đã kết nối', en: 'Connected', cls: 'green' },
  };
  const item = map[VALID_STATUSES.includes(value) ? value : 'sent'];
  return { label: lang === 'en' ? item.en : item.vi, cls: item.cls };
}

export async function getBusinessProposalForInvestor(businessId: string, investorId: string) {
  if (!businessId || !investorId) return null;
  const { data, error } = await supabase
    .from('proposals')
    .select('id,business_id,investor_id,status,sent_at,updated_at,message')
    .eq('business_id', businessId)
    .eq('investor_id', investorId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function listBusinessProposalStatuses(businessId: string) {
  if (!businessId) return [];
  const { data, error } = await supabase
    .from('proposals')
    .select('id,investor_id,status,sent_at,updated_at')
    .eq('business_id', businessId)
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function countBusinessProposals(businessId: string) {
  const { data, error } = await supabase
    .from('proposals')
    .select('investor_id,status')
    .eq('business_id', businessId);
  if (error) throw error;
  return new Set((data || []).map((row: any) => String(row.investor_id || '').trim()).filter(Boolean)).size;
}

async function fetchProposalByIdOrPair(id: any, businessId: string, investorId: string) {
  if (id) {
    const { data } = await supabase
      .from('proposals')
      .select('id,business_id,investor_id,status,sent_at,updated_at,message')
      .eq('id', id)
      .maybeSingle()
      .catch(() => ({ data: null } as any));
    if (data) return data;
  }
  return getBusinessProposalForInvestor(businessId, investorId).catch(() => null);
}

export async function sendBusinessProposalToInvestor(input: {
  business?: any;
  businessId?: string;
  investorId: string;
  message?: string;
}): Promise<ProposalSendResult> {
  const businessId = cleanText(input.businessId || input.business?.id);
  const investorId = cleanText(input.investorId);
  if (!businessId || !investorId) {
    return { ok: false, reason: 'missing_profile', message: 'Missing business or investor profile.' };
  }

  const [existing, sentCount] = await Promise.all([
    getBusinessProposalForInvestor(businessId, investorId).catch(() => null),
    countBusinessProposals(businessId).catch(() => Number(input.business?.quota_used || 0)),
  ]);

  const quotaTotal = proposalQuotaTotal(input.business);
  const quotaUsed = Number(sentCount || 0);
  const remainingQuota = Math.max(0, quotaTotal - quotaUsed);

  if (existing) {
    return { ok: true, reason: 'duplicate', proposal: existing, quotaTotal, quotaUsed, remainingQuota };
  }

  if (quotaUsed >= quotaTotal) {
    return { ok: false, reason: 'quota_exceeded', quotaTotal, quotaUsed, remainingQuota: 0 };
  }

  const sentAt = new Date().toISOString();
  const message = input.message || `Business profile sent from Deals68 on ${sentAt}`;

  const rpc = await supabase
    .rpc('submit_business_proposal', { business_uuid: businessId, investor_uuid: investorId, proposal_note: message })
    .catch((error: any) => ({ data: null, error }));

  if (!rpc.error) {
    const proposal = await fetchProposalByIdOrPair(rpc.data, businessId, investorId);
    return {
      ok: true,
      proposal: proposal || { id: rpc.data, business_id: businessId, investor_id: investorId, status: 'sent', sent_at: sentAt, message },
      quotaTotal,
      quotaUsed: quotaUsed + 1,
      remainingQuota: Math.max(0, remainingQuota - 1),
    };
  }

  const { data, error } = await supabase
    .from('proposals')
    .insert({ business_id: businessId, investor_id: investorId, message, status: 'sent', sent_at: sentAt })
    .select('id,business_id,investor_id,status,sent_at,updated_at,message')
    .single();

  if (error) {
    const text = cleanText(error.message).toLowerCase();
    if (text.includes('duplicate') || text.includes('unique')) {
      const duplicate = await getBusinessProposalForInvestor(businessId, investorId).catch(() => null);
      return { ok: true, reason: 'duplicate', proposal: duplicate, quotaTotal, quotaUsed, remainingQuota };
    }
    return { ok: false, reason: 'error', quotaTotal, quotaUsed, remainingQuota, message: error.message };
  }

  return { ok: true, proposal: data, quotaTotal, quotaUsed: quotaUsed + 1, remainingQuota: Math.max(0, remainingQuota - 1) };
}

export async function updateProposalStatus(proposalId: string, status: ProposalStatus) {
  const safeStatus = VALID_STATUSES.includes(status) ? status : 'sent';
  const { data, error } = await supabase
    .from('proposals')
    .update({ status: safeStatus, updated_at: new Date().toISOString() })
    .eq('id', proposalId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
