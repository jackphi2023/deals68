import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || '';
const ACTIVATION_URL = Deno.env.get('PARTNER_ACTIVATION_URL') || 'https://deals68.com/market-partner/login?activate=1';
const FROM_EMAIL = Deno.env.get('PARTNER_ACTIVATION_FROM_EMAIL') || 'no-reply@deals68.com';
const FROM_NAME = Deno.env.get('PARTNER_ACTIVATION_FROM_NAME') || 'Deals68';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Json = Record<string, unknown>;

type RequestBody = {
  partner_id?: string;
  force?: boolean;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectOf(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Json
    : {};
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*';
  const configured = text(Deno.env.get('PARTNER_ACTIVATION_ALLOWED_ORIGINS'));
  const allowed = configured
    ? configured.split(',').map((item) => item.trim()).filter(Boolean)
    : ['*'];
  const selected = allowed.includes('*') || allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': selected || 'https://deals68.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(req: Request, status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function clients(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_FUNCTION_ENV_MISSING');
  }
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('AUTHORIZATION_REQUIRED');
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { userClient, serviceClient };
}

function emailContent(email: string, affiliateCode: string) {
  const subject = 'Deals68 - Tài khoản Đối tác thị trường đã được duyệt';
  const plain = [
    'Tài khoản Market Partner của bạn đã được duyệt.',
    '',
    `Email: ${email}`,
    `Mã kích hoạt: ${affiliateCode}`,
    '',
    'Vui lòng truy cập:',
    ACTIVATION_URL,
    '',
    'Bạn tự đặt mật khẩu tại trang kích hoạt. Deals68 không gửi hoặc lưu mật khẩu tạm qua email.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f2a4a;max-width:640px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 16px;color:#0f2a4a">Tài khoản Market Partner của bạn đã được duyệt.</h2>
      <p style="margin:8px 0"><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p style="margin:8px 0"><strong>Mã kích hoạt:</strong> ${escapeHtml(affiliateCode)}</p>
      <p style="margin:24px 0 12px">Vui lòng truy cập:</p>
      <p style="margin:0 0 24px"><a href="${escapeHtml(ACTIVATION_URL)}" style="display:inline-block;background:#1badea;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px">Kích hoạt tài khoản</a></p>
      <p style="margin:0;color:#526274">Bạn tự đặt mật khẩu tại trang kích hoạt. Deals68 không gửi hoặc lưu mật khẩu tạm qua email.</p>
    </div>
  `;
  return { subject, plain, html };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function sendWithResend(to: string, subject: string, plain: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      text: plain,
      html,
    }),
  });
  const payload = objectOf(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(`RESEND_${response.status}:${text(payload.message || payload.name).slice(0, 300)}`);
  }
  return { provider: 'resend', messageId: text(payload.id) || null };
}

async function sendWithBrevo(to: string, subject: string, plain: string, html: string) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      textContent: plain,
      htmlContent: html,
    }),
  });
  const payload = objectOf(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(`BREVO_${response.status}:${text(payload.message || payload.code).slice(0, 300)}`);
  }
  return { provider: 'brevo', messageId: text(payload.messageId) || null };
}

async function sendEmail(to: string, subject: string, plain: string, html: string) {
  if (RESEND_API_KEY) return await sendWithResend(to, subject, plain, html);
  if (BREVO_API_KEY) return await sendWithBrevo(to, subject, plain, html);
  throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });

  let actorId = '';
  let partnerId = '';
  try {
    const { userClient, serviceClient } = clients(req);
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json(req, 401, { ok: false, error: 'AUTHENTICATION_REQUIRED' });
    actorId = authData.user.id;

    const { data: actorProfile, error: actorError } = await serviceClient
      .from('profiles')
      .select('role,status')
      .eq('id', actorId)
      .maybeSingle();
    if (actorError || actorProfile?.role !== 'admin' || actorProfile?.status !== 'active') {
      return json(req, 403, { ok: false, error: 'ADMIN_REQUIRED' });
    }

    const body = await req.json() as RequestBody;
    partnerId = text(body.partner_id);
    const force = body.force === true;
    if (!UUID_RE.test(partnerId)) return json(req, 400, { ok: false, error: 'PARTNER_ID_INVALID' });

    const { data: partner, error: partnerError } = await serviceClient
      .from('market_partners')
      .select('id,display_name,contact_email,affiliate_code,status,profile_id')
      .eq('id', partnerId)
      .maybeSingle();
    if (partnerError) throw partnerError;
    if (!partner) return json(req, 404, { ok: false, error: 'PARTNER_NOT_FOUND' });
    if (partner.status !== 'active') return json(req, 409, { ok: false, error: 'PARTNER_NOT_ACTIVE' });
    if (partner.profile_id) return json(req, 409, { ok: false, error: 'PARTNER_ALREADY_ACTIVATED' });

    const { data: previousSends, error: previousError } = await serviceClient
      .from('audit_logs')
      .select('created_at,detail')
      .eq('action', 'send_market_partner_activation_email')
      .eq('entity_type', 'market_partner')
      .eq('entity_id', partnerId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (previousError) throw previousError;
    const previous = previousSends?.[0];
    if (previous && !force) {
      return json(req, 200, { ok: true, skipped: true, reason: 'already_sent', sent_at: previous.created_at });
    }
    if (previous && force) {
      const previousAt = new Date(previous.created_at).getTime();
      if (Number.isFinite(previousAt) && Date.now() - previousAt < 60_000) {
        return json(req, 429, { ok: false, error: 'EMAIL_SEND_COOLDOWN', message: 'Vui lòng chờ 60 giây trước khi gửi lại.' });
      }
    }

    const email = text(partner.contact_email).toLowerCase();
    const affiliateCode = text(partner.affiliate_code).toUpperCase();
    if (!email.includes('@') || affiliateCode.length < 4) {
      return json(req, 422, { ok: false, error: 'PARTNER_ACTIVATION_DATA_INVALID' });
    }

    const content = emailContent(email, affiliateCode);
    const delivery = await sendEmail(email, content.subject, content.plain, content.html);

    const { error: auditError } = await serviceClient.from('audit_logs').insert({
      actor_id: actorId,
      action: 'send_market_partner_activation_email',
      entity_type: 'market_partner',
      entity_id: partnerId,
      detail: {
        recipient: email,
        affiliate_code: affiliateCode,
        provider: delivery.provider,
        provider_message_id: delivery.messageId,
        activation_url: ACTIVATION_URL,
        forced_resend: force,
        sent_at: new Date().toISOString(),
      },
    });
    if (auditError) throw auditError;

    return json(req, 200, {
      ok: true,
      partner_id: partnerId,
      recipient: email,
      provider: delivery.provider,
      message_id: delivery.messageId,
    });
  } catch (error) {
    const message = text((error as { message?: string })?.message || error);
    console.error('market-partner-activation-email failed', { actorId, partnerId, message });
    return json(req, message.includes('AUTHORIZATION') ? 401 : message === 'EMAIL_PROVIDER_NOT_CONFIGURED' ? 503 : 500, {
      ok: false,
      error: message === 'EMAIL_PROVIDER_NOT_CONFIGURED' ? message : 'ACTIVATION_EMAIL_SEND_FAILED',
      message: message === 'EMAIL_PROVIDER_NOT_CONFIGURED'
        ? 'Chưa cấu hình RESEND_API_KEY hoặc BREVO_API_KEY cho Supabase Edge Function.'
        : 'Không thể gửi email kích hoạt. Vui lòng kiểm tra cấu hình email và thử lại.',
    });
  }
});
