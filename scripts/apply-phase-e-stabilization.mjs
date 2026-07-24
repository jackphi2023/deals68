#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = process.argv[2];
if (!migrationPath) throw new Error('Migration path is required.');

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
function replaceOnce(file, from, to) {
  const source = read(file);
  if (!source.includes(from)) throw new Error(`Anchor not found in ${file}: ${from.slice(0, 120)}`);
  write(file, source.replace(from, to));
}

const migrationSql = `-- Deals68 Business Financial Access — Phase E stabilization.
-- Aligns Dataroom file metadata and private Storage reads with the canonical
-- Business-specific access-grant ledger. This migration never creates or
-- backfills a Dataroom grant and does not implement or bypass eNDA.

begin;

create or replace function public.get_business_file_metadata_for_viewer(
  business_uuid uuid
)
returns table(
  id uuid,
  business_id uuid,
  display_name text,
  file_type text,
  size_bytes bigint,
  category text,
  privacy_level text,
  public_visible boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    f.id,
    f.business_id,
    f.display_name,
    f.file_type,
    f.size_bytes,
    f.category,
    f.privacy_level,
    f.public_visible,
    f.created_at,
    f.updated_at
  from public.business_files f
  join public.businesses b on b.id = f.business_id
  where f.business_id = business_uuid
    and f.public_visible is true
    and f.review_status = 'approved'
    and nullif(trim(coalesce(f.display_name, '')), '') is not null
    and b.visible = true
    and b.status = 'active'::public.account_status
    and b.public_snapshot_json is not null
    and (
      coalesce(auth.jwt()->>'role', '') = 'service_role'
      or public.is_admin()
      or b.owner_id = auth.uid()
      or exists (
        select 1
        from public.investors i
        join public.business_financial_access_grants g
          on g.investor_id = i.id
         and g.business_id = f.business_id
        where i.owner_id = auth.uid()
          and i.status::text in ('active', 'hidden')
          and g.status = 'active'
          and (g.expires_at is null or g.expires_at > now())
          and 'dataroom' = any(g.scopes)
      )
    )
  order by f.created_at desc;
$function$;

revoke all on function public.get_business_file_metadata_for_viewer(uuid)
from public, anon;
grant execute on function public.get_business_file_metadata_for_viewer(uuid)
to authenticated, service_role;

alter table public.business_files enable row level security;

drop policy if exists "files select owner admin or approved connected"
on public.business_files;
drop policy if exists "files select owner admin or active dataroom grant"
on public.business_files;
create policy "files select owner admin or active dataroom grant"
on public.business_files
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_admin()
  or (
    public_visible is true
    and review_status = 'approved'
    and exists (
      select 1
      from public.investors i
      join public.business_financial_access_grants g
        on g.investor_id = i.id
       and g.business_id = business_files.business_id
      where i.owner_id = auth.uid()
        and i.status::text in ('active', 'hidden')
        and g.status = 'active'
        and (g.expires_at is null or g.expires_at > now())
        and 'dataroom' = any(g.scopes)
    )
  )
);

create or replace function public.d68_get_business_dataroom_file_access(
  p_file_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $function$
declare
  actor_uuid uuid := auth.uid();
  service_actor boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
  file_row public.business_files%rowtype;
  business_owner uuid;
  resolved_investor_id uuid;
  grant_row public.business_financial_access_grants%rowtype;
  access_source text;
begin
  if actor_uuid is null and not service_actor then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select f.*, b.owner_id
  into file_row, business_owner
  from public.business_files f
  join public.businesses b on b.id = f.business_id
  where f.id = p_file_id;

  if not found then
    raise exception 'Business file not found' using errcode = 'P0002';
  end if;

  if service_actor or public.is_admin() then
    access_source := 'admin';
  elsif business_owner = actor_uuid then
    access_source := 'owner';
  else
    select i.id
    into resolved_investor_id
    from public.investors i
    where i.owner_id = actor_uuid
      and i.status::text in ('active', 'hidden')
    order by i.created_at asc nulls last, i.id
    limit 1;

    if resolved_investor_id is null
       or file_row.public_visible is not true
       or file_row.review_status <> 'approved' then
      raise exception 'Dataroom access required' using errcode = '42501';
    end if;

    select g.*
    into grant_row
    from public.business_financial_access_grants g
    where g.business_id = file_row.business_id
      and g.investor_id = resolved_investor_id
      and g.status = 'active'
      and (g.expires_at is null or g.expires_at > now())
      and 'dataroom' = any(g.scopes)
    order by g.granted_at desc, g.id
    limit 1;

    if not found then
      raise exception 'Dataroom access required' using errcode = '42501';
    end if;

    access_source := grant_row.source_type;
  end if;

  if actor_uuid is not null then
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, detail
    ) values (
      actor_uuid,
      'access_business_dataroom_file',
      'business_file',
      file_row.id::text,
      jsonb_build_object(
        'business_id', file_row.business_id,
        'investor_id', resolved_investor_id,
        'file_id', file_row.id,
        'privacy_level', file_row.privacy_level,
        'access_source', access_source,
        'grant_id', grant_row.id,
        'grant_expires_at', grant_row.expires_at
      )
    );
  end if;

  return jsonb_build_object(
    'file_id', file_row.id,
    'business_id', file_row.business_id,
    'file_path', file_row.file_path,
    'file_name', file_row.file_name,
    'display_name', file_row.display_name,
    'file_type', file_row.file_type,
    'size_bytes', file_row.size_bytes,
    'access_source', access_source,
    'grant_id', grant_row.id,
    'expires_at', grant_row.expires_at
  );
end;
$function$;

revoke all on function public.d68_get_business_dataroom_file_access(uuid)
from public, anon;
grant execute on function public.d68_get_business_dataroom_file_access(uuid)
to authenticated, service_role;

comment on function public.d68_get_business_dataroom_file_access(uuid) is
  'Audited file-path gate. Investor access requires an active, unexpired Business-specific dataroom scope and an approved file. No grant is inferred from Proposal or financial_detail.';

do $storage_policy$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "business files select owned or approved connected" on storage.objects';
    execute 'drop policy if exists "business files select owner admin or active dataroom grant" on storage.objects';
    execute $policy$
      create policy "business files select owner admin or active dataroom grant"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'business-files-private'
        and (
          public.is_admin()
          or exists (
            select 1
            from public.businesses b
            where b.id::text = (storage.foldername(objects.name))[1]
              and b.owner_id = auth.uid()
          )
          or exists (
            select 1
            from public.business_files f
            join public.investors i on i.owner_id = auth.uid()
            join public.business_financial_access_grants g
              on g.business_id = f.business_id
             and g.investor_id = i.id
            where f.file_path = objects.name
              and f.public_visible is true
              and f.review_status = 'approved'
              and i.status::text in ('active', 'hidden')
              and g.status = 'active'
              and (g.expires_at is null or g.expires_at > now())
              and 'dataroom' = any(g.scopes)
          )
        )
      )
    $policy$;
  end if;
end;
$storage_policy$;

-- Deliberately no INSERT/UPDATE into business_financial_access_grants.
-- Current production has no active Dataroom grants; eNDA/grant issuance remains a separate release.

commit;
`;
write(migrationPath, migrationSql);
const migrationName = path.basename(migrationPath);

const serviceFile = 'src/lib/businessFinancialAccess.ts';
replaceOnce(serviceFile,
`export type FinancialAccessRequestResult = {
  request_id: string;
  business_id: string;
  investor_id: string;
  status: string;
  requested_scopes: FinancialAccessScope[];
  existing: boolean;
};
`,
`export type FinancialAccessRequestResult = {
  request_id: string;
  business_id: string;
  investor_id: string;
  status: string;
  requested_scopes: FinancialAccessScope[];
  existing: boolean;
};

export type FinancialAccessSnapshot = {
  business_id: string;
  investor_id: string | null;
  access_level: 'none' | 'summary' | 'detail';
  scopes: FinancialAccessScope[];
  has_financial_summary: boolean;
  has_financial_detail: boolean;
  has_dataroom: boolean;
  sources: Array<{ grant_id?: string; source_type?: string; source_id?: string; expires_at?: string | null }>;
  expires_at: string | null;
  proposal_status: string | null;
  request_status: string | null;
};

export type DataroomFileAccessResult = {
  file_id: string;
  business_id: string;
  file_path: string;
  file_name: string;
  display_name?: string | null;
  file_type?: string | null;
  size_bytes?: number | null;
  access_source: string;
  grant_id?: string | null;
  expires_at?: string | null;
};
`);
replaceOnce(serviceFile,
`  if (value.includes('financial access grant not found')) {
    return T(lang, 'Quyền truy cập không còn tồn tại hoặc đã được xử lý.', 'The access grant no longer exists or has already been processed.');
  }
`,
`  if (value.includes('financial access grant not found')) {
    return T(lang, 'Quyền truy cập không còn tồn tại hoặc đã được xử lý.', 'The access grant no longer exists or has already been processed.');
  }
  if (value.includes('business file not found')) {
    return T(lang, 'Tài liệu không còn tồn tại.', 'The document is no longer available.');
  }
  if (value.includes('dataroom access required')) {
    return T(
      lang,
      'Tài liệu chỉ mở khi doanh nghiệp cấp quyền Dataroom còn hiệu lực. Quyền xem số liệu tài chính không tự động mở tệp.',
      'This document requires an active Dataroom grant from the Business. Financial access does not automatically unlock files.',
    );
  }
`);
replaceOnce(serviceFile,
`export async function respondBusinessFinancialRequest(params: {
`,
`export async function getBusinessFinancialAccess(
  businessId: string,
): Promise<FinancialAccessSnapshot> {
  const { data, error } = await supabase.rpc('d68_get_business_financial_access', {
    p_business_id: businessId,
  });
  if (error) throw error;
  return data as FinancialAccessSnapshot;
}

export async function getBusinessDataroomFileAccess(
  fileId: string,
): Promise<DataroomFileAccessResult> {
  const { data, error } = await supabase.rpc('d68_get_business_dataroom_file_access', {
    p_file_id: fileId,
  });
  if (error) throw error;
  return data as DataroomFileAccessResult;
}

export async function respondBusinessFinancialRequest(params: {
`);

const detailFile = 'src/pages/BusinessDetail.tsx';
replaceOnce(detailFile,
`import { financialAccessErrorMessage, requestBusinessFinancialAccess } from '../lib/businessFinancialAccess';
`,
`import { financialAccessErrorMessage, getBusinessDataroomFileAccess, getBusinessFinancialAccess, requestBusinessFinancialAccess } from '../lib/businessFinancialAccess';
`);
replaceOnce(detailFile,
`        let canDownload = false;
        if (profile?.role === 'investor') {
          const inv = await getInvestorByOwner(profile.id).catch(() => null);
          if (inv?.id) {
            const proposal = await supabase
              .from('proposals')
              .select('id,status')
              .eq('business_id', b.id)
              .eq('investor_id', inv.id)
              .in('status', ['approved','connected'])
              .limit(1)
              .maybeSingle()
              .catch(() => ({ data: null } as any));
            canDownload = !!proposal.data;
          }
        }
        if (!live) return;
        setInvestorAccess(canDownload);
`,
`        let canDownload = profile?.role === 'admin' || ownerViewing;
        if (profile?.role === 'investor') {
          const access = await getBusinessFinancialAccess(b.id).catch(() => null);
          canDownload = Boolean(access?.has_dataroom);
        }
        if (!live) return;
        setInvestorAccess(canDownload);
`);
replaceOnce(detailFile,
`  async function downloadDoc(doc: Doc) {
    if (!investorAccess || !doc.file_path) { await requestData(); return; }
    const { data, error } = await supabase.storage.from('business-files-private').createSignedUrl(doc.file_path, 60 * 5);
    if (error || !data?.signedUrl) { setMsg(error?.message || T(lang, 'Chưa tạo được link tải tài liệu.', 'Could not create document download link.')); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
`,
`  async function downloadDoc(doc: Doc) {
    const canOpenDataroom = investorAccess || isOwnerBusiness || profile?.role === 'admin';
    if (!canOpenDataroom) {
      setMsg(T(
        lang,
        'Tài liệu yêu cầu quyền Dataroom riêng. Quyền xem số liệu tài chính không tự động mở tệp.',
        'Documents require a separate Dataroom grant. Financial access does not automatically unlock files.',
      ));
      return;
    }
    if (!doc.id) {
      setMsg(T(lang, 'Không tìm thấy tài liệu.', 'Document not found.'));
      return;
    }
    try {
      const fileAccess = await getBusinessDataroomFileAccess(String(doc.id));
      const { data, error } = await supabase.storage
        .from('business-files-private')
        .createSignedUrl(fileAccess.file_path, 60);
      if (error || !data?.signedUrl) throw error || new Error('Signed URL unavailable');
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (downloadError: any) {
      setMsg(financialAccessErrorMessage(lang, downloadError));
    }
  }
`);

const qaFile = 'scripts/deals68-business-financial-release-phase-e-check.mjs';
write(qaFile, `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const read = (file) => fs.readFileSync(file, 'utf8');
const migrations = fs.readdirSync('supabase/migrations').filter((name) => name.endsWith('_business_dataroom_access_phase_e_stabilization.sql'));
check(migrations.length === 1, 'Exactly one Phase E Dataroom stabilization migration must exist.');
const migration = migrations.length ? read(path.join('supabase/migrations', migrations[0])) : '';
const detail = read('src/pages/BusinessDetail.tsx');
const service = read('src/lib/businessFinancialAccess.ts');
const data = read('src/lib/data.ts');
const netlify = read('netlify.toml');
const cleanup = read('src/styles/final/release-cleanup.css');

[
  'get_business_file_metadata_for_viewer',
  'd68_get_business_dataroom_file_access',
  "'dataroom' = any(g.scopes)",
  "g.status = 'active'",
  'g.expires_at is null or g.expires_at > now()',
  'access_business_dataroom_file',
  'from public, anon',
  'to authenticated, service_role',
  'files select owner admin or active dataroom grant',
  'business files select owner admin or active dataroom grant',
  'Deliberately no INSERT/UPDATE into business_financial_access_grants',
].forEach((snippet) => check(migration.includes(snippet), 'Migration missing: ' + snippet));
check(!/insert\s+into\s+public\.business_financial_access_grants/i.test(migration), 'Phase E must not create/backfill Dataroom grants.');
check(!detail.includes(".from('proposals')"), 'Business Detail must not infer file access from Proposal state.');
check(detail.includes('getBusinessFinancialAccess(b.id)'), 'Business Detail must use the central access snapshot.');
check(detail.includes('getBusinessDataroomFileAccess(String(doc.id))'), 'File download must pass the audited file-access RPC.');
check(detail.includes('.createSignedUrl(fileAccess.file_path, 60)'), 'Signed URL must be short-lived and use the audited path.');
check(!detail.includes('createSignedUrl(doc.file_path'), 'Client metadata must not directly choose the private file path.');
check(service.includes("supabase.rpc('d68_get_business_dataroom_file_access'"), 'Service must expose the audited Dataroom file gate.');
check(service.includes("supabase.rpc('d68_get_business_financial_access'"), 'Service must expose the central access snapshot.');
check(data.includes(".from('public_businesses_safe')"), 'Public Business reads must continue using the redacted view.');
check(data.includes("supabase.rpc('d68_get_business_financial_summaries'"), 'Exact financial hydration must remain behind the secure RPC.');
check(netlify.includes('command = "npm run build"') && netlify.includes('publish = "dist"'), 'Netlify build/publish contract changed unexpectedly.');
check(!/[^\s/*-]/.test(cleanup.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'release-cleanup.css contains active CSS.');
check(!fs.existsSync('scripts/apply-phase-e-stabilization.mjs'), 'Temporary Phase E applicator remains in the final tree.');

if (failures.length) {
  console.error('✗ Deals68 Phase E stabilization check failed:');
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exit(1);
}
console.log('✓ Deals68 Phase E stabilization check: PASS');
`);

const pkg = JSON.parse(read('package.json'));
pkg.scripts['qa:financial-release-phase-e'] = 'node scripts/deals68-business-financial-release-phase-e-check.mjs';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

const migrationStateFile = 'docs/release/MIGRATION_STATE.md';
let migrationState = read(migrationStateFile);
const version = migrationName.split('_')[0];
const tableAnchor = '| 20260724090819 | `20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql` |\n';
migrationState = migrationState.replace(tableAnchor, tableAnchor + `| ${version} | \`${migrationName}\` — committed, NOT APPLIED; requires explicit approval |\n`);
const listAnchor = '- `20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql` — Phase B compatibility fix applied to production; treats Investor status `hidden` as a public-profile visibility state rather than loss of entitlement, so the authenticated owner can use active Proposal/request grants and submit idempotent financial-data requests.\n';
migrationState = migrationState.replace(listAnchor, listAnchor + `- \`${migrationName}\` — Phase E additive Dataroom stabilization; committed but NOT APPLIED. It replaces Proposal-based file metadata/Storage reads with an active, unexpired \`dataroom\` scope, adds an audited file-path RPC and creates no grants. Apply only after explicit approval.\n`);
write(migrationStateFile, migrationState);

const migrationCheckFile = 'scripts/deals68-migration-state-check.mjs';
replaceOnce(migrationCheckFile,
`  '20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql',
];
`,
`  '20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql',
  '${migrationName}',
];
`);
replaceOnce(migrationCheckFile,
`  {
    name: '20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql',
    snippets: [
      "'active'::public.account_status",
      "'hidden'::public.account_status",
      'create or replace function public.d68_get_business_financial_summaries',
      'create or replace function public.d68_request_business_financial_access',
      "'grant_required', true",
      "'public_redaction_unchanged', true",
    ],
  },
];
`,
`  {
    name: '20260724090819_business_financial_redaction_phase_b_hidden_investor_fix_v1.sql',
    snippets: [
      "'active'::public.account_status",
      "'hidden'::public.account_status",
      'create or replace function public.d68_get_business_financial_summaries',
      'create or replace function public.d68_request_business_financial_access',
      "'grant_required', true",
      "'public_redaction_unchanged', true",
    ],
  },
  {
    name: '${migrationName}',
    snippets: [
      'create or replace function public.get_business_file_metadata_for_viewer',
      'create or replace function public.d68_get_business_dataroom_file_access',
      "'dataroom' = any(g.scopes)",
      'access_business_dataroom_file',
      'files select owner admin or active dataroom grant',
      'business files select owner admin or active dataroom grant',
      'Deliberately no INSERT/UPDATE into business_financial_access_grants',
    ],
  },
];
`);

const reviewDoc = `# Deals68 — Business Financial Access Phase E Release Review

Date: 2026-07-24 (Asia/Ho_Chi_Minh)

## Executive conclusion

Phase C and D are integrated into building. Phase E is a stabilization release only. It does not add a Dataroom grant workflow, eNDA, payment behavior, Proposal transitions or a new public financial field.

A release blocker was found: approved/connected Proposal state still controlled private Business file metadata and Storage reads, while financial values already used the canonical access-grant ledger. That meant expiry or revocation of a central grant did not necessarily remove document access. This release aligns metadata, table RLS and Storage SELECT with an active, unexpired Business-specific dataroom scope.

The new migration is committed but NOT APPLIED to Supabase production. Production deploy remains blocked until explicit migration approval and authenticated UAT.

## Audited production baseline before source changes

- main and building started identical at 641030f9c8069c0519d052310896017a171bb0ec.
- Phase A/B migration ledger entries: present.
- Public Business rows: 8.
- Exact revenue returned by public_businesses_safe: 0.
- Exact EBITDA returned by public_businesses_safe: 0.
- Active financial grants: 287.
- Active Dataroom grants: 0.
- Open financial requests: 3.
- Business files: 20; approved/public-visible files: 10.
- document_access_grants rows: 0.

Exact financial values remain inside the private businesses.public_snapshot_json source for owner/Admin and the secure summary RPC. This is intentional internal storage, not a public payload: anon has no SELECT on businesses and public_businesses_safe reconstructs a redacted snapshot.

## Phase E source changes

1. File metadata requires owner/Admin/service role or an active, unexpired dataroom scope.
2. business_files SELECT RLS uses the same scope instead of Proposal approved/connected.
3. business-files-private Storage SELECT uses the same scope and file approval state.
4. d68_get_business_dataroom_file_access returns the private path only after server-side authorization and records an audit event.
5. Business Detail no longer infers download access from Proposal status.
6. Private signed URLs expire after 60 seconds.
7. No Dataroom grant is created or backfilled. Current zero-grant production state remains zero after migration.
8. eNDA is not implemented or bypassed. Future Dataroom grant issuance must require the approved eNDA workflow.

## Netlify readiness

Repository configuration remains:

- Build command: npm run build.
- Publish directory: dist.
- SPA redirect: /* to /index.html with status 200.
- SEO Edge Function: seo on /*.
- CSP permits only the existing Supabase, VietQR and first-party resources.

Netlify site-level branch mapping, environment values, Auth Site URL/Redirect URLs and custom domains are not stored in netlify.toml and must be verified in the Netlify/Supabase dashboards without printing secret values. No production setting was changed in Phase E.

## Rollback

Frontend rollback:

1. Revert the Phase E merge commit or deploy the previous building/main commit.
2. The old frontend does not require the new RPC, but it must not be used as a security rollback after the Phase E migration because it again infers document access from Proposal state.

Database rollback strategy:

- The migration is additive/replacement DDL and has no data backfill.
- Preferred incident response is forward-fix or temporarily revoke EXECUTE on d68_get_business_dataroom_file_access and deny private file SELECT.
- Do not restore the legacy Proposal-based Storage policy during a confidentiality incident.
- Because no Dataroom grants are auto-created, applying the migration safely defaults Investor file access to denied.

Verification after rollback or forward-fix:

- anon public_businesses_safe returns NULL exact revenue and EBITDA.
- anon cannot SELECT businesses.
- Investor without dataroom scope receives no file metadata/path.
- expired or revoked dataroom grant receives no file metadata/path.
- owner/Admin retain access.
- audit_logs records successful Dataroom file path access.

## Release blockers and NOT RUN

- New migration NOT APPLIED to production.
- Authenticated end-to-end tests with safe Investor/Business/Admin accounts: NOT RUN unless credentials are supplied through protected CI secrets.
- eNDA and Dataroom grant issuance: outside Phase E and still disabled.
- Netlify production deploy: NOT RUN.
- main merge: NOT RUN.
`;
write('docs/release/BUSINESS_FINANCIAL_ACCESS_PHASE_E_RELEASE_REVIEW.md', reviewDoc);

console.log(`Applied Phase E stabilization using ${migrationName}`);
