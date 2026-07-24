#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')

def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one exact anchor, found {count}')
    write(path, content.replace(old, new, 1))

def replace_regex(path: str, pattern: str, replacement: str) -> None:
    content = read(path)
    next_content, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{path}: regex anchor matched {count} times: {pattern[:80]}')
    write(path, next_content)

MIGRATION = "-- Deals68 Business Financial Dashboard \u2014 Phase D.\n-- Cutover-coupled migration: apply immediately before deploying the matching\n-- Phase D frontend. It removes direct client mutations of Proposal/request rows\n-- and exposes only audited SECURITY DEFINER RPCs for those state transitions.\n\ncreate or replace function public.d68_respond_to_business_proposal(\n  p_proposal_id uuid,\n  p_action text\n)\nreturns jsonb\nlanguage plpgsql\nsecurity definer\nset search_path = public, pg_temp\nas $$\ndeclare\n  actor_uuid uuid := auth.uid();\n  service_actor boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';\n  proposal_row public.proposals%rowtype;\n  investor_owner uuid;\n  normalized_action text := lower(trim(coalesce(p_action, '')));\n  current_status text;\n  next_status public.proposal_status;\n  access_snapshot jsonb;\nbegin\n  if actor_uuid is null and not service_actor then\n    raise exception 'Authentication required' using errcode = '42501';\n  end if;\n\n  select *\n  into proposal_row\n  from public.proposals p\n  where p.id = p_proposal_id\n  for update;\n\n  if not found then\n    raise exception 'Proposal not found' using errcode = 'P0002';\n  end if;\n\n  select i.owner_id\n  into investor_owner\n  from public.investors i\n  where i.id = proposal_row.investor_id;\n\n  if not (\n    public.is_admin()\n    or service_actor\n    or investor_owner = actor_uuid\n  ) then\n    raise exception 'Investor permission required' using errcode = '42501';\n  end if;\n\n  if normalized_action in ('approve', 'approved', 'accept', 'accepted') then\n    next_status := 'approved'::public.proposal_status;\n  elsif normalized_action in ('decline', 'declined', 'reject', 'rejected') then\n    next_status := 'declined'::public.proposal_status;\n  elsif normalized_action in ('request_data', 'request-data', 'request') then\n    next_status := 'request_data'::public.proposal_status;\n  else\n    raise exception 'Unsupported Proposal action: %', normalized_action;\n  end if;\n\n  current_status := proposal_row.status::text;\n\n  if current_status = 'connected' then\n    raise exception 'Connected Proposal status is server-managed' using errcode = '42501';\n  end if;\n\n  if current_status = 'declined' and next_status::text <> 'declined' then\n    raise exception 'Declined Proposal is terminal';\n  end if;\n\n  if next_status::text = 'request_data'\n     and current_status not in ('sent', 'request_data') then\n    raise exception 'Invalid Proposal transition: % -> request_data', current_status;\n  end if;\n\n  if next_status::text = 'approved'\n     and current_status not in ('sent', 'request_data', 'approved') then\n    raise exception 'Invalid Proposal transition: % -> approved', current_status;\n  end if;\n\n  if next_status::text = 'declined'\n     and current_status not in ('sent', 'request_data', 'approved', 'declined') then\n    raise exception 'Invalid Proposal transition: % -> declined', current_status;\n  end if;\n\n  if current_status <> next_status::text then\n    update public.proposals\n    set status = next_status,\n        updated_at = now()\n    where id = p_proposal_id\n    returning * into proposal_row;\n  end if;\n\n  insert into public.audit_logs (\n    actor_id, action, entity_type, entity_id, detail\n  ) values (\n    actor_uuid,\n    'respond_to_business_proposal',\n    'proposal',\n    p_proposal_id::text,\n    jsonb_build_object(\n      'business_id', proposal_row.business_id,\n      'investor_id', proposal_row.investor_id,\n      'previous_status', current_status,\n      'next_status', proposal_row.status::text\n    )\n  );\n\n  access_snapshot := public.d68_get_business_financial_access(\n    proposal_row.business_id,\n    proposal_row.investor_id\n  );\n\n  return jsonb_build_object(\n    'proposal_id', proposal_row.id,\n    'status', proposal_row.status::text,\n    'access', access_snapshot\n  );\nend;\n$$;\n\nrevoke all on function public.d68_respond_to_business_proposal(uuid, text)\nfrom public, anon;\ngrant execute on function public.d68_respond_to_business_proposal(uuid, text)\nto authenticated, service_role;\n\ncomment on function public.d68_respond_to_business_proposal(uuid, text) is\n  'Validates Investor-owned Proposal transitions. Client callers cannot set connected. Proposal triggers grant/revoke financial_summary.';\n\ncreate or replace function public.d68_get_business_financial_access_states(\n  p_business_ids uuid[]\n)\nreturns table (\n  business_id uuid,\n  access_level text,\n  scopes text[],\n  source_type text,\n  request_status text,\n  proposal_status text,\n  expires_at timestamptz\n)\nlanguage plpgsql\nstable\nsecurity definer\nset search_path = public, pg_temp\nas $$\ndeclare\n  actor_uuid uuid := auth.uid();\n  service_actor boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role';\n  requested_count integer := coalesce(cardinality(p_business_ids), 0);\nbegin\n  if actor_uuid is null and not service_actor then\n    raise exception 'Authentication required' using errcode = '42501';\n  end if;\n\n  if requested_count = 0 then\n    return;\n  end if;\n\n  if requested_count > 100 then\n    raise exception 'At most 100 Business IDs may be requested' using errcode = '22023';\n  end if;\n\n  return query\n  with requested as (\n    select distinct unnest(p_business_ids) as id\n  ),\n  access_rows as (\n    select\n      b.id,\n      public.d68_get_business_financial_access(b.id, null) as access\n    from requested r\n    join public.businesses b on b.id = r.id\n    where b.visible is true\n      and b.status = 'active'::public.account_status\n      and b.public_snapshot_json is not null\n  )\n  select\n    access_rows.id,\n    coalesce(access_rows.access ->> 'access_level', 'none'),\n    coalesce(\n      array(\n        select jsonb_array_elements_text(\n          coalesce(access_rows.access -> 'scopes', '[]'::jsonb)\n        )\n      ),\n      '{}'::text[]\n    ),\n    (\n      select source_item.value ->> 'source_type'\n      from jsonb_array_elements(\n        coalesce(access_rows.access -> 'sources', '[]'::jsonb)\n      ) as source_item(value)\n      order by case source_item.value ->> 'source_type'\n        when 'data_request' then 1\n        when 'proposal' then 2\n        when 'owner' then 3\n        when 'admin' then 4\n        else 5\n      end\n      limit 1\n    ),\n    nullif(access_rows.access ->> 'request_status', ''),\n    nullif(access_rows.access ->> 'proposal_status', ''),\n    nullif(access_rows.access ->> 'expires_at', '')::timestamptz\n  from access_rows;\nend;\n$$;\n\nrevoke all on function public.d68_get_business_financial_access_states(uuid[])\nfrom public, anon;\ngrant execute on function public.d68_get_business_financial_access_states(uuid[])\nto authenticated, service_role;\n\ncomment on function public.d68_get_business_financial_access_states(uuid[]) is\n  'Batch access-state lookup for Dashboard/UI. Returns no exact financial values.';\n\ncreate or replace function public.get_my_business_dashboard_relations(\n  business_uuid uuid\n)\nreturns jsonb\nlanguage plpgsql\nstable\nsecurity definer\nset search_path = public, pg_temp\nas $$\ndeclare\n  result jsonb;\nbegin\n  if auth.uid() is null then\n    raise exception 'authentication_required';\n  end if;\n\n  if not public.is_admin() and not exists (\n    select 1\n    from public.businesses b\n    where b.id = business_uuid\n      and b.owner_id = auth.uid()\n  ) then\n    raise exception 'business_not_owned';\n  end if;\n\n  select jsonb_build_object(\n    'requests', coalesce((\n      select jsonb_agg(\n        to_jsonb(r) || jsonb_build_object(\n          'investors', to_jsonb(pi),\n          'financial_access',\n          public.d68_get_business_financial_access(\n            business_uuid,\n            r.investor_id\n          )\n        )\n        order by r.created_at desc\n      )\n      from public.request_data r\n      left join public.public_investors_safe pi on pi.id = r.investor_id\n      where r.business_id = business_uuid\n    ), '[]'::jsonb),\n    'interests', coalesce((\n      select jsonb_agg(\n        to_jsonb(ii) || jsonb_build_object(\n          'investors', to_jsonb(pi),\n          'financial_access',\n          public.d68_get_business_financial_access(\n            business_uuid,\n            ii.investor_id\n          )\n        )\n        order by ii.created_at desc\n      )\n      from public.investor_interests ii\n      left join public.public_investors_safe pi on pi.id = ii.investor_id\n      where ii.business_id = business_uuid\n    ), '[]'::jsonb),\n    'proposals', coalesce((\n      select jsonb_agg(\n        to_jsonb(p) || jsonb_build_object(\n          'investors', to_jsonb(pi),\n          'financial_access',\n          public.d68_get_business_financial_access(\n            business_uuid,\n            p.investor_id\n          )\n        )\n        order by p.sent_at desc nulls last, p.updated_at desc\n      )\n      from public.proposals p\n      left join public.public_investors_safe pi on pi.id = p.investor_id\n      where p.business_id = business_uuid\n    ), '[]'::jsonb)\n  ) into result;\n\n  return result;\nend;\n$$;\n\nrevoke all on function public.get_my_business_dashboard_relations(uuid)\nfrom public, anon;\ngrant execute on function public.get_my_business_dashboard_relations(uuid)\nto authenticated, service_role;\n\ncreate or replace function public.get_my_investor_dashboard_relations(\n  investor_uuid uuid\n)\nreturns jsonb\nlanguage plpgsql\nstable\nsecurity definer\nset search_path = public, pg_temp\nas $$\ndeclare\n  result jsonb;\nbegin\n  if auth.uid() is null then\n    raise exception 'authentication_required';\n  end if;\n\n  if not public.is_admin() and not exists (\n    select 1\n    from public.investors i\n    where i.id = investor_uuid\n      and i.owner_id = auth.uid()\n  ) then\n    raise exception 'investor_not_owned';\n  end if;\n\n  select jsonb_build_object(\n    'requests', coalesce((\n      select jsonb_agg(\n        to_jsonb(r) || jsonb_build_object(\n          'businesses', to_jsonb(pb),\n          'financial_access',\n          public.d68_get_business_financial_access(\n            r.business_id,\n            investor_uuid\n          )\n        )\n        order by r.created_at desc\n      )\n      from public.request_data r\n      left join public.public_businesses_safe pb on pb.id = r.business_id\n      where r.investor_id = investor_uuid\n    ), '[]'::jsonb),\n    'interests', coalesce((\n      select jsonb_agg(\n        to_jsonb(ii) || jsonb_build_object(\n          'businesses', to_jsonb(pb),\n          'financial_access',\n          public.d68_get_business_financial_access(\n            ii.business_id,\n            investor_uuid\n          )\n        )\n        order by ii.created_at desc\n      )\n      from public.investor_interests ii\n      left join public.public_businesses_safe pb on pb.id = ii.business_id\n      where ii.investor_id = investor_uuid\n    ), '[]'::jsonb),\n    'proposals', coalesce((\n      select jsonb_agg(\n        to_jsonb(p) || jsonb_build_object(\n          'businesses', to_jsonb(pb),\n          'financial_access',\n          public.d68_get_business_financial_access(\n            p.business_id,\n            investor_uuid\n          )\n        )\n        order by p.sent_at desc nulls last, p.updated_at desc\n      )\n      from public.proposals p\n      left join public.public_businesses_safe pb on pb.id = p.business_id\n      where p.investor_id = investor_uuid\n    ), '[]'::jsonb)\n  ) into result;\n\n  return result;\nend;\n$$;\n\nrevoke all on function public.get_my_investor_dashboard_relations(uuid)\nfrom public, anon;\ngrant execute on function public.get_my_investor_dashboard_relations(uuid)\nto authenticated, service_role;\n\n-- From this cutover forward, browser clients may read relationship rows through\n-- RLS/safe Dashboard RPCs but may mutate them only through audited RPCs.\nrevoke insert, update, delete, truncate\non table public.proposals, public.request_data\nfrom anon, authenticated;\n\ncomment on table public.proposals is\n  'Phase D: client mutations are RPC-only. Connected is server-managed.';\ncomment on table public.request_data is\n  'Phase D: financial request creation/response is RPC-only and audited.';\n"
HELPER = "import { supabase } from './supabase';\n\nexport type FinancialScope =\n  | 'financial_summary'\n  | 'financial_detail'\n  | 'dataroom';\n\nexport type FinancialRequestDecision = 'approve' | 'reject';\n\nexport type ProposalResponseAction =\n  | 'approved'\n  | 'declined'\n  | 'request_data';\n\nfunction cleanId(value: unknown, label: string) {\n  const id = String(value || '').trim();\n  if (!id) throw new Error(`${label} is required.`);\n  return id;\n}\n\nexport async function requestBusinessFinancialAccess(\n  businessId: string,\n  scopes: FinancialScope[] = ['financial_summary', 'financial_detail'],\n  note = '',\n) {\n  const { data, error } = await supabase.rpc(\n    'd68_request_business_financial_access',\n    {\n      p_business_id: cleanId(businessId, 'Business ID'),\n      p_requested_scopes: scopes,\n      p_request_note: note.trim() || null,\n    },\n  );\n  if (error) throw error;\n  return data;\n}\n\nexport async function respondBusinessFinancialRequest(\n  requestId: string,\n  decision: FinancialRequestDecision,\n  scopes: FinancialScope[] = ['financial_summary', 'financial_detail'],\n  note = '',\n) {\n  const { data, error } = await supabase.rpc(\n    'd68_respond_business_financial_request',\n    {\n      p_request_id: cleanId(requestId, 'Request ID'),\n      p_decision: decision,\n      p_granted_scopes: decision === 'approve' ? scopes : [],\n      p_expires_at: null,\n      p_response_note: note.trim() || null,\n    },\n  );\n  if (error) throw error;\n  return data;\n}\n\nexport async function revokeBusinessFinancialAccess(\n  grantId: string,\n  reason = 'revoked_by_business_dashboard',\n) {\n  const { data, error } = await supabase.rpc(\n    'd68_revoke_business_financial_access',\n    {\n      p_grant_id: cleanId(grantId, 'Grant ID'),\n      p_reason: reason.trim() || 'revoked_by_business_dashboard',\n    },\n  );\n  if (error) throw error;\n  return data;\n}\n\nexport async function respondToBusinessProposal(\n  proposalId: string,\n  action: ProposalResponseAction,\n) {\n  const { data, error } = await supabase.rpc(\n    'd68_respond_to_business_proposal',\n    {\n      p_proposal_id: cleanId(proposalId, 'Proposal ID'),\n      p_action: action,\n    },\n  );\n  if (error) throw error;\n  return data;\n}\n"
QA = "#!/usr/bin/env node\nimport fs from 'node:fs';\n\nconst failures = [];\nconst checks = [];\nconst read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';\nconst requireSnippet = (label, content, snippet) => {\n  checks.push(label);\n  if (!content.includes(snippet)) failures.push(`${label}: missing ${snippet}`);\n};\n\nconst migrationName = '20260724110000_business_financial_dashboard_phase_d_v1.sql';\nconst migration = read(`supabase/migrations/${migrationName}`);\nconst helper = read('src/lib/businessFinancialAccess.ts');\nconst data = read('src/lib/data.ts');\nconst proposals = read('src/lib/proposals.ts');\nconst investor = read('src/pages/InvestorDashboard.tsx');\nconst business = read('src/pages/BusinessDashboard.tsx');\nconst detail = read('src/pages/BusinessDetail.tsx');\nconst css = read('src/styles/pages/dashboard.css');\nconst migrationState = read('docs/release/MIGRATION_STATE.md');\nconst pkg = JSON.parse(read('package.json') || '{}');\n\n[\n  ['Migration creates Proposal response RPC', migration, 'd68_respond_to_business_proposal'],\n  ['Proposal connected is server-managed', migration, 'Connected Proposal status is server-managed'],\n  ['Migration validates Proposal transitions', migration, 'Invalid Proposal transition'],\n  ['Migration creates batch access-state RPC', migration, 'd68_get_business_financial_access_states'],\n  ['Batch state is capped', migration, 'At most 100 Business IDs may be requested'],\n  ['Business relation RPC carries central access', migration, \"'financial_access'\"],\n  ['Investor relation RPC includes requests', migration, \"'requests', coalesce((\"],\n  ['Direct Proposal/request mutations revoked', migration, 'revoke insert, update, delete, truncate'],\n  ['Helper uses request RPC', helper, 'd68_request_business_financial_access'],\n  ['Helper uses request response RPC', helper, 'd68_respond_business_financial_request'],\n  ['Helper uses revoke RPC', helper, 'd68_revoke_business_financial_access'],\n  ['Helper uses Proposal response RPC', helper, 'd68_respond_to_business_proposal'],\n  ['Data layer batches access states', data, 'getBusinessFinancialAccessStates'],\n  ['Data layer calls access-state RPC', data, 'd68_get_business_financial_access_states'],\n  ['Data layer attaches states without exact values', data, 'financial_access_scopes'],\n  ['Proposal lib no longer updates table directly', proposals, 'respondToBusinessProposal'],\n  ['Investor uses secure request wrapper', investor, 'requestBusinessFinancialAccess'],\n  ['Investor matching uses revenue band', investor, 'revenue_match_band_key'],\n  ['Investor matching uses EBITDA band', investor, 'ebitda_band_key'],\n  ['Investor renders pending request state', investor, '\u0110ang ch\u1edd ch\u1ea5p thu\u1eadn'],\n  ['Proposal tab renders protected Revenue', investor, 'd68-proposal-financial-summary'],\n  ['Business uses approve RPC wrapper', business, 'respondBusinessFinancialRequest'],\n  ['Business has Accept and grant action', business, 'Ch\u1ea5p thu\u1eadn & c\u1ea5p quy\u1ec1n'],\n  ['Business has Reject action', business, 'T\u1eeb ch\u1ed1i y\u00eau c\u1ea7u'],\n  ['Business has Revoke action', business, 'Thu h\u1ed3i quy\u1ec1n'],\n  ['Business exposes three scope modes', business, 'S\u1ed1 li\u1ec7u chi ti\u1ebft + Dataroom'],\n  ['Business listens for grant changes', business, \"table: 'business_financial_access_grants'\"],\n  ['Detail uses secure request wrapper', detail, 'requestBusinessFinancialAccess'],\n  ['Dashboard scope CSS exists', css, '.d68-financial-request-card'],\n  ['Migration state documents cutover', migrationState, migrationName],\n].forEach(([label, content, snippet]) => requireSnippet(label, content, snippet));\n\nconst sourceFiles = [\n  'src/pages/InvestorDashboard.tsx',\n  'src/pages/BusinessDashboard.tsx',\n  'src/pages/BusinessDetail.tsx',\n  'src/lib/proposals.ts',\n].map((path) => [path, read(path)]);\n\nfor (const [path, content] of sourceFiles) {\n  checks.push(`${path} has no direct request_data insert/update`);\n  if (/\\.from\\(['\"]request_data['\"]\\)\\s*\\.(insert|update)\\s*\\(/s.test(content)) {\n    failures.push(`${path}: direct request_data mutation remains`);\n  }\n  checks.push(`${path} has no direct Proposal update`);\n  if (/\\.from\\(['\"]proposals['\"]\\)\\s*\\.update\\s*\\(/s.test(content)) {\n    failures.push(`${path}: direct Proposal mutation remains`);\n  }\n}\n\nchecks.push('Investor cannot request connected Proposal status');\nif (/updateProposalStatus\\([^)]*['\"]connected['\"]/.test(investor) ||\n    /respondToBusinessProposal\\([^)]*['\"]connected['\"]/.test(investor)) {\n  failures.push('Investor code can still set connected');\n}\n\nchecks.push('Phase D package script exists');\nif (pkg.scripts?.['qa:financial-dashboard-phase-d'] !==\n    'node scripts/deals68-business-financial-dashboard-phase-d-check.mjs') {\n  failures.push('package.json Phase D QA script missing');\n}\n\nif (failures.length) {\n  console.error('\u2717 Deals68 Business financial Dashboard Phase D check failed:');\n  failures.forEach((failure) => console.error(`  - ${failure}`));\n  process.exit(1);\n}\n\nconsole.log(`\u2713 Deals68 Business financial Dashboard Phase D contract: PASS (${checks.length}/${checks.length})`);\n"

write(
    'supabase/migrations/20260724110000_business_financial_dashboard_phase_d_v1.sql',
    MIGRATION,
)
write('src/lib/businessFinancialAccess.ts', HELPER)
write('scripts/deals68-business-financial-dashboard-phase-d-check.mjs', QA)

replace_regex(
    'src/lib/data.ts',
    r"function financialAccessMetadata\(access: any\) \{.*?\n\}\n\nexport async function attachAuthorizedBusinessFinancials<T extends Record<string, any>>\(.*?\n\}\n\nfunction safeLikeTerm",
    r"""function financialAccessMetadata(access: any) {
  const sources = Array.isArray(access?.sources) ? access.sources : [];
  const sourceTypes = sources
    .map((item: any) => String(item?.source_type || '').trim().toLowerCase())
    .filter(Boolean);
  const source = String(access?.source_type || '').trim().toLowerCase() ||
    (sourceTypes.includes('data_request')
      ? 'data_request'
      : sourceTypes.includes('proposal')
        ? 'proposal'
        : sourceTypes.includes('owner')
          ? 'owner'
          : sourceTypes.includes('admin')
            ? 'admin'
            : sourceTypes[0] || null);
  const scopes = Array.isArray(access?.scopes)
    ? access.scopes.map(String).filter(Boolean)
    : [];
  return {
    financial_access_level: access?.access_level || 'none',
    financial_access_source: source || null,
    financial_access_scopes: scopes,
    financial_access_sources: sources,
    financial_request_status: access?.request_status || null,
    financial_proposal_status: access?.proposal_status || null,
    financial_access_expires_at: access?.expires_at || null,
  };
}

export async function getBusinessFinancialAccessStates(
  businessIds: string[],
): Promise<any[]> {
  const ids = Array.from(
    new Set(businessIds.map((id) => String(id || '').trim()).filter(Boolean)),
  );
  if (!ids.length) return [];

  const session = await supabase.auth.getSession().catch(() => null);
  if (!session?.data?.session) return [];

  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += 100) {
    chunks.push(ids.slice(index, index + 100));
  }

  const responses = await Promise.all(
    chunks.map((chunk) =>
      supabase.rpc('d68_get_business_financial_access_states', {
        p_business_ids: chunk,
      }),
    ),
  );

  return responses.flatMap((response) =>
    response.error || !Array.isArray(response.data) ? [] : response.data,
  );
}

export async function attachAuthorizedBusinessFinancials<T extends Record<string, any>>(
  rows: T[],
): Promise<T[]> {
  if (!rows.length) return rows;
  const ids = rows.map((row) => String(row.id || '')).filter(Boolean);
  const [summaries, states] = await Promise.all([
    getAuthorizedBusinessFinancialSummaries(ids),
    getBusinessFinancialAccessStates(ids),
  ]);

  const byBusinessId = new Map(
    summaries.map((summary) => [String(summary.business_id), summary]),
  );
  const accessByBusinessId = new Map(
    states.map((access) => [String(access.business_id), access]),
  );

  return rows.map((row) => {
    const summary = byBusinessId.get(String(row.id));
    const access = accessByBusinessId.get(String(row.id));
    const metadata = access ? financialAccessMetadata(access) : {};
    if (!summary) {
      return {
        ...row,
        ...metadata,
        id: row.id,
      };
    }
    return {
      ...row,
      ...summary,
      ...metadata,
      id: row.id,
      financial_summary_authorized: true,
      financials_restricted: false,
    };
  });
}

function safeLikeTerm""",
)

replace_once(
    'src/lib/proposals.ts',
    "import { supabase } from './supabase';\n",
    "import { supabase } from './supabase';\nimport { respondToBusinessProposal, type ProposalResponseAction } from './businessFinancialAccess';\n",
)
replace_regex(
    'src/lib/proposals.ts',
    r"export async function updateProposalStatus\(proposalId: string, status: ProposalStatus\) \{.*?\n\}",
    r"""export async function updateProposalStatus(
  proposalId: string,
  status: ProposalResponseAction,
) {
  return respondToBusinessProposal(proposalId, status);
}""",
)
replace_once(
    'src/lib/proposals.ts',
    "export type ProposalStatus = 'sent' | 'approved' | 'declined' | 'request_data' | 'connected';\n",
    "export type ProposalStatus = 'sent' | 'approved' | 'declined' | 'request_data' | 'connected';\nexport type { ProposalResponseAction } from './businessFinancialAccess';\n",
)

replace_once(
    'src/pages/InvestorDashboard.tsx',
    "  type ProposalStatus,\n",
    "  type ProposalResponseAction,\n",
)
replace_once(
    'src/pages/InvestorDashboard.tsx',
    "import SensitiveFinancialValue from '../components/business/SensitiveFinancialValue';\n",
    "import SensitiveFinancialValue from '../components/business/SensitiveFinancialValue';\nimport { requestBusinessFinancialAccess } from '../lib/businessFinancialAccess';\n",
)
replace_regex(
    'src/pages/InvestorDashboard.tsx',
    r"function revenueUsd\(business: any\) \{.*?\n\}\n\nfunction matchesRevenueBand\(business: any, band: string\) \{.*?\n\}\n\nfunction matchesEbitdaBand\(business: any, band: string\) \{.*?\n\}",
    r"""function matchesRevenueBand(business: any, band: string) {
  if (!band) return true;
  return String(
    business?.revenue_match_band_key ||
      business?.revenue_band_key ||
      'unknown',
  ) === band;
}

function matchesEbitdaBand(business: any, band: string) {
  if (!band) return true;
  return String(business?.ebitda_band_key || 'unknown') === band;
}""",
)
replace_once(
    'src/pages/InvestorDashboard.tsx',
    """function statusText(lang: Lang, status: unknown) {""",
    """function investorEbitdaText(business: any, lang: Lang) {
  const hasValue =
    business?.ebitda_margin !== null &&
    business?.ebitda_margin !== undefined;
  return <SensitiveFinancialValue
    lang={lang}
    value={hasValue ? `${Number(business.ebitda_margin).toLocaleString(
      lang === 'vi' ? 'vi-VN' : 'en-US',
      { maximumFractionDigits: 2 },
    )}%` : null}
    isAuthorized={hasValue}
    hasData={String(business?.ebitda_band_key || 'unknown') !== 'unknown'}
    requestStatus={business?.financial_request_status}
    source={business?.financial_access_source}
    compact
  />;
}

function financialRequestButtonState(business: any, lang: Lang) {
  const accessLevel = String(business?.financial_access_level || 'none');
  const requestStatus = String(business?.financial_request_status || '').toLowerCase();
  if (accessLevel === 'detail') {
    return {
      disabled: true,
      cls: 'green',
      label: T(lang, 'Đã được cấp quyền', 'Access granted'),
    };
  }
  if (['pending', 'forwarded'].includes(requestStatus)) {
    return {
      disabled: true,
      cls: 'light',
      label: T(lang, 'Đang chờ chấp thuận', 'Awaiting approval'),
    };
  }
  if (requestStatus === 'rejected' || requestStatus === 'fulfilled') {
    return {
      disabled: false,
      cls: 'gold',
      label: T(lang, 'Yêu cầu lại', 'Request again'),
    };
  }
  if (accessLevel === 'summary') {
    return {
      disabled: false,
      cls: 'blue',
      label: T(lang, 'Yêu cầu số liệu chi tiết', 'Request detailed data'),
    };
  }
  return {
    disabled: false,
    cls: 'blue',
    label: T(lang, 'Yêu cầu số liệu', 'Request financial data'),
  };
}

function FinancialRequestButton({
  business,
  lang,
  onRequest,
}: {
  business: any;
  lang: Lang;
  onRequest: (business: any) => void | Promise<any>;
}) {
  const state = financialRequestButtonState(business, lang);
  return (
    <button
      type="button"
      className={`d68-dashboard-btn ${state.cls}`}
      disabled={state.disabled}
      onClick={() => onRequest(business)}
    >
      {state.label}
    </button>
  );
}

function statusText(lang: Lang, status: unknown) {""",
)
replace_once(
    'src/pages/InvestorDashboard.tsx',
    """          <button
            type="button"
            className="d68-dashboard-btn blue"
            onClick={() => onRequest(business)}
          >
            {T(lang, 'Yêu cầu dữ liệu', 'Request data')}
          </button>""",
    """          <FinancialRequestButton
            business={business}
            lang={lang}
            onRequest={onRequest}
          />""",
)
replace_once(
    'src/pages/InvestorDashboard.tsx',
    """            {business.id ? (
              <button
                type="button"
                className="d68-dashboard-btn gold"
                onClick={() => onRequest(business)}
              >
                {T(lang, 'Yêu cầu tài liệu', 'Request documents')}
              </button>
            ) : null}""",
    """            {business.id ? (
              <FinancialRequestButton
                business={business}
                lang={lang}
                onRequest={onRequest}
              />
            ) : null}""",
)
replace_regex(
    'src/pages/InvestorDashboard.tsx',
    r"function ProposalRows\(\{ lang, proposals, onMark, onRequestData \}: any\) \{.*?\n\}\n\nexport default function InvestorDashboard",
    r"""function ProposalRows({ lang, proposals, onMark, onRequestData }: any) {
  const newCount = proposals.filter((proposal: any) => proposal.status === 'sent').length;
  const approved = proposals.filter((proposal: any) =>
    ['approved', 'connected'].includes(proposal.status),
  ).length;
  const declined = proposals.filter((proposal: any) => proposal.status === 'declined').length;

  return (
    <div className="d68-dashboard-card">
      <h2>{T(lang, 'Proposal đã nhận', 'Received proposals')}</h2>
      <div className="d68-dashboard-grid4" style={{ margin: '14px 0' }}>
        <div className="d68-proposal-metric"><b>{newCount}</b><span>{T(lang, 'Proposal mới', 'New')}</span></div>
        <div className="d68-proposal-metric"><b>{approved}</b><span>{T(lang, 'Đã duyệt', 'Approved')}</span></div>
        <div className="d68-proposal-metric"><b>{declined}</b><span>{T(lang, 'Bỏ qua', 'Declined')}</span></div>
        <div className="d68-proposal-metric"><b>{proposals.length}</b><span>{T(lang, 'Tổng', 'Total')}</span></div>
      </div>

      {proposals.length ? proposals.map((row: any) => {
        const business = row.businesses || {};
        const proposalState = String(row.status || 'sent');
        const status = proposalStatusLabel(row.status, lang);
        const requestState = financialRequestButtonState(business, lang);
        const canApprove = ['sent', 'request_data'].includes(proposalState);
        const canDecline = ['sent', 'request_data', 'approved'].includes(proposalState);
        const canRequestDetail = !['declined', 'connected'].includes(proposalState) &&
          String(business.financial_access_level || 'none') !== 'detail';
        return (
          <div key={row.id} className="d68-dashboard-row d68-proposal-row">
            <div style={{ flex: 1 }}>
              <b>
                <BusinessTitleLink business={business} lang={lang}>
                  {business.title_vi || business.title_en || business.public_code || row.business_id}
                </BusinessTitleLink>
              </b>
              <div className="d68-dashboard-mini">
                {new Date(row.sent_at || row.created_at).toLocaleString(
                  lang === 'vi' ? 'vi-VN' : 'en-US',
                )}{' '}· {business.city || '—'} ·{' '}
                {labelIndustryTaxonomy(
                  business.industry_key || business.industry,
                  lang,
                )}
              </div>
              <p>
                {T(lang, 'Nhu cầu vốn/giá chào', 'Ask')}: <b>
                  {formatCompactMoney(
                    business.ask_amount,
                    business.ask_currency || business.revenue_currency,
                  )}
                </b>{' '}· <span className={`d68-dashboard-badge ${status.cls}`}>{status.label}</span>
              </p>
              <div className="d68-proposal-financial-summary">
                <div><small>{T(lang, 'Doanh thu', 'Revenue')}</small><b>{investorRevenueText(business, lang)}</b></div>
                <div><small>EBITDA</small><b>{investorEbitdaText(business, lang)}</b></div>
              </div>
            </div>
            <div className="d68-dashboard-actions">
              {canApprove ? (
                <button type="button" onClick={() => onMark(row, 'approved')} className="d68-dashboard-btn green">
                  {T(lang, 'Duyệt', 'Approve')}
                </button>
              ) : null}
              {canDecline ? (
                <button type="button" onClick={() => onMark(row, 'declined')} className="d68-dashboard-btn red">
                  {T(lang, 'Bỏ qua', 'Decline')}
                </button>
              ) : null}
              {canRequestDetail ? (
                <button
                  type="button"
                  disabled={requestState.disabled}
                  onClick={() => onRequestData(row)}
                  className={`d68-dashboard-btn ${requestState.cls}`}
                >
                  {requestState.label}
                </button>
              ) : null}
            </div>
          </div>
        );
      }) : (
        <div className="d68-dashboard-empty">
          {T(lang, 'Chưa có proposal nào gửi tới bạn.', 'No received proposals yet.')}
        </div>
      )}
    </div>
  );
}

export default function InvestorDashboard""",
)
replace_regex(
    'src/pages/InvestorDashboard.tsx',
    r"  async function requestData\(business: any\): Promise<boolean> \{.*?\n  \}\n\n  async function markProposal\(row: any, status: ProposalStatus\) \{.*?\n  \}\n\n  async function requestProposalData\(row: any\) \{.*?\n  \}",
    r"""  async function requestData(
    business: any,
    reloadAfter = true,
  ): Promise<any | null> {
    if (!business?.id) return null;
    try {
      const result = await requestBusinessFinancialAccess(
        business.id,
        ['financial_summary', 'financial_detail'],
        'Investor requested financial data from Investor Dashboard.',
      );
      setNoticeType(result?.existing ? 'warn' : 'ok');
      setNotice(
        result?.existing
          ? T(
              lang,
              'Yêu cầu số liệu đang chờ doanh nghiệp chấp thuận.',
              'Your financial data request is awaiting Business approval.',
            )
          : T(lang, 'Đã gửi yêu cầu số liệu.', 'Financial data request sent.'),
      );
      if (reloadAfter) await load();
      return result;
    } catch (error: any) {
      setNoticeType('err');
      setNotice(error?.message || T(lang, 'Có lỗi', 'Something went wrong'));
      return null;
    }
  }

  async function markProposal(row: any, status: ProposalResponseAction) {
    try {
      await updateProposalStatus(row.id, status);
      setNoticeType('ok');
      setNotice(T(lang, 'Đã cập nhật Proposal.', 'Proposal updated.'));
      await load();
    } catch (error: any) {
      setNoticeType('err');
      setNotice(error?.message || T(lang, 'Có lỗi', 'Something went wrong'));
    }
  }

  async function requestProposalData(row: any) {
    const business = row.businesses || {};
    const requested = await requestData(
      { id: row.business_id || business.id },
      false,
    );
    if (!requested) return;
    try {
      if (String(row.status || 'sent') === 'sent') {
        await updateProposalStatus(row.id, 'request_data');
      }
      await load();
    } catch (error: any) {
      setNoticeType('err');
      setNotice(error?.message || T(lang, 'Có lỗi', 'Something went wrong'));
    }
  }""",
)

replace_once(
    'src/pages/BusinessDashboard.tsx',
    "import { proposalQuotaTotal } from '../lib/proposals';\n",
    "import { proposalQuotaTotal } from '../lib/proposals';\nimport {\n  respondBusinessFinancialRequest,\n  revokeBusinessFinancialAccess,\n  type FinancialScope,\n} from '../lib/businessFinancialAccess';\n",
)
replace_once(
    'src/pages/BusinessDashboard.tsx',
    """      )
      .subscribe();""",
    """      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'request_data',
          filter: `business_id=eq.${b.id}`,
        },
        () => load(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proposals',
          filter: `business_id=eq.${b.id}`,
        },
        () => load(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'business_financial_access_grants',
          filter: `business_id=eq.${b.id}`,
        },
        () => load(),
      )
      .subscribe();""",
)
replace_once(
    'src/pages/BusinessDashboard.tsx',
    """  async function acceptInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'connected' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã đồng ý kết nối.', 'Connection accepted.')); load(); }
  async function rejectInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'rejected' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã từ chối kết nối.', 'Connection rejected.')); load(); }
  async function fulfillRequest(row: any) { const { error } = await supabase.from('request_data').update({ status: 'fulfilled' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã đánh dấu hoàn tất.', 'Marked as fulfilled.')); load(); }""",
    """  async function acceptInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'connected' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã đồng ý kết nối.', 'Connection accepted.')); load(); }
  async function rejectInterest(row: any) { const { error } = await supabase.from('investor_interests').update({ status: 'rejected' }).eq('id', row.id); setErr(error?.message || ''); setMsg(error ? '' : T(lang, 'Đã từ chối kết nối.', 'Connection rejected.')); load(); }

  async function approveFinancialRequest(row: any, scopes: FinancialScope[]) {
    setBusy(true); setErr(''); setMsg('');
    try {
      await respondBusinessFinancialRequest(
        row.id,
        'approve',
        scopes,
        'Approved from Business Dashboard.',
      );
      setMsg(T(lang, 'Đã chấp thuận và cấp quyền xem số liệu.', 'Request approved and financial access granted.'));
      await load();
    } catch (error: any) {
      setErr(error?.message || T(lang, 'Không thể cấp quyền.', 'Could not grant access.'));
    } finally {
      setBusy(false);
    }
  }

  async function rejectFinancialRequest(row: any) {
    setBusy(true); setErr(''); setMsg('');
    try {
      await respondBusinessFinancialRequest(
        row.id,
        'reject',
        [],
        'Rejected from Business Dashboard.',
      );
      setMsg(T(lang, 'Đã từ chối yêu cầu số liệu.', 'Financial data request rejected.'));
      await load();
    } catch (error: any) {
      setErr(error?.message || T(lang, 'Không thể từ chối yêu cầu.', 'Could not reject request.'));
    } finally {
      setBusy(false);
    }
  }

  async function revokeFinancialRequest(row: any, grantId: string) {
    if (!confirm(T(lang, 'Thu hồi quyền xem số liệu của nhà đầu tư này?', 'Revoke this investor financial access?'))) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      await revokeBusinessFinancialAccess(
        grantId,
        `revoked_from_business_dashboard:${row.id}`,
      );
      setMsg(T(lang, 'Đã thu hồi quyền xem số liệu.', 'Financial access revoked.'));
      await load();
    } catch (error: any) {
      setErr(error?.message || T(lang, 'Không thể thu hồi quyền.', 'Could not revoke access.'));
    } finally {
      setBusy(false);
    }
  }""",
)
replace_once(
    'src/pages/BusinessDashboard.tsx',
    """      {tab === 'requests' ? <Rows title={T(lang,'Yêu cầu dữ liệu','Data requests')} rows={requests} empty={T(lang,'Chưa có yêu cầu dữ liệu.','No data requests yet.')} actions={(row: any) => <button onClick={() => fulfillRequest(row)} className="d68-dashboard-btn green">Fulfilled</button>} /> : null}""",
    """      {tab === 'requests' ? <FinancialRequestRows
        lang={lang}
        rows={requests}
        busy={busy}
        onApprove={approveFinancialRequest}
        onReject={rejectFinancialRequest}
        onRevoke={revokeFinancialRequest}
      /> : null}""",
)
replace_once(
    'src/pages/BusinessDashboard.tsx',
    """function BusinessBillingPanel({ lang, b, payments, profile, setMsg, setErr, onReload }: any) {""",
    r"""function financialScopeMode(scopes: any): 'summary' | 'detail' | 'dataroom' {
  const values = Array.isArray(scopes) ? scopes.map(String) : [];
  if (values.includes('dataroom')) return 'dataroom';
  if (values.includes('financial_detail')) return 'detail';
  return 'summary';
}

function scopesForMode(mode: string): FinancialScope[] {
  if (mode === 'dataroom') {
    return ['financial_summary', 'financial_detail', 'dataroom'];
  }
  if (mode === 'detail') {
    return ['financial_summary', 'financial_detail'];
  }
  return ['financial_summary'];
}

function scopeLabel(lang: Lang, scopes: any) {
  const mode = financialScopeMode(scopes);
  if (mode === 'dataroom') return T(lang, 'Số liệu chi tiết + Dataroom', 'Detailed data + Dataroom');
  if (mode === 'detail') return T(lang, 'Số liệu chi tiết', 'Detailed financial data');
  return T(lang, 'Chỉ số liệu tóm tắt', 'Financial summary only');
}

function activeDataRequestGrant(row: any) {
  const sources = Array.isArray(row?.financial_access?.sources)
    ? row.financial_access.sources
    : [];
  return sources.find((source: any) =>
    String(source?.source_type) === 'data_request' &&
    String(source?.source_id) === String(row?.id) &&
    source?.grant_id
  ) || null;
}

function FinancialRequestRow({
  lang,
  row,
  busy,
  onApprove,
  onReject,
  onRevoke,
}: any) {
  const [mode, setMode] = useState(
    financialScopeMode(
      row.granted_scopes?.length ? row.granted_scopes : row.requested_scopes,
    ),
  );
  const status = String(row.status || 'pending').toLowerCase();
  const grant = activeDataRequestGrant(row);
  const pending = ['pending', 'forwarded'].includes(status);
  const rejected = status === 'rejected';
  const granted = status === 'fulfilled' && !!grant;
  const revoked = status === 'fulfilled' && !grant;
  const investor = row.investors || {};
  const badge = pending
    ? { cls: 'gold', label: T(lang, 'Chờ xử lý', 'Pending') }
    : rejected
      ? { cls: 'red', label: T(lang, 'Đã từ chối', 'Rejected') }
      : granted
        ? { cls: 'green', label: T(lang, 'Đã cấp quyền', 'Access granted') }
        : { cls: 'gold', label: T(lang, 'Đã thu hồi', 'Revoked') };

  return (
    <article className="d68-financial-request-card">
      <div className="d68-financial-request-card__head">
        <div>
          <h3>{investor.title_vi || investor.title_en || investor.code || row.investor_id}</h3>
          <small>
            {new Date(row.created_at || Date.now()).toLocaleString(
              lang === 'en' ? 'en-US' : 'vi-VN',
            )}
          </small>
        </div>
        <span className={`d68-dashboard-badge ${badge.cls}`}>{badge.label}</span>
      </div>
      <div className="d68-financial-request-card__body">
        <div>
          <b>{T(lang, 'Phạm vi yêu cầu', 'Requested scope')}</b>
          <span>{scopeLabel(lang, row.requested_scopes || row.requested_items)}</span>
        </div>
        {granted ? (
          <div>
            <b>{T(lang, 'Quyền đang cấp', 'Current grant')}</b>
            <span>{scopeLabel(lang, row.granted_scopes)}</span>
          </div>
        ) : null}
        {userFacingNote(row) ? <p>{userFacingNote(row)}</p> : null}
        {row.response_note ? <p>{row.response_note}</p> : null}
      </div>
      <div className="d68-financial-request-card__actions">
        {pending || revoked ? (
          <label className="d68-dashboard-field d68-financial-request-scope">
            <span>{T(lang, 'Phạm vi cấp quyền', 'Grant scope')}</span>
            <select
              className="d68-dashboard-input"
              value={mode}
              disabled={busy}
              onChange={(event) => setMode(event.target.value as any)}
            >
              <option value="summary">{T(lang, 'Chỉ số liệu tóm tắt', 'Financial summary only')}</option>
              <option value="detail">{T(lang, 'Số liệu chi tiết', 'Detailed financial data')}</option>
              <option value="dataroom">{T(lang, 'Số liệu chi tiết + Dataroom', 'Detailed data + Dataroom')}</option>
            </select>
          </label>
        ) : null}
        {pending || revoked ? (
          <button
            type="button"
            disabled={busy}
            className="d68-dashboard-btn green"
            onClick={() => onApprove(row, scopesForMode(mode))}
          >
            {revoked
              ? T(lang, 'Cấp lại quyền', 'Grant again')
              : T(lang, 'Chấp thuận & cấp quyền', 'Approve & grant access')}
          </button>
        ) : null}
        {pending ? (
          <button
            type="button"
            disabled={busy}
            className="d68-dashboard-btn red"
            onClick={() => onReject(row)}
          >
            {T(lang, 'Từ chối yêu cầu', 'Reject request')}
          </button>
        ) : null}
        {granted ? (
          <button
            type="button"
            disabled={busy}
            className="d68-dashboard-btn red"
            onClick={() => onRevoke(row, grant.grant_id)}
          >
            {T(lang, 'Thu hồi quyền', 'Revoke access')}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function FinancialRequestRows({
  lang,
  rows,
  busy,
  onApprove,
  onReject,
  onRevoke,
}: any) {
  return (
    <div className="d68-dashboard-card">
      <h2>{T(lang, 'Yêu cầu số liệu tài chính', 'Financial data requests')}</h2>
      <p>
        {T(
          lang,
          'Chấp thuận theo đúng phạm vi cần chia sẻ. Quyền có thể được thu hồi bất kỳ lúc nào.',
          'Approve only the required scope. Access can be revoked at any time.',
        )}
      </p>
      <div className="d68-financial-request-list">
        {rows.map((row: any) => (
          <FinancialRequestRow
            key={`${row.id}:${row.updated_at || ''}`}
            lang={lang}
            row={row}
            busy={busy}
            onApprove={onApprove}
            onReject={onReject}
            onRevoke={onRevoke}
          />
        ))}
      </div>
      {!rows.length ? (
        <div className="d68-dashboard-empty">
          {T(lang, 'Chưa có yêu cầu số liệu.', 'No financial data requests yet.')}
        </div>
      ) : null}
    </div>
  );
}

function BusinessBillingPanel({ lang, b, payments, profile, setMsg, setErr, onReload }: any) {""",
)

replace_once(
    'src/pages/BusinessDetail.tsx',
    "import SensitiveFinancialValue from '../components/business/SensitiveFinancialValue';\n",
    "import SensitiveFinancialValue from '../components/business/SensitiveFinancialValue';\nimport { requestBusinessFinancialAccess } from '../lib/businessFinancialAccess';\n",
)
replace_regex(
    'src/pages/BusinessDetail.tsx',
    r"  async function requestData\(\) \{.*?\n  \}\n  async function downloadDoc",
    r"""  async function requestData() {
    if (!profile) { setMsg(T(lang, 'Bạn cần là nhà đầu tư để thao tác. Hãy đăng ký/đăng nhập tài khoản nhà đầu tư để thực hiện.', 'You need an Investor account to perform this action. Please register or log in as an investor.')); return; }
    if (profile.role !== 'investor') { setMsg(T(lang, 'Chỉ tài khoản Nhà đầu tư được yêu cầu số liệu.', 'Only Investor accounts can request financial data.')); return; }
    if (!business?.id) { setMsg(T(lang, 'Không tìm thấy hồ sơ doanh nghiệp.', 'Business profile not found.')); return; }
    try {
      const result = await requestBusinessFinancialAccess(
        business.id,
        ['financial_summary', 'financial_detail'],
        'Requested from public Business Detail page.',
      );
      setBusiness((current: any) => current ? {
        ...current,
        financial_request_status: result?.status || 'pending',
      } : current);
      setMsg(
        result?.existing
          ? T(lang, 'Yêu cầu số liệu đang chờ doanh nghiệp chấp thuận.', 'Your financial data request is awaiting Business approval.')
          : T(lang, 'Đã gửi yêu cầu số liệu qua Deals68.', 'Financial data request sent via Deals68.'),
      );
    } catch (requestError: any) {
      setMsg(requestError?.message || T(lang, 'Không gửi được yêu cầu số liệu.', 'Could not send the financial data request.'));
    }
  }
  async function downloadDoc""",
)
replace_once(
    'src/pages/BusinessDetail.tsx',
    """  if (loading) return <main className="d68-business-detail-page">""",
    """  const financialRequestPending = ['pending', 'forwarded'].includes(
    String(business?.financial_request_status || '').toLowerCase(),
  );
  const financialDetailGranted =
    String(business?.financial_access_level || 'none') === 'detail';
  const financialRequestLabel = financialDetailGranted
    ? T(lang, 'Đã được cấp quyền', 'Access granted')
    : financialRequestPending
      ? T(lang, 'Đang chờ chấp thuận', 'Awaiting approval')
      : T(lang, 'Yêu cầu số liệu', 'Request financial data');

  if (loading) return <main className="d68-business-detail-page">""",
)
replace_once(
    'src/pages/BusinessDetail.tsx',
    """<button type="button" onClick={requestData}>🔒 {T(lang, 'Yêu cầu tài liệu', 'Request data')}</button>""",
    """<button
              type="button"
              disabled={financialRequestPending || financialDetailGranted}
              onClick={requestData}
            >🔒 {financialRequestLabel}</button>""",
)

css_path = 'src/styles/pages/dashboard.css'
css = read(css_path)
css_addition = r"""

/* Business Financial Dashboard — Phase D */
.d68-financial-request-list{display:grid;gap:14px;margin-top:16px}
.d68-financial-request-card{border:1px solid #DCEAF5;border-radius:14px;background:#F7FAFC;padding:16px}
.d68-financial-request-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.d68-financial-request-card__head h3{margin:0 0 4px;font-size:15px;color:#0F2A4A}
.d68-financial-request-card__head small{color:#718096}
.d68-financial-request-card__body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}
.d68-financial-request-card__body>div{border:1px solid #E2E8F0;border-radius:10px;background:#fff;padding:11px}
.d68-financial-request-card__body b,.d68-financial-request-card__body span{display:block;font-size:12.5px}
.d68-financial-request-card__body span{margin-top:4px;color:#475569}
.d68-financial-request-card__body p{grid-column:1/-1;margin:0;font-size:12.5px}
.d68-financial-request-card__actions{display:flex;align-items:flex-end;justify-content:flex-end;gap:9px;flex-wrap:wrap}
.d68-financial-request-scope{min-width:250px;margin-right:auto}
.d68-proposal-financial-summary{display:grid;grid-template-columns:repeat(2,minmax(0,180px));gap:10px;margin-top:10px}
.d68-proposal-financial-summary>div{border:1px solid #DCEAF5;border-radius:10px;background:#F7FAFC;padding:9px 10px}
.d68-proposal-financial-summary small{display:block;color:#718096;font-size:10.5px;font-weight:800;text-transform:uppercase}
.d68-proposal-financial-summary b{display:block;margin-top:4px;font-size:13px}
@media(max-width:700px){
  .d68-financial-request-card__body,.d68-proposal-financial-summary{grid-template-columns:1fr}
  .d68-financial-request-card__actions{align-items:stretch}
  .d68-financial-request-scope{min-width:100%;width:100%}
  .d68-financial-request-card__actions .d68-dashboard-btn{width:100%}
}
"""
if '/* Business Financial Dashboard — Phase D */' not in css:
    write(css_path, css.rstrip() + css_addition)

pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['scripts']['qa:financial-dashboard-phase-d'] = (
    'node scripts/deals68-business-financial-dashboard-phase-d-check.mjs'
)
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

state_path = 'docs/release/MIGRATION_STATE.md'
state = read(state_path)
entry = (
    "- `20260724110000_business_financial_dashboard_phase_d_v1.sql` — "
    "Phase D cutover migration; adds audited Proposal response and batch access-state RPCs, "
    "enriches Business/Investor Dashboard relation payloads, and revokes direct browser "
    "mutations of `proposals`/`request_data`. Apply immediately before deploying the matching "
    "Phase D frontend; not yet recorded in the production migration ledger.\n"
)
anchor = "\nRules:\n"
if entry not in state:
    if anchor not in state:
        raise RuntimeError('Migration state Rules anchor missing')
    state = state.replace(anchor, '\n' + entry + anchor, 1)
    write(state_path, state)

print('Phase D source patch applied.')
