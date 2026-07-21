import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.45.4';
import { createOpenAiNarrative } from './openai.ts';
import { createReportPdf } from './pdf.ts';
import {
  buildGroundedReportContent,
  reportFileName,
  reportSummaryForAi,
  SOURCE_LABEL,
} from './report.ts';
import type {
  GeneratorMode,
  ReportLanguage,
  ReportPreflight,
  ReportSourceSnapshot,
  SourceFact,
} from './types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const REPORT_BUCKET = 'business-reports-private';
const SIGNED_URL_SECONDS = 120;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Json = Record<string, unknown>;
type AnySupabaseClient = SupabaseClient<any, 'public', any>;

type GenerateBody = {
  action: 'generate';
  business_id: string;
  language?: ReportLanguage;
  request_key?: string;
};

type DownloadBody = {
  action: 'download';
  business_id: string;
  report_id: string;
};

type RequestBody = GenerateBody | DownloadBody;

function text(value: unknown) {
  return String(value ?? '').trim();
}

function objectOf(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function corsHeaders(req: Request) {
  const configured = text(Deno.env.get('REPORT_ALLOWED_ORIGINS'));
  const origin = req.headers.get('origin') || '*';
  const allowed = configured
    ? configured.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  const selected = !allowed.length || allowed.includes('*') || allowed.includes(origin)
    ? origin
    : allowed[0];
  return {
    'Access-Control-Allow-Origin': selected || '*',
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

function errorCode(error: unknown) {
  const row = objectOf(error);
  return text(row.code || row.error_code || row.name) || 'REPORT_WORKER_FAILED';
}

function errorMessage(error: unknown) {
  const row = objectOf(error);
  return text(row.message || row.error_description || error).slice(0, 900) || 'Report worker failed.';
}

function safeRequestKey(value: unknown) {
  const key = text(value);
  if (!key) return crypto.randomUUID();
  return key.replace(/[^a-zA-Z0-9:_-]+/g, '-').slice(0, 180);
}

async function sha256Hex(bytes: Uint8Array) {
  const normalized = new Uint8Array(bytes.byteLength);
  normalized.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', normalized.buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_FUNCTION_ENV_MISSING');
  }
}

function clients(req: Request) {
  assertConfigured();
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

async function authenticatedUser(userClient: AnySupabaseClient) {
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw error || new Error('AUTHENTICATION_REQUIRED');
  return data.user;
}

async function failRequest(
  serviceClient: AnySupabaseClient,
  requestId: string | null,
  code: string,
  message: string,
) {
  if (!requestId) return;
  try {
    await serviceClient.rpc('d68_fail_business_report_request', {
      p_request_id: requestId,
      p_error_code: code.slice(0, 120),
      p_metadata: {
        worker: 'business-ai-report-v1',
        source_label: SOURCE_LABEL,
        failure_message: message.slice(0, 900),
        failed_at: new Date().toISOString(),
      },
    });
  } catch {
    // Failure bookkeeping must never hide the original worker error.
  }
}

async function latestReport(
  userClient: AnySupabaseClient,
  businessId: string,
) {
  const { data, error } = await userClient.rpc('d68_get_latest_business_report', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return data ? objectOf(Array.isArray(data) ? data[0] : data) : null;
}

async function handleGenerate(req: Request, body: GenerateBody) {
  if (!UUID_RE.test(text(body.business_id))) {
    return json(req, 400, { ok: false, error: 'BUSINESS_ID_INVALID' });
  }
  const language: ReportLanguage = body.language === 'en' ? 'en' : 'vi';
  const { userClient, serviceClient } = clients(req);
  const user = await authenticatedUser(userClient);
  let requestId: string | null = null;
  let uploadedPath = '';

  try {
    const { data: reserveData, error: reserveError } = await userClient.rpc(
      'd68_reserve_business_report_request',
      {
        p_business_id: body.business_id,
        p_request_key: safeRequestKey(body.request_key),
      },
    );
    if (reserveError) throw reserveError;
    const reserve = objectOf(Array.isArray(reserveData) ? reserveData[0] : reserveData);
    requestId = text(reserve.request_id) || null;

    if (reserve.allowed !== true) {
      const reason = text(reserve.reason) || 'REPORT_REQUEST_REJECTED';
      if (reason === 'ALREADY_COMPLETED') {
        return json(req, 200, {
          ok: true,
          existing: true,
          source_label: SOURCE_LABEL,
          report: await latestReport(userClient, body.business_id),
        });
      }
      const status = reason === 'RATE_LIMITED' ? 429 : 409;
      return json(req, status, {
        ok: false,
        error: reason,
        retry_after_seconds: reserve.retry_after_seconds || 0,
        next_allowed_at: reserve.next_allowed_at || null,
        preflight: reserve.preflight || null,
      });
    }

    if (!requestId || !UUID_RE.test(requestId)) {
      throw new Error('REPORT_REQUEST_ID_MISSING');
    }

    const [snapshotResult, statusResult, factsResult] = await Promise.all([
      userClient.rpc('d68_get_business_report_source_snapshot', {
        p_business_id: body.business_id,
      }),
      userClient.rpc('d68_get_business_report_status', {
        p_business_id: body.business_id,
      }),
      serviceClient
        .from('dataroom_facts')
        .select(
          'id,business_file_id,fact_kind,field_key,period_key,value_json,normalized_value,unit,currency,confidence,validation_status,page_number,sheet_name,cell_range,source_excerpt',
        )
        .eq('business_id', body.business_id)
        .in('validation_status', ['extracted', 'validated'])
        .order('confidence', { ascending: false })
        .limit(500),
    ]);

    if (snapshotResult.error) throw snapshotResult.error;
    if (statusResult.error) throw statusResult.error;
    if (factsResult.error) throw factsResult.error;

    const snapshot = objectOf(
      Array.isArray(snapshotResult.data) ? snapshotResult.data[0] : snapshotResult.data,
    ) as ReportSourceSnapshot;
    const status = objectOf(Array.isArray(statusResult.data) ? statusResult.data[0] : statusResult.data);
    const preflight = objectOf(status.latest_preflight) as ReportPreflight;
    if (preflight.allow_report !== true) {
      throw new Error('PREFLIGHT_BLOCKED_AFTER_RESERVATION');
    }

    const facts = (factsResult.data || []).map((row) => ({
      ...row,
      confidence: Number(row.confidence || 0),
      normalized_value: row.normalized_value === null ? null : Number(row.normalized_value),
    })) as SourceFact[];

    let generatorMode: GeneratorMode = 'deterministic';
    const aiNarrative = await createOpenAiNarrative({
      language,
      reportInput: reportSummaryForAi(snapshot, preflight, facts),
    }).catch((error) => {
      console.warn('OpenAI narrative fallback', error);
      return null;
    });
    if (aiNarrative) generatorMode = 'openai_assisted';

    const grounded = buildGroundedReportContent({
      snapshot,
      preflight,
      facts,
      language,
      aiNarrative,
      generatorMode,
    });
    const pdfBytes = await createReportPdf(grounded.content);
    if (!pdfBytes.byteLength || pdfBytes.byteLength > 15728640) {
      throw new Error('REPORT_PDF_SIZE_INVALID');
    }

    const reportId = crypto.randomUUID();
    const generatedAt = new Date();
    const fileName = reportFileName(snapshot, generatedAt);
    const monthPath = generatedAt.toISOString().slice(0, 7).replace('-', '/');
    uploadedPath = `${body.business_id}/${monthPath}/${reportId}.pdf`;
    const digest = await sha256Hex(pdfBytes);

    const { error: uploadError } = await serviceClient.storage
      .from(REPORT_BUCKET)
      .upload(uploadedPath, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: 'private, max-age=0, no-store',
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: finalizedData, error: finalizedError } = await serviceClient.rpc(
      'd68_finalize_business_report',
      {
        p_request_id: requestId,
        p_report_id: reportId,
        p_language: language,
        p_report_grade: grounded.content.report_grade,
        p_generator_mode: generatorMode,
        p_source_hash: text(preflight.source_hash) || null,
        p_content_json: grounded.content,
        p_source_manifest_json: grounded.manifest,
        p_storage_path: uploadedPath,
        p_file_name: fileName,
        p_size_bytes: pdfBytes.byteLength,
        p_sha256: digest,
        p_metadata: {
          worker: 'business-ai-report-v1',
          source_label: SOURCE_LABEL,
          generated_by_profile_id: user.id,
          preflight_id: preflight.id || null,
          authority_notice_required: preflight.authority_notice_required === true,
        },
      },
    );
    if (finalizedError) throw finalizedError;

    return json(req, 201, {
      ok: true,
      source_label: SOURCE_LABEL,
      request_id: requestId,
      report_id: reportId,
      file_name: fileName,
      generated_at: grounded.content.generated_at,
      report_grade: grounded.content.report_grade,
      generator_mode: generatorMode,
      size_bytes: pdfBytes.byteLength,
      sha256: digest,
      completion: finalizedData,
    });
  } catch (error) {
    const code = errorCode(error);
    const message = errorMessage(error);
    if (uploadedPath) {
      try {
        await serviceClient.storage.from(REPORT_BUCKET).remove([uploadedPath]);
      } catch {
        // Best-effort orphan cleanup; the request is still marked failed below.
      }
    }
    await failRequest(serviceClient, requestId, code, message);
    console.error('business-ai-report generate failed', code, message);
    return json(req, 500, {
      ok: false,
      error: code,
      message,
      source_label: SOURCE_LABEL,
    });
  }
}

async function handleDownload(req: Request, body: DownloadBody) {
  if (!UUID_RE.test(text(body.business_id)) || !UUID_RE.test(text(body.report_id))) {
    return json(req, 400, { ok: false, error: 'REPORT_DOWNLOAD_ID_INVALID' });
  }
  const { userClient, serviceClient } = clients(req);
  await authenticatedUser(userClient);

  const { data: report, error: reportError } = await userClient
    .from('ai_reports')
    .select('id,business_id,file_name,mime_type,size_bytes,sha256,source_label,generated_at')
    .eq('id', body.report_id)
    .eq('business_id', body.business_id)
    .eq('status', 'completed')
    .maybeSingle();
  if (reportError) throw reportError;
  if (!report) return json(req, 404, { ok: false, error: 'REPORT_NOT_FOUND' });

  const { data: claimData, error: claimError } = await userClient.rpc(
    'd68_claim_business_report_download',
    {
      p_business_id: body.business_id,
      p_report_id: body.report_id,
    },
  );
  if (claimError) throw claimError;
  const claim = objectOf(Array.isArray(claimData) ? claimData[0] : claimData);
  if (claim.allowed !== true) {
    const reason = text(claim.reason) || 'DOWNLOAD_RATE_LIMITED';
    return json(req, reason === 'RATE_LIMITED' ? 429 : 409, {
      ok: false,
      error: reason,
      retry_after_seconds: claim.retry_after_seconds || 0,
      next_allowed_at: claim.next_allowed_at || null,
    });
  }

  const { data: privateReport, error: privateError } = await serviceClient
    .from('ai_reports')
    .select('storage_bucket,storage_path,file_name,source_label')
    .eq('id', body.report_id)
    .eq('business_id', body.business_id)
    .eq('status', 'completed')
    .single();
  if (privateError) throw privateError;

  const { data: signed, error: signedError } = await serviceClient.storage
    .from(privateReport.storage_bucket)
    .createSignedUrl(privateReport.storage_path, SIGNED_URL_SECONDS, {
      download: privateReport.file_name,
    });
  if (signedError || !signed?.signedUrl) throw signedError || new Error('SIGNED_URL_FAILED');

  return json(req, 200, {
    ok: true,
    source_label: privateReport.source_label || SOURCE_LABEL,
    report_id: body.report_id,
    file_name: privateReport.file_name,
    signed_url: signed.signedUrl,
    expires_in_seconds: SIGNED_URL_SECONDS,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return json(req, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (body?.action === 'generate') return await handleGenerate(req, body);
    if (body?.action === 'download') return await handleDownload(req, body);
    return json(req, 400, { ok: false, error: 'ACTION_INVALID' });
  } catch (error) {
    const code = errorCode(error);
    const message = errorMessage(error);
    const status = code.includes('AUTH') ? 401 : 500;
    console.error('business-ai-report request failed', code, message);
    return json(req, status, {
      ok: false,
      error: code,
      message,
      source_label: SOURCE_LABEL,
    });
  }
});
