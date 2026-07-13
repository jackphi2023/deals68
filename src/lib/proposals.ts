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
  const base = businessProposalQuotaForPlan(business?.plan);
  const explicit = Number(business?.quota_total || 0);
  // quota_total is an Admin override. Allow lower or higher than plan defaults.
  // Empty/0/invalid values still fall back to the plan default for legacy rows.
  return Number.isFinite(explicit) && explicit > 0 ? explicit : base;
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
    .rpc('submit_business_proposal', {
      business_uuid: businessId,
      investor_uuid: investorId,
      proposal_note: message,
    })
    .catch((error: any) => ({ data: null, error }));

  if (rpc.error) {
    const errorText = cleanText(rpc.error?.message || rpc.error).toLowerCase();
    if (errorText.includes('quota') || errorText.includes('hạn mức')) {
      return {
        ok: false,
        reason: 'quota_exceeded',
        quotaTotal,
        quotaUsed,
        remainingQuota: 0,
        message: rpc.error?.message || 'Proposal quota exceeded.',
      };
    }
    return {
      ok: false,
      reason: 'error',
      quotaTotal,
      quotaUsed,
      remainingQuota,
      message: rpc.error?.message || 'Could not submit Proposal.',
    };
  }

  const [proposal, refreshedCount] = await Promise.all([
    fetchProposalByIdOrPair(rpc.data, businessId, investorId),
    countBusinessProposals(businessId).catch(() => quotaUsed + 1),
  ]);
  const nextUsed = Number(refreshedCount || 0);

  return {
    ok: true,
    proposal: proposal || {
      id: rpc.data,
      business_id: businessId,
      investor_id: investorId,
      status: 'sent',
      sent_at: sentAt,
      message,
    },
    quotaTotal,
    quotaUsed: nextUsed,
    remainingQuota: Math.max(0, quotaTotal - nextUsed),
  };
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
