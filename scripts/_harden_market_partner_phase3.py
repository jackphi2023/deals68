from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

path = Path('scripts/qa-market-partner-v1.mjs')
text = path.read_text()
text = replace_once(
    text,
    "assert.match(phase3, /clicked_at >= now\\(\\) - interval '30 days'/i);\n",
    "assert.match(phase3, /clicked_at >= now\\(\\) - interval '30 days'/i);\nassert.match(phase3, /if v_requested_click_id is null then[\\s\\S]*return new;/i);\nassert.match(phase3, /if v_click_id is null then[\\s\\S]*return new;/i);\n",
    'Phase3 click requirement assertions',
)
text = replace_once(
    text,
    "assert.ok(affiliate.includes(\"url.searchParams.delete('ref')\"));\n",
    "assert.ok(affiliate.includes(\"url.searchParams.delete('ref')\"));\nassert.ok(affiliate.includes('writeReferralCookie(record)'));\nassert.ok(affiliate.includes('`${record.code}|${record.clickId}`'));\n",
    'Affiliate cookie assertions',
)
text = replace_once(
    text,
    "  const invalidCustomerId = '00000000-0000-0000-0000-000000000004';\n",
    "  const invalidCustomerId = '00000000-0000-0000-0000-000000000004';\n  const noClickCustomerId = '00000000-0000-0000-0000-000000000005';\n",
    'No-click customer ID',
)
text = replace_once(
    text,
    "  await db.exec(`insert into public.profiles(id,role,email) values ('${invalidCustomerId}','investor','invalid@example.com');`);\n  assert.equal((await db.query(`select count(*)::int as count from public.affiliate_attributions;`)).rows[0].count, 1);\n",
    "  await db.exec(`insert into public.profiles(id,role,email) values ('${invalidCustomerId}','investor','invalid@example.com');`);\n  await db.exec(`insert into auth.users(id,created_at,raw_user_meta_data) values ('${noClickCustomerId}',now(),'{\"affiliate_code\":\"QA-PARTNER\"}'::jsonb);`);\n  await db.exec(`insert into public.profiles(id,role,email) values ('${noClickCustomerId}','business','noclick@example.com');`);\n  assert.equal((await db.query(`select count(*)::int as count from public.affiliate_attributions;`)).rows[0].count, 1);\n",
    'No-click attribution rejection',
)
path.write_text(text)
