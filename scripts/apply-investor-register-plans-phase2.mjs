#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`${path}: expected source fragment not found`);
  }
  const next = source.replace(before, after);
  if (next === source) throw new Error(`${path}: replacement produced no change`);
  fs.writeFileSync(path, next);
}

function replaceBetween(path, startMarker, endMarker, replacement) {
  const source = fs.readFileSync(path, 'utf8');
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${path}: start marker not found`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${path}: end marker not found`);
  fs.writeFileSync(path, source.slice(0, start) + replacement + source.slice(end));
}

const migrationName = '20260723193000_investor_standard_premium_registration_v1.sql';

replaceOnce(
  'src/pages/Register.tsx',
  "import { makePaymentOrderCode } from '../lib/paymentOrders';\n",
  "import { makePaymentOrderCode } from '../lib/paymentOrders';\nimport type { InvestorPlan } from '../lib/investorPlans';\n",
);

replaceOnce(
  'src/pages/Register.tsx',
  "      normalized === 'investor' &&\n      [4, 8, 12, 16, 24].includes(requestedMonths)",
  "      normalized === 'investor' &&\n      intent.investorPlan === 'premium' &&\n      [4, 8, 12, 16, 24].includes(requestedMonths)",
);

replaceOnce(
  'src/pages/Register.tsx',
  "  const [promoCode, setPromoCode] = useState('');\n",
  "  const [investorPlan, setInvestorPlan] = useState<InvestorPlan>(() =>\n    checkoutIntentMatchesRole &&\n    normalized === 'investor' &&\n    intent.investorPlan === 'premium'\n      ? 'premium'\n      : 'standard',\n  );\n  const [promoCode, setPromoCode] = useState('');\n",
);

replaceOnce(
  'src/pages/Register.tsx',
  "  const isInvestor = normalized === 'investor';\n",
  "  const isInvestor = normalized === 'investor';\n  const investorPremiumSelected = isInvestor && investorPlan === 'premium';\n",
);

replaceOnce(
  'src/pages/Register.tsx',
  "  const hasSelectedPackage = isBusiness\n    ? Boolean(plan && serviceWeeks)\n    : isInvestor\n      ? Boolean(investorMonths)\n      : true;",
  "  const hasSelectedPackage = isBusiness\n    ? Boolean(plan && serviceWeeks)\n    : isInvestor\n      ? investorPremiumSelected && Boolean(investorMonths)\n      : true;",
);

replaceOnce(
  'src/pages/Register.tsx',
  "  const pricingSummary = hasSelectedPackage\n    ? isInvestor\n      ? `${money(price.total, price.currency)} · ${investorMonths} ${T(\n          lang,\n          'tháng',\n          'months',\n        )}`\n      : `${money(price.total, price.currency)} · ${price.termWeeks} ${T(\n          lang,\n          'tuần',\n          'weeks',\n        )}`\n    : '-';",
  "  const pricingSummary = isInvestor && investorPlan === 'standard'\n    ? T(lang, 'Miễn phí · Nhà đầu tư Tiêu chuẩn', 'Free · Standard Investor')\n    : hasSelectedPackage\n      ? isInvestor\n        ? `${money(price.total, price.currency)} · ${investorMonths} ${T(\n            lang,\n            'tháng',\n            'months',\n          )}`\n        : `${money(price.total, price.currency)} · ${price.termWeeks} ${T(\n            lang,\n            'tuần',\n            'weeks',\n          )}`\n      : '-';",
);

replaceOnce(
  'src/pages/Register.tsx',
  "      if (!investorMonths) {\n        missing.push(T(lang, 'Kỳ hạn', 'Term'));\n      } else if (!paymentAck) {\n        missing.push(\n          T(\n            lang,\n            'Xác nhận đã chuyển khoản đúng nội dung',\n            'Payment transfer confirmation',\n          ),\n        );\n      }",
  "      if (investorPremiumSelected) {\n        if (!investorMonths) {\n          missing.push(T(lang, 'Kỳ hạn', 'Term'));\n        } else if (!paymentAck) {\n          missing.push(\n            T(\n              lang,\n              'Xác nhận đã chuyển khoản đúng nội dung',\n              'Payment transfer confirmation',\n            ),\n          );\n        }\n      }",
);

replaceOnce(
  'src/pages/Register.tsx',
  "        payment: {\n          title: `${roleLabel(normalized as any, lang)} · ${pricingSummary}`,\n          role: normalized,\n          country: countryCode,\n          plan: isBusiness ? selectedBusinessPlan : 'membership',\n          checkout_intent: intent,\n          price,\n          orderCode: registrationOrderCode,\n          bankContent: registrationOrderCode,\n          source: 'register_main_release_safe',\n        },",
  "        payment: {\n          title: `${roleLabel(normalized as any, lang)} · ${pricingSummary}`,\n          role: normalized,\n          country: countryCode,\n          plan: isBusiness\n            ? selectedBusinessPlan\n            : isInvestor\n              ? investorPlan\n              : 'membership',\n          investorPlan: isInvestor ? investorPlan : undefined,\n          termMonths: investorPremiumSelected ? investorMonths : undefined,\n          skipPayment: isInvestor && investorPlan === 'standard',\n          orderType: isInvestor\n            ? investorPlan === 'standard'\n              ? 'investor_standard_registration'\n              : 'investor_registration'\n            : undefined,\n          checkout_intent: intent,\n          price: isInvestor && investorPlan === 'standard'\n            ? {\n                ...price,\n                baseWeekly: 0,\n                featuredWeekly: 0,\n                planWeekly: 0,\n                termWeeks: 0,\n                subtotal: 0,\n                termDiscountPct: 0,\n                termDiscount: 0,\n                promoDiscountPct: 0,\n                promoDiscount: 0,\n                total: 0,\n                planLabel: 'Standard',\n              }\n            : price,\n          orderCode: registrationOrderCode,\n          bankContent: registrationOrderCode,\n          source: 'register_main_release_safe',\n        },",
);

const paymentSection = String.raw`  const paymentSection = (
    <section
      className={
        'd68-register-section d68-register-section--pricing' +
        (isBusiness
          ? ' d68-register-section--business-pricing'
          : isInvestor
            ? ' d68-register-section--investor-pricing'
            : '')
      }
    >
      <h2>{T(lang, 'Gói dịch vụ và Thanh toán', 'Service package and Payment')}</h2>

      {isInvestor ? (
        <div className="d68-bizreg-options d68-investor-plan-options">
          <button
            type="button"
            className={investorPlan === 'standard' ? 'active' : ''}
            aria-pressed={investorPlan === 'standard'}
            onClick={() => {
              setInvestorPlan('standard');
              setInvestorMonths(null);
              setPromoCode('');
              setPromoPct(0);
              setPromoMsg('');
              setPaymentAck(false);
            }}
          >
            <h3>{T(lang, 'Nhà đầu tư Tiêu chuẩn', 'Standard Investor')}</h3>
            <p>
              {T(
                lang,
                'Miễn phí. Sử dụng các tính năng kết nối cơ bản dành cho Nhà đầu tư.',
                'Free. Use the core connection features available to Investors.',
              )}
            </p>
            <span>{T(lang, 'Mặc định · Miễn phí', 'Default · Free')}</span>
          </button>
          <button
            type="button"
            className={investorPlan === 'premium' ? 'active' : ''}
            aria-pressed={investorPlan === 'premium'}
            onClick={() => {
              setInvestorPlan('premium');
              setPaymentAck(false);
            }}
          >
            <h3>{T(lang, 'Nhà đầu tư Nâng cao', 'Premium Investor')}</h3>
            <p>
              {T(
                lang,
                'Được sử dụng tính năng Báo cáo Phân tích cơ hội đầu tư',
                'Access the Investment Opportunity Analysis Report feature',
              )}
            </p>
            <span>
              {money(price.baseWeekly, price.currency)} / {T(lang, 'tháng', 'month')}
            </span>
          </button>
        </div>
      ) : null}

      {isInvestor && investorPremiumSelected ? (
        <p className="d68-bizreg-section-help">
          {T(lang, 'Vui lòng chọn thời gian sử dụng.', 'Please select the service duration.')}
        </p>
      ) : null}

      {isBusiness ? (
        <div className="d68-bizreg-options">
          {([
            {
              key: 'standard' as BusinessPlan,
              title: T(lang, 'Gói Thường', 'Regular package'),
              desc: T(
                lang,
                'Hiển thị tại danh sách và gửi Hồ sơ doanh nghiệp tới tối đa ' +
                  BUSINESS_STANDARD_PROPOSAL_QUOTA +
                  ' nhà đầu tư',
                'Display in the listing and send your business profile to up to ' +
                  BUSINESS_STANDARD_PROPOSAL_QUOTA +
                  ' investors',
              ),
              badge: T(
                lang,
                BUSINESS_STANDARD_PROPOSAL_QUOTA + ' lượt gửi Hồ sơ doanh nghiệp',
                BUSINESS_STANDARD_PROPOSAL_QUOTA + ' business profile sends',
              ),
            },
            {
              key: 'featured' as BusinessPlan,
              title: T(lang, 'Gói Ưu tiên ★', 'Priority package ★'),
              desc: T(
                lang,
                'Hiển thị tại danh sách/trang chủ và gửi Hồ sơ doanh nghiệp tới tối đa ' +
                  BUSINESS_FEATURED_PROPOSAL_QUOTA +
                  ' nhà đầu tư',
                'Display in the listing/homepage and send your business profile to up to ' +
                  BUSINESS_FEATURED_PROPOSAL_QUOTA +
                  ' investors',
              ),
              badge: T(
                lang,
                BUSINESS_FEATURED_PROPOSAL_QUOTA + ' lượt gửi Hồ sơ doanh nghiệp',
                BUSINESS_FEATURED_PROPOSAL_QUOTA + ' business profile sends',
              ),
            },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              className={plan === item.key ? 'active' : ''}
              onClick={() => {
                setPlan(item.key);
                setPaymentAck(false);
              }}
            >
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <span>{item.badge}</span>
              {item.key === 'featured' ? (
                <em>+30% {T(lang, 'so với gói Thường', 'vs Standard')}</em>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {!isInvestor || investorPremiumSelected ? (
        <>
          <div className="d68-bizreg-paygrid">
            <div className="d68-bizreg-payleft">
              <label className="d68-bizreg-label">
                {T(lang, 'Kỳ hạn', 'Term')} <small>({termUnitLabel})</small>
              </label>
              <div className="d68-bizreg-terms">
                {termOptions.map((term) => {
                  const termWeeks = isInvestor ? term * 4 : term;
                  const temporary = calculatePricing(
                    {
                      role: pricingRole,
                      country: countryCode,
                      termWeeks,
                      businessPlan: selectedBusinessPlan,
                      promoCode,
                    },
                    promoPct,
                  );
                  return (
                    <button
                      type="button"
                      key={term}
                      className={currentTermValue === term ? 'active' : ''}
                      onClick={() => {
                        if (isInvestor) setInvestorMonths(term);
                        else setServiceWeeks(term);
                        setPaymentAck(false);
                      }}
                    >
                      <b>{term}</b>
                      {temporary.termDiscountPct ? (
                        <span>-{temporary.termDiscountPct}%</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <label className="d68-bizreg-label">
                {T(lang, 'Mã khuyến mãi/giới thiệu', 'Promo/referral code')}
              </label>
              <div className="d68-bizreg-promo">
                <input
                  value={promoCode}
                  onChange={(event) =>
                    setPromoCode(event.target.value.toUpperCase())
                  }
                  placeholder={T(lang, 'Nhập mã (nếu có)', 'Enter code (optional)')}
                />
                <button
                  type="button"
                  disabled={promoLoading}
                  onClick={async () => {
                    setPromoLoading(true);
                    const result = await lookupPromo(promoCode, pricingRole).catch(
                      (promoError: any) => ({
                        discountPct: 0,
                        message: promoError?.message || 'Could not check promo.',
                      }),
                    );
                    setPromoLoading(false);
                    setPromoPct(Number(result.discountPct || 0));
                    setPromoMsg(
                      result.discountPct
                        ? T(
                            lang,
                            'Mã hợp lệ, đã cập nhật số tiền giảm giá',
                            'Valid code, discount amount updated',
                          )
                        : result.message || T(lang, 'Mã không hợp lệ.', 'Invalid code.'),
                    );
                  }}
                >
                  {promoLoading ? '...' : T(lang, 'Áp dụng', 'Apply')}
                </button>
              </div>
              {promoMsg ? (
                <p
                  className={
                    promoPct
                      ? 'd68-bizreg-promo-ok'
                      : 'd68-bizreg-promo-warn'
                  }
                >
                  {promoMsg}
                </p>
              ) : null}
            </div>

            <aside className="d68-bizreg-summary">
              <span>{T(lang, 'Tạm tính', 'Estimate')}</span>
              <RowMini
                a={T(
                  lang,
                  'Phí dịch vụ (' +
                    currentTermDisplay +
                    ' ' +
                    (isInvestor ? 'tháng' : 'tuần') +
                    ')',
                  'Service fee (' +
                    currentTermDisplay +
                    ' ' +
                    (isInvestor ? 'months' : 'weeks') +
                    ')',
                )}
                b={hasSelectedPackage ? money(price.subtotal, price.currency) : '-'}
              />
              <RowMini
                a={T(lang, 'Chiết khấu kỳ hạn', 'Term discount')}
                b={
                  hasSelectedPackage
                    ? price.termDiscountPct
                      ? '-' +
                        money(price.termDiscount, price.currency) +
                        ' (' +
                        price.termDiscountPct +
                        '%)'
                      : T(lang, 'Không', 'None')
                    : '-'
                }
                good={hasSelectedPackage && !!price.termDiscountPct}
              />
              <RowMini
                a={T(lang, 'Giảm giá', 'Promo discount')}
                b={
                  hasSelectedPackage
                    ? price.promoDiscountPct
                      ? '-' +
                        money(price.promoDiscount, price.currency) +
                        ' (' +
                        price.promoDiscountPct +
                        '%)'
                      : T(lang, 'Không', 'None')
                    : '-'
                }
                good={hasSelectedPackage && !!price.promoDiscountPct}
              />
              <strong>
                {T(lang, 'Tổng thanh toán', 'Total due')}
                <b>{hasSelectedPackage ? money(price.total, price.currency) : '-'}</b>
              </strong>
            </aside>
          </div>

          <div className="d68-bizreg-payment-methods d68-bizreg-payment-methods--primary">
            <button type="button" className="active">
              <span>💵</span>
              {T(lang, 'Chuyển khoản QR', 'QR bank transfer')}
            </button>
          </div>

          {hasSelectedPackage ? (
            <div className="d68-bizreg-qrbox">
              <a href={qrImageSrc} target="_blank" rel="noreferrer">
                <img
                  src={qrImageSrc}
                  alt="QR Vietcombank"
                  onError={() => setQrImageSrc(STATIC_VIETQR_URL)}
                />
              </a>
              <div>
                <p>{T(lang, 'Người nhận:', 'Recipient:')} <b>Tieu Vo Dinh Phi</b></p>
                <p>{T(lang, 'Số TK:', 'Account no.:')} <b>0011004000713</b></p>
                <p>{T(lang, 'Nội dung:', 'Transfer note:')} <b>{bankContent}</b></p>
                <p>{T(lang, 'Số tiền:', 'Amount:')} <b>{money(price.total, price.currency)}</b></p>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={paymentAck}
                  onChange={(event) => setPaymentAck(event.target.checked)}
                />{' '}
                {T(
                  lang,
                  'Tôi đã chuyển khoản đúng số tiền và nội dung ở trên',
                  'I have transferred the exact amount with the transfer note above',
                )}
              </label>
            </div>
          ) : (
            <div className="d68-bizreg-package-pending" role="status">
              <b>
                {isInvestor
                  ? T(lang, 'Vui lòng chọn kỳ hạn', 'Please select a term')
                  : T(
                      lang,
                      'Vui lòng chọn gói dịch vụ và kỳ hạn',
                      'Please select a service package and term',
                    )}
              </b>
              <span>
                {T(
                  lang,
                  'Số tiền và thông tin thanh toán sẽ hiển thị sau khi chọn gói.',
                  'The amount and payment information will appear after a package is selected.',
                )}
              </span>
            </div>
          )}

          <div className="d68-bizreg-payment-methods d68-bizreg-payment-methods--secondary">
            <button type="button" disabled>
              <span>💳</span>
              Sepay ({T(lang, 'Thẻ nội địa / tín dụng', 'Debit / credit card')}) ·{' '}
              {T(lang, 'Sắp ra mắt', 'Coming soon')}
            </button>
            <button type="button" disabled>
              <span>💳</span>
              Stripe / Paypal · {T(lang, 'Sắp ra mắt', 'Coming soon')}
            </button>
          </div>
        </>
      ) : (
        <div className="d68-bizreg-package-pending d68-bizreg-package-pending--free" role="status">
          <b>{T(lang, 'Miễn phí', 'Free')}</b>
          <span>
            {T(
              lang,
              'Nhà đầu tư Tiêu chuẩn không cần thanh toán khi đăng ký.',
              'Standard Investors do not need to make a payment during registration.',
            )}
          </span>
        </div>
      )}
    </section>
  );`;

replaceBetween(
  'src/pages/Register.tsx',
  '  const paymentSection = (',
  '\n\n  return (',
  paymentSection,
);

replaceOnce(
  'tests/e2e/03-register-investor.spec.ts',
  "  test('TC-INV-REG-002 Investor form contains general introduction and payment UI', async ({ page }) => {\n    await gotoAndWait(page, '/register/investor');\n    const text = await page.locator('body').innerText();\n    expect(text).toMatch(/Thông tin Nhà đầu tư|Investor information/i);\n    expect(text).toMatch(/Giới thiệu chung|General introduction/i);\n    expect(text).toMatch(/Mô tả khẩu vị đầu tư|Investment appetite/i);\n    expect(text).toMatch(/Kỳ hạn|Term/i);\n    expect(text).toMatch(/tháng|months/i);\n    expect(text).toMatch(/Tổng thanh toán|Total due/i);\n    expect(text).toMatch(/Chuyển khoản QR|QR bank transfer/i);\n  });",
  "  test('TC-INV-REG-002 Standard is default and Premium reveals payment UI', async ({ page }) => {\n    await gotoAndWait(page, '/register/investor');\n    const standard = page.getByRole('button', { name: /Nhà đầu tư Tiêu chuẩn|Standard Investor/i });\n    const premium = page.getByRole('button', { name: /Nhà đầu tư Nâng cao|Premium Investor/i });\n\n    await expect(standard).toHaveClass(/active/);\n    await expect(page.locator('body')).toContainText(/Miễn phí|Free/i);\n    await expect(page.locator('body')).not.toContainText(/Chuyển khoản QR|QR bank transfer/i);\n\n    await premium.click();\n    await expect(premium).toHaveClass(/active/);\n    await expect(page.locator('body')).toContainText(/Báo cáo Phân tích cơ hội đầu tư|Investment Opportunity Analysis Report/i);\n    await expect(page.locator('body')).toContainText(/Kỳ hạn|Term/i);\n    await expect(page.locator('body')).toContainText(/Tổng thanh toán|Total due/i);\n    await expect(page.locator('body')).toContainText(/Chuyển khoản QR|QR bank transfer/i);\n  });",
);

replaceOnce(
  'tests/e2e/03-register-investor.spec.ts',
  "    await page.getByLabel(/Tôi đã chuyển khoản|transferred/i).check();\n",
  "    await page.getByRole('button', { name: /Nhà đầu tư Tiêu chuẩn|Standard Investor/i }).click();\n",
);

fs.writeFileSync(`supabase/migrations/${migrationName}`, `-- Deals68 Investor registration plans — Phase 2.\n-- Standard Investor registration is free and must not leave a payment order.\n-- Premium registration keeps the existing pending-payment workflow.\n\ncreate or replace function public.create_signup_bundle_v2(\n  user_uuid uuid,\n  user_email text,\n  role_text text,\n  signup_nonce text,\n  profile_payload jsonb default '{}'::jsonb,\n  business_payload jsonb default null::jsonb,\n  investor_payload jsonb default null::jsonb,\n  payment_payload jsonb default '{}'::jsonb\n)\nreturns jsonb\nlanguage plpgsql\nsecurity definer\nset search_path = public, auth, pg_temp\nas $$\ndeclare\n  auth_email text;\n  auth_created_at timestamptz;\n  stored_nonce text;\n  result_value jsonb;\n  safe_role text := lower(trim(coalesce(role_text, '')));\n  requested_investor_plan text := lower(trim(coalesce(payment_payload->>'investorPlan', '')));\n  skip_payment boolean := lower(trim(coalesce(payment_payload->>'skipPayment', 'false'))) in ('true', '1', 'yes');\n  payment_uuid uuid;\nbegin\n  if length(trim(coalesce(signup_nonce, ''))) < 24 then\n    raise exception 'Invalid signup nonce' using errcode = '42501';\n  end if;\n\n  if skip_payment and not (\n    safe_role = 'investor'\n    and requested_investor_plan = 'standard'\n  ) then\n    raise exception 'Payment may only be skipped for Standard Investor registration'\n      using errcode = '42501';\n  end if;\n\n  select\n    lower(coalesce(u.email, '')),\n    u.created_at,\n    u.raw_user_meta_data->>'signup_nonce'\n  into auth_email, auth_created_at, stored_nonce\n  from auth.users u\n  where u.id = user_uuid\n  for update;\n\n  if not found\n     or auth_email <> lower(trim(coalesce(user_email, '')))\n     or stored_nonce is distinct from signup_nonce\n     or auth_created_at < now() - interval '30 minutes' then\n    raise exception 'Signup verification failed' using errcode = '42501';\n  end if;\n\n  result_value := public.create_signup_bundle(\n    user_uuid,\n    user_email,\n    safe_role,\n    coalesce(profile_payload, '{}'::jsonb),\n    business_payload,\n    investor_payload,\n    coalesce(payment_payload, '{}'::jsonb)\n  );\n\n  if skip_payment then\n    payment_uuid := nullif(result_value->>'payment_order_id', '')::uuid;\n    if payment_uuid is null then\n      raise exception 'Standard Investor payment cleanup failed';\n    end if;\n\n    delete from public.payment_orders\n    where id = payment_uuid\n      and profile_id = user_uuid\n      and investor_id = nullif(result_value->>'investor_id', '')::uuid\n      and lower(coalesce(status, '')) = 'pending';\n\n    if not found then\n      raise exception 'Standard Investor payment cleanup failed';\n    end if;\n\n    result_value := jsonb_set(\n      result_value,\n      '{payment_order_id}',\n      'null'::jsonb,\n      true\n    ) || jsonb_build_object(\n      'payment_skipped', true,\n      'investor_plan', 'standard'\n    );\n  end if;\n\n  update auth.users\n  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'signup_nonce'\n  where id = user_uuid;\n\n  return result_value;\nend;\n$$;\n\nrevoke all on function public.create_signup_bundle_v2(\n  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb\n) from public;\n\ngrant execute on function public.create_signup_bundle_v2(\n  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb\n) to anon, authenticated, service_role;\n\ncomment on function public.create_signup_bundle_v2(\n  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb\n) is\n  'Creates signup entities atomically. Standard Investor registration leaves no payment order; Premium and other paid registrations keep the existing payment workflow.';\n`);

fs.writeFileSync('scripts/deals68-investor-register-plans-phase2-check.mjs', `#!/usr/bin/env node\nimport fs from 'node:fs';\n\nconst failures = [];\nconst register = fs.readFileSync('src/pages/Register.tsx', 'utf8');\nconst e2e = fs.readFileSync('tests/e2e/03-register-investor.spec.ts', 'utf8');\nconst migration = fs.readFileSync('supabase/migrations/${migrationName}', 'utf8');\n\nfunction requireSnippet(label, source, snippet) {\n  if (!source.includes(snippet)) failures.push(label + ': missing ' + snippet);\n}\n\n[\n  \"useState<InvestorPlan>\",\n  \"intent.investorPlan === 'premium'\",\n  \"? 'premium'\\n      : 'standard'\",\n  \"Nhà đầu tư Tiêu chuẩn\",\n  \"Nhà đầu tư Nâng cao\",\n  \"Được sử dụng tính năng Báo cáo Phân tích cơ hội đầu tư\",\n  \"investorPremiumSelected\",\n  \"skipPayment: isInvestor && investorPlan === 'standard'\",\n  \"termMonths: investorPremiumSelected ? investorMonths : undefined\",\n  \"Nhà đầu tư Tiêu chuẩn không cần thanh toán khi đăng ký.\",\n].forEach((snippet) => requireSnippet('register', register, snippet));\n\nrequireSnippet('e2e', e2e, 'Standard is default and Premium reveals payment UI');\nrequireSnippet('e2e', e2e, \"not.toContainText(/Chuyển khoản QR|QR bank transfer/i)\");\nrequireSnippet('e2e', e2e, \"premium.click()\");\n\n[\n  \"payment_payload->>'skipPayment'\",\n  \"requested_investor_plan = 'standard'\",\n  \"Payment may only be skipped for Standard Investor registration\",\n  \"delete from public.payment_orders\",\n  \"'payment_skipped', true\",\n  \"to anon, authenticated, service_role\",\n].forEach((snippet) => requireSnippet('migration', migration, snippet));\n\nif (register.includes(\"if (!investorMonths) {\\n        missing.push(T(lang, 'Kỳ hạn', 'Term'));\")) {\n  failures.push('Standard Investor still requires a paid term');\n}\n\nif (failures.length) {\n  console.error('✗ Investor registration Phase 2 check failed:');\n  failures.forEach((failure) => console.error('  - ' + failure));\n  process.exit(1);\n}\n\nconsole.log('✓ Investor registration Phase 2 check: PASS');\n`);

replaceOnce(
  'package.json',
  '    "qa:investor-plans": "node scripts/deals68-investor-plan-entitlements-check.mjs"\n',
  '    "qa:investor-plans": "node scripts/deals68-investor-plan-entitlements-check.mjs",\n    "qa:investor-register-plans": "node scripts/deals68-investor-register-plans-phase2-check.mjs"\n',
);

replaceOnce(
  'scripts/deals68-package-checks.mjs',
  "  'scripts/deals68-investor-plan-entitlements-check.mjs',\n];",
  "  'scripts/deals68-investor-plan-entitlements-check.mjs',\n  'scripts/deals68-investor-register-plans-phase2-check.mjs',\n];",
);

replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  "  '20260723115526_investor_plan_entitlements_v1.sql',\n];",
  "  '20260723115526_investor_plan_entitlements_v1.sql',\n  '${migrationName}',\n];",
);

replaceOnce(
  'scripts/deals68-migration-state-check.mjs',
  "  {\n    name: '20260723115526_investor_plan_entitlements_v1.sql',\n    snippets: [\n      \"add column if not exists plan text not null default 'standard'\",\n      \"set plan = 'standard'\",\n      'create or replace function public.d68_guard_investor_plan_contract',\n      'create or replace function public.d68_get_investor_plan_snapshot',\n      'create or replace function public.d68_investor_has_entitlement',\n      'create or replace function public.admin_set_investor_plan',\n      'then 50000000 else 2500 end',\n    ],\n  },\n];",
  "  {\n    name: '20260723115526_investor_plan_entitlements_v1.sql',\n    snippets: [\n      \"add column if not exists plan text not null default 'standard'\",\n      \"set plan = 'standard'\",\n      'create or replace function public.d68_guard_investor_plan_contract',\n      'create or replace function public.d68_get_investor_plan_snapshot',\n      'create or replace function public.d68_investor_has_entitlement',\n      'create or replace function public.admin_set_investor_plan',\n      'then 50000000 else 2500 end',\n    ],\n  },\n  {\n    name: '${migrationName}',\n    snippets: [\n      'create or replace function public.create_signup_bundle_v2',\n      \"payment_payload->>'skipPayment'\",\n      \"requested_investor_plan = 'standard'\",\n      'delete from public.payment_orders',\n      \"'payment_skipped', true\",\n      'to anon, authenticated, service_role',\n    ],\n  },\n];",
);

replaceOnce(
  'docs/release/MIGRATION_STATE.md',
  '- `20260723115526_investor_plan_entitlements_v1.sql` — Investor Plan Phase 1; backfills every existing Investor to Standard, protects plan fields from client-side mutation, promotes confirmed paid membership to Premium, provides audited Admin assignment and server-side entitlement/price contracts. Premium pricing is 50,000,000 VND/month in Vietnam and 2,500 USD/month elsewhere.',
  '- `20260723115526_investor_plan_entitlements_v1.sql` — Investor Plan Phase 1; backfills every existing Investor to Standard, protects plan fields from client-side mutation, promotes confirmed paid membership to Premium, provides audited Admin assignment and server-side entitlement/price contracts. Premium pricing is 50,000,000 VND/month in Vietnam and 2,500 USD/month elsewhere.\n- `${migrationName}` — pending Investor Registration Phase 2 migration; allows free Standard Investor signup without retaining a payment order while preserving the existing Premium payment workflow and nonce verification.',
);

console.log('Investor registration Phase 2 source applied.');
