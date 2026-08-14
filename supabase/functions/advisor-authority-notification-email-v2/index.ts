import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || '';
const FROM_EMAIL = Deno.env.get('AUTHORITY_NOTIFICATION_FROM_EMAIL') || 'no-reply@deals68.com';
const FROM_NAME = Deno.env.get('AUTHORITY_NOTIFICATION_FROM_NAME') || 'Deals68';
const BATCH_LIMIT = Math.max(1, Math.min(Number(Deno.env.get('AUTHORITY_NOTIFICATION_BATCH_LIMIT') || '10'), 20));

type Json = Record<string, unknown>;
type Job = {
  job_id: string;
  assignment_id: string;
  alert_key: string;
  alert_code: string;
  severity: string;
  recipient_email: string;
  language_code: 'vi' | 'en' | string;
  attempt_count: number;
  authority_expires_at?: string | null;
  payload?: Json;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}
function objectOf(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
}
function json(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function formatDate(value: unknown, language: string) {
  const raw = text(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
}

function contentFor(job: Job) {
  const language = job.language_code === 'en' ? 'en' : 'vi';
  const payload = objectOf(job.payload);
  const businessName = text(payload.business_name) || (language === 'en' ? 'Business profile' : 'Hồ sơ doanh nghiệp');
  const publicCode = text(payload.business_public_code);
  const expiry = formatDate(job.authority_expires_at || payload.authority_expires_at, language);
  const dashboardUrl = language === 'en' ? 'https://deals68.com/en/dashboard/advisor' : 'https://deals68.com/dashboard/advisor';

  const vi: Record<string, { subject: string; heading: string; message: string }> = {
    expiry_30d: { subject: `Deals68 · Authority sắp hết hạn trong 30 ngày · ${businessName}`, heading: 'Authority sắp hết hạn trong 30 ngày', message: 'Hãy chuẩn bị bằng chứng authority cập nhật. Admin có thể mở tái thẩm định trước ngày hết hạn.' },
    expiry_14d: { subject: `Deals68 · Authority sắp hết hạn trong 14 ngày · ${businessName}`, heading: 'Authority sắp hết hạn trong 14 ngày', message: 'Vui lòng chuẩn bị mandate hoặc bằng chứng authority mới để tránh gián đoạn quyền truy cập Business context.' },
    expiry_7d: { subject: `Deals68 · Authority sắp hết hạn trong 7 ngày · ${businessName}`, heading: 'Authority sắp hết hạn trong 7 ngày', message: 'Authority đang ở ngưỡng cần xử lý sớm. Hãy kiểm tra dashboard và chuẩn bị bằng chứng cập nhật.' },
    expired: { subject: `Deals68 · Authority đã hết hạn · ${businessName}`, heading: 'Authority đã hết hạn', message: 'Business context đã đóng theo lifecycle authority. Admin cần mở tái thẩm định và xác minh mandate mới trước khi quyền truy cập được khôi phục.' },
    rereview_pending: { subject: `Deals68 · Authority đang tái thẩm định · ${businessName}`, heading: 'Authority đang được tái thẩm định', message: 'Business context đang đóng cho đến khi Admin hoàn tất tái thẩm định. Hãy bổ sung bằng chứng nếu được yêu cầu.' },
  };
  const en: Record<string, { subject: string; heading: string; message: string }> = {
    expiry_30d: { subject: `Deals68 · Authority expires within 30 days · ${businessName}`, heading: 'Authority expires within 30 days', message: 'Prepare updated authority evidence. Admin may start re-review before the expiry date.' },
    expiry_14d: { subject: `Deals68 · Authority expires within 14 days · ${businessName}`, heading: 'Authority expires within 14 days', message: 'Please prepare a renewed mandate or other current authority evidence to avoid interruption of Business context access.' },
    expiry_7d: { subject: `Deals68 · Authority expires within 7 days · ${businessName}`, heading: 'Authority expires within 7 days', message: 'This authority is now in the high-priority renewal window. Check your dashboard and prepare updated evidence.' },
    expired: { subject: `Deals68 · Authority has expired · ${businessName}`, heading: 'Authority has expired', message: 'Business context is closed by the authority lifecycle. Admin must open re-review and verify a renewed mandate before access can resume.' },
    rereview_pending: { subject: `Deals68 · Authority re-review pending · ${businessName}`, heading: 'Authority re-review is pending', message: 'Business context is closed until Admin completes re-review. Provide updated evidence when requested.' },
  };

  const copy = (language === 'en' ? en : vi)[job.alert_code] || (language === 'en' ? en.expiry_30d : vi.expiry_30d);
  const metadataLine = [publicCode ? `ID: ${publicCode}` : '', expiry ? `${language === 'en' ? 'Authority expiry' : 'Authority hết hạn'}: ${expiry}` : ''].filter(Boolean).join(' · ');
  const footer = language === 'en'
    ? 'This is an operational authority notification, not a marketing email. Notification preferences do not change authority validity or Business permissions.'
    : 'Đây là email vận hành về authority, không phải email marketing. Tùy chọn nhận email không làm thay đổi hiệu lực authority hoặc quyền Business.';
  const button = language === 'en' ? 'Open Advisor dashboard' : 'Mở Advisor dashboard';
  const plain = [copy.heading, '', businessName, metadataLine, '', copy.message, '', dashboardUrl, '', footer].filter(Boolean).join('\n');
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f2a4a;max-width:640px;margin:0 auto;padding:24px"><div style="font-size:13px;color:#64748b;margin-bottom:8px">Deals68 · Authority</div><h2 style="margin:0 0 16px;color:#0f2a4a">${escapeHtml(copy.heading)}</h2><p style="margin:0 0 8px"><strong>${escapeHtml(businessName)}</strong></p>${metadataLine ? `<p style="margin:0 0 18px;color:#64748b">${escapeHtml(metadataLine)}</p>` : ''}<p style="margin:0 0 24px">${escapeHtml(copy.message)}</p><p style="margin:0 0 24px"><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#1badea;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px">${escapeHtml(button)}</a></p><p style="margin:0;color:#64748b;font-size:12px">${escapeHtml(footer)}</p></div>`;
  return { subject: copy.subject, plain, html };
}

async function sendWithResend(to: string, subject: string, plain: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, text: plain, html }),
  });
  const payload = objectOf(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(`RESEND_${response.status}:${text(payload.message || payload.name).slice(0, 300)}`);
  return { provider: 'resend', messageId: text(payload.id) || null };
}

async function sendWithBrevo(to: string, subject: string, plain: string, html: string) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { name: FROM_NAME, email: FROM_EMAIL }, to: [{ email: to }], subject, textContent: plain, htmlContent: html }),
  });
  const payload = objectOf(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(`BREVO_${response.status}:${text(payload.message || payload.code).slice(0, 300)}`);
  return { provider: 'brevo', messageId: text(payload.messageId) || null };
}

async function sendEmail(to: string, subject: string, plain: string, html: string) {
  if (RESEND_API_KEY) return await sendWithResend(to, subject, plain, html);
  if (BREVO_API_KEY) return await sendWithBrevo(to, subject, plain, html);
  throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(503, { ok: false, error: 'SUPABASE_FUNCTION_ENV_MISSING' });
  }

  const schedulerToken = text(req.headers.get('x-d68-scheduler-token'));
  if (!schedulerToken) return json(403, { ok: false, error: 'SCHEDULER_TOKEN_REQUIRED' });

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authorized, error: authError } = await serviceClient.rpc('d68_notification_scheduler_authorize_v1', {
    p_token: schedulerToken,
  });
  if (authError || authorized !== true) return json(403, { ok: false, error: 'SCHEDULER_TOKEN_INVALID' });

  const { data: claimData, error: claimError } = await serviceClient.rpc('d68_notification_worker_claim_v1', { p_limit: BATCH_LIMIT });
  if (claimError) {
    console.error('authority notification claim failed', { message: text(claimError.message).slice(0, 300) });
    return json(500, { ok: false, error: 'NOTIFICATION_CLAIM_FAILED' });
  }

  const jobs = Array.isArray(claimData?.jobs) ? claimData.jobs as Job[] : [];
  let sent = 0;
  let failed = 0;
  for (const job of jobs) {
    let provider = '';
    try {
      const recipient = text(job.recipient_email).toLowerCase();
      if (!recipient.includes('@')) throw new Error('RECIPIENT_INVALID');
      const content = contentFor(job);
      const delivery = await sendEmail(recipient, content.subject, content.plain, content.html);
      provider = delivery.provider;
      const { error: completeError } = await serviceClient.rpc('d68_notification_worker_complete_v1', {
        p_job_id: job.job_id,
        p_success: true,
        p_provider: delivery.provider,
        p_provider_message_id: delivery.messageId,
        p_error: null,
      });
      if (completeError) throw new Error(`COMPLETE_SUCCESS:${completeError.message}`);
      sent += 1;
    } catch (error) {
      failed += 1;
      const message = text((error as { message?: string })?.message || error).slice(0, 800);
      const { error: failError } = await serviceClient.rpc('d68_notification_worker_complete_v1', {
        p_job_id: job.job_id,
        p_success: false,
        p_provider: provider || null,
        p_provider_message_id: null,
        p_error: message || 'EMAIL_DELIVERY_FAILED',
      });
      if (failError) console.error('authority notification failure transition failed', { jobId: job.job_id, message: text(failError.message).slice(0, 300) });
    }
  }

  return json(200, {
    ok: true,
    claimed: jobs.length,
    sent,
    failed,
    max_batch: BATCH_LIMIT,
    business_mutations_enabled: false,
    authority_mutations_enabled: false,
  });
});
