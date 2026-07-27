#!/usr/bin/env node
import fs from 'node:fs';

const path = 'src/pages/Admin.tsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Admin Phase 5 patch expected one match, found ${count}: ${before.slice(0, 120)}`);
  source = source.replace(before, after);
}

replaceOnce(
  `import AdminPromoManager from '../components/admin/AdminPromoManager';\n`,
  `import AdminPromoManager from '../components/admin/AdminPromoManager';\nimport AdminMarketPartnerFinance from '../components/admin/AdminMarketPartnerFinance';\n`,
);

replaceOnce(
`import {
  DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY,
  convertPartnerLead,
  createMarketPartner,
  listAdminMarketPartners,
  regenerateMarketPartnerCode,
  updateMarketPartner,
  type MarketPartnerInput,
  type MarketPartnerRow,
  type MarketPartnerStatus,
  type PartnerLeadConversionInput,
  type PartnerLeadRow,
} from '../lib/marketPartners';`,
`import {
  DEFAULT_MARKET_PARTNER_COMMERCIAL_POLICY,
  convertPartnerLead,
  createAffiliatePayout,
  createMarketPartner,
  listAdminAffiliateCommissions,
  listAdminAffiliatePayouts,
  listAdminMarketPartners,
  regenerateMarketPartnerCode,
  setAffiliateCommissionStatus,
  setAffiliatePayoutStatus,
  updateMarketPartner,
  type AffiliateCommissionRow,
  type AffiliatePayoutRow,
  type MarketPartnerInput,
  type MarketPartnerRow,
  type MarketPartnerStatus,
  type PartnerLeadConversionInput,
  type PartnerLeadRow,
} from '../lib/marketPartners';`,
);

replaceOnce(
  `  const [marketPartners, setMarketPartners] = useState<MarketPartnerRow[]>([]);\n`,
  `  const [marketPartners, setMarketPartners] = useState<MarketPartnerRow[]>([]);\n  const [affiliateCommissions, setAffiliateCommissions] = useState<AffiliateCommissionRow[]>([]);\n  const [affiliatePayouts, setAffiliatePayouts] = useState<AffiliatePayoutRow[]>([]);\n`,
);

replaceOnce(
`        leadResult,
        marketPartnerResult,
      ] = await Promise.all([`,
`        leadResult,
        marketPartnerResult,
        affiliateCommissionResult,
        affiliatePayoutResult,
      ] = await Promise.all([`,
);

replaceOnce(
`        supabase.from('partner_leads').select('*').order('created_at', { ascending: false }).limit(300),
        listAdminMarketPartners(),
      ]);`,
`        supabase.from('partner_leads').select('*').order('created_at', { ascending: false }).limit(300),
        listAdminMarketPartners(),
        listAdminAffiliateCommissions(),
        listAdminAffiliatePayouts(),
      ]);`,
);

replaceOnce(
`      setPartnerLeads(leadResult.data || []);
      setMarketPartners(marketPartnerResult || []);
      setLastRefreshedAt(new Date().toISOString());`,
`      setPartnerLeads(leadResult.data || []);
      setMarketPartners(marketPartnerResult || []);
      setAffiliateCommissions(affiliateCommissionResult || []);
      setAffiliatePayouts(affiliatePayoutResult || []);
      setLastRefreshedAt(new Date().toISOString());`,
);

replaceOnce(
`      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_partners' }, () => load())
      .subscribe();`,
`      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_partners' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'affiliate_commissions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'affiliate_payouts' }, () => load())
      .subscribe();`,
);

replaceOnce(
`  async function regenerateMarketPartnerCodeAdmin(partner: MarketPartnerRow, preferredCode?: string) {
    setBusy(true); setError(''); setMsg('');
    try {
      const updated = await regenerateMarketPartnerCode(partner.id, preferredCode);
      setMsg(\`Mã affiliate mới: \${updated.affiliate_code}.\`);
      await load();
    } catch (actionError: any) { setError(actionError?.message || 'Could not regenerate affiliate code.'); }
    finally { setBusy(false); }
  }

  return (`,
`  async function regenerateMarketPartnerCodeAdmin(partner: MarketPartnerRow, preferredCode?: string) {
    setBusy(true); setError(''); setMsg('');
    try {
      const updated = await regenerateMarketPartnerCode(partner.id, preferredCode);
      setMsg(\`Mã affiliate mới: \${updated.affiliate_code}.\`);
      await load();
    } catch (actionError: any) { setError(actionError?.message || 'Could not regenerate affiliate code.'); }
    finally { setBusy(false); }
  }

  async function setAffiliateCommissionStatusAdmin(
    commission: AffiliateCommissionRow,
    status: 'approved' | 'rejected' | 'reversed',
    note?: string,
  ) {
    setBusy(true); setError(''); setMsg('');
    try {
      await setAffiliateCommissionStatus(commission.id, status, note);
      setMsg(\`Đã cập nhật commission thành \${status}.\`);
      await load();
    } catch (actionError: any) { setError(actionError?.message || 'Could not update affiliate commission.'); }
    finally { setBusy(false); }
  }

  async function createAffiliatePayoutAdmin(
    partnerId: string,
    currency: string,
    commissionIds: string[],
  ) {
    setBusy(true); setError(''); setMsg('');
    try {
      const payout = await createAffiliatePayout({ partnerId, currency, commissionIds });
      setMsg(\`Đã tạo payout draft \${payout.payout_code}.\`);
      await load();
    } catch (actionError: any) { setError(actionError?.message || 'Could not create affiliate payout.'); }
    finally { setBusy(false); }
  }

  async function setAffiliatePayoutStatusAdmin(
    payout: AffiliatePayoutRow,
    status: 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled',
    paymentReference?: string,
    note?: string,
  ) {
    setBusy(true); setError(''); setMsg('');
    try {
      await setAffiliatePayoutStatus(payout.id, status, paymentReference, note);
      setMsg(\`Đã cập nhật payout \${payout.payout_code} thành \${status}.\`);
      await load();
    } catch (actionError: any) { setError(actionError?.message || 'Could not update affiliate payout.'); }
    finally { setBusy(false); }
  }

  return (`,
);

replaceOnce(
`                partners={marketPartners}
                leads={partnerLeads as PartnerLeadRow[]}
                busy={busy}
                onCreate={createMarketPartnerAdmin}
                onConvert={convertPartnerLeadAdmin}
                onUpdate={updateMarketPartnerAdmin}
                onRegenerate={regenerateMarketPartnerCodeAdmin}
              />`,
`                partners={marketPartners}
                leads={partnerLeads as PartnerLeadRow[]}
                commissions={affiliateCommissions}
                payouts={affiliatePayouts}
                busy={busy}
                onCreate={createMarketPartnerAdmin}
                onConvert={convertPartnerLeadAdmin}
                onUpdate={updateMarketPartnerAdmin}
                onRegenerate={regenerateMarketPartnerCodeAdmin}
                onCommissionStatus={setAffiliateCommissionStatusAdmin}
                onCreatePayout={createAffiliatePayoutAdmin}
                onPayoutStatus={setAffiliatePayoutStatusAdmin}
              />`,
);

replaceOnce(
`type MarketPartnerAdminProps = {
  partners: MarketPartnerRow[];
  leads: PartnerLeadRow[];
  busy: boolean;
  onCreate: (input: MarketPartnerInput) => Promise<void>;
  onConvert: (lead: PartnerLeadRow, input: PartnerLeadConversionInput) => Promise<void>;
  onUpdate: (partner: MarketPartnerRow, input: MarketPartnerInput & { suspensionReason?: string }) => Promise<void>;
  onRegenerate: (partner: MarketPartnerRow, preferredCode?: string) => Promise<void>;
};`,
`type MarketPartnerAdminProps = {
  partners: MarketPartnerRow[];
  leads: PartnerLeadRow[];
  commissions: AffiliateCommissionRow[];
  payouts: AffiliatePayoutRow[];
  busy: boolean;
  onCreate: (input: MarketPartnerInput) => Promise<void>;
  onConvert: (lead: PartnerLeadRow, input: PartnerLeadConversionInput) => Promise<void>;
  onUpdate: (partner: MarketPartnerRow, input: MarketPartnerInput & { suspensionReason?: string }) => Promise<void>;
  onRegenerate: (partner: MarketPartnerRow, preferredCode?: string) => Promise<void>;
  onCommissionStatus: (commission: AffiliateCommissionRow, status: 'approved' | 'rejected' | 'reversed', note?: string) => Promise<void>;
  onCreatePayout: (partnerId: string, currency: string, commissionIds: string[]) => Promise<void>;
  onPayoutStatus: (payout: AffiliatePayoutRow, status: 'approved' | 'processing' | 'paid' | 'rejected' | 'cancelled', paymentReference?: string, note?: string) => Promise<void>;
};`,
);

replaceOnce(
`  partners,
  leads,
  busy,
  onCreate,
  onConvert,
  onUpdate,
  onRegenerate,
}: MarketPartnerAdminProps) {`,
`  partners,
  leads,
  commissions,
  payouts,
  busy,
  onCreate,
  onConvert,
  onUpdate,
  onRegenerate,
  onCommissionStatus,
  onCreatePayout,
  onPayoutStatus,
}: MarketPartnerAdminProps) {`,
);

replaceOnce(
`      </div> : <Empty text="Chưa có Market Partner account record." />}
    </Card>
  </div>;`,
`      </div> : <Empty text="Chưa có Market Partner account record." />}
    </Card>

    <AdminMarketPartnerFinance
      partners={partners}
      commissions={commissions}
      payouts={payouts}
      busy={busy}
      onCommissionStatus={onCommissionStatus}
      onCreatePayout={onCreatePayout}
      onPayoutStatus={onPayoutStatus}
    />
  </div>;`,
);

replaceOnce(
  `partner_leads chỉ là form tiếp nhận. Chuyển đổi tạo một market_partners record độc lập; tài khoản Auth sẽ được liên kết ở Phase 2.`,
  `partner_leads chỉ là form tiếp nhận. Sau khi convert, Partner kích hoạt tài khoản bằng email và mã affiliate đã được Admin phê duyệt.`,
);

replaceOnce(
  `Để trống mã affiliate để server sinh mã duy nhất. Phase 1 không tạo hoặc đổi Auth user.`,
  `Để trống mã affiliate để server sinh mã duy nhất. Partner dùng email + mã này để kích hoạt tài khoản qua OTP.`,
);

fs.writeFileSync(path, source);
console.log('✓ Phase 5 Admin wiring applied.');
