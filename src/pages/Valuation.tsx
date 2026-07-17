import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import type { Lang } from '../lib/i18n';
import { toLocalizedPath } from '../lib/i18nRoutes';
import {
  T,
  countryOptions,
  industryOptions,
} from '../lib/labels';
import {
  formatNumberTyping,
  parseFormattedNumber,
} from '../lib/numberFormat';
import {
  DEFAULT_VALUATION_CONFIG,
  getActiveValuationConfig,
  valuate,
  formatValuationMoney,
  VALUATION_DISCLAIMER_EN,
  VALUATION_DISCLAIMER_VI,
  type Currency,
} from '../lib/valuationEngine';

function Row({
  a,
  b,
}: {
  a: string;
  b: string;
}) {
  return (
    <div className="d68-val-row">
      <span>{a}</span>
      <b>{b}</b>
    </div>
  );
}

export default function Valuation({
  lang,
}: {
  lang: Lang;
}) {
  const [config, setConfig] = useState(
    DEFAULT_VALUATION_CONFIG,
  );
  const [country, setCountry] = useState('');
  const [industryKey, setIndustryKey] = useState('');
  const [revenueYear, setRevenueYear] = useState('');
  const [currency, setCurrency] = useState<Currency>('VND');
  const [margin, setMargin] = useState('');
  const [growth, setGrowth] = useState('');

  useEffect(() => {
    getActiveValuationConfig()
      .then(setConfig)
      .catch(() => setConfig(DEFAULT_VALUATION_CONFIG));
  }, []);

  const parsedRevenue = parseFormattedNumber(revenueYear);
  const hasRequiredInputs =
    !!country &&
    !!industryKey &&
    parsedRevenue > 0;

  const result = useMemo(() => {
    if (!hasRequiredInputs) {
      return null;
    }

    return valuate(
      {
        revenueYear: parsedRevenue,
        ebitdaMargin: parseFormattedNumber(margin, true),
        growthPct: parseFormattedNumber(growth, true),
        industryKey,
        countryKey: country,
        currency,
      },
      config,
    );
  }, [
    config,
    country,
    currency,
    growth,
    hasRequiredInputs,
    industryKey,
    margin,
    parsedRevenue,
  ]);

  const industry =
    industryOptions.find((item) => item.key === industryKey) ||
    null;
  const countryLabel =
    countryOptions.find((item) => item.iso2 === country) ||
    null;
  const disclaimer = T(
    lang,
    VALUATION_DISCLAIMER_VI,
    VALUATION_DISCLAIMER_EN,
  );

  return (
    <main className="d68-valuation-page">
      <section className="d68-val-hero">
        <div>
          <span>
            {T(
              lang,
              'Miễn phí · Không cần đăng nhập',
              'Free · No login required',
            )}
          </span>
          <h1>
            {T(
              lang,
              'Định giá sơ bộ doanh nghiệp của bạn',
              'Estimate your business valuation',
            )}
          </h1>
          <p>
            {T(
              lang,
              'Nhận khoảng định giá tham khảo theo quốc gia, ngành, doanh thu năm gần nhất, biên lợi nhuận EBITDA và tăng trưởng doanh thu. Hệ số do Deals68 cấu hình và có thể cập nhật theo dữ liệu thị trường.',
              'Get an indicative benchmark by country, industry, latest annual revenue, EBITDA margin and revenue growth. Multiples are configured by Deals68 and can be updated with market data.',
            )}
          </p>
        </div>
      </section>

      <section className="d68-val-wrap">
        <div className="d68-val-cols">
          <article className="d68-val-card">
            <h2>
              {T(
                lang,
                'Thông tin doanh nghiệp',
                'Business details',
              )}
            </h2>
            <p className="d68-val-card-note">
              {T(
                lang,
                'Chỉ nhập số liệu tổng quan; không cần đưa tên doanh nghiệp, thương hiệu, nợ vay, số tiền chào hoặc tỷ lệ cổ phần.',
                'Enter high-level figures only; no company name, brand, debt, offer amount or stake is required.',
              )}
            </p>

            <div className="d68-val-form">
              <label>
                {T(lang, 'Quốc gia', 'Country')}
                <select
                  value={country}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setCountry(event.target.value)
                  }
                >
                  <option value="">
                    {T(
                      lang,
                      'Chọn quốc gia',
                      'Select country',
                    )}
                  </option>
                  {countryOptions.map((item) => (
                    <option
                      key={item.iso2}
                      value={item.iso2}
                    >
                      {T(lang, item.vi, item.en)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {T(
                  lang,
                  'Ngành hàng / lĩnh vực',
                  'Industry / sector',
                )}
                <select
                  value={industryKey}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setIndustryKey(event.target.value)
                  }
                >
                  <option value="">
                    {T(
                      lang,
                      'Chọn ngành',
                      'Select industry',
                    )}
                  </option>
                  {industryOptions.map((item) => (
                    <option
                      key={item.key}
                      value={item.key}
                    >
                      {T(lang, item.vi, item.en)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="d68-val-revenue-row">
                <label>
                  {T(
                    lang,
                    'Doanh thu năm gần nhất',
                    'Latest annual revenue',
                  )}
                  <input
                    inputMode="numeric"
                    value={revenueYear}
                    placeholder={T(
                      lang,
                      'Nhập doanh thu năm',
                      'Enter annual revenue',
                    )}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setRevenueYear(
                        formatNumberTyping(event.target.value),
                      )
                    }
                  />
                </label>

                <label>
                  {T(lang, 'Đơn vị', 'Currency')}
                  <select
                    value={currency}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setCurrency(event.target.value as Currency)
                    }
                  >
                    <option value="VND">
                      {T(lang, 'VNĐ', 'VND')}
                    </option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>

              <div className="d68-val-metrics-row">
                <label>
                  {T(
                    lang,
                    'Biên lợi nhuận EBITDA (%)',
                    'EBITDA margin (%)',
                  )}
                  <input
                    inputMode="decimal"
                    value={margin}
                    placeholder={T(
                      lang,
                      'Không bắt buộc',
                      'Optional',
                    )}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setMargin(
                        formatNumberTyping(
                          event.target.value,
                          true,
                        ),
                      )
                    }
                  />
                </label>

                <label>
                  {T(
                    lang,
                    'Tăng trưởng doanh thu (%)',
                    'Revenue growth (%)',
                  )}
                  <input
                    inputMode="decimal"
                    value={growth}
                    placeholder={T(
                      lang,
                      'Không bắt buộc',
                      'Optional',
                    )}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setGrowth(
                        formatNumberTyping(
                          event.target.value,
                          true,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            </div>
          </article>

          <aside className="d68-val-result d68-val-result--benchmark">
            <span>
              {T(
                lang,
                'Định giá tham chiếu',
                'Valuation benchmark',
              )}
            </span>

            {result && industry && countryLabel ? (
              <>
                <h2>
                  {formatValuationMoney(
                    result.low,
                    result.currency,
                    lang,
                  )}{' '}
                  –{' '}
                  {formatValuationMoney(
                    result.high,
                    result.currency,
                    lang,
                  )}
                </h2>
                <div>
                  <Row
                    a={T(lang, 'Thấp', 'Low')}
                    b={formatValuationMoney(
                      result.low,
                      result.currency,
                      lang,
                    )}
                  />
                  <Row
                    a={T(
                      lang,
                      'Trung bình',
                      'Midpoint',
                    )}
                    b={formatValuationMoney(
                      result.mid,
                      result.currency,
                      lang,
                    )}
                  />
                  <Row
                    a={T(lang, 'Cao', 'High')}
                    b={formatValuationMoney(
                      result.high,
                      result.currency,
                      lang,
                    )}
                  />
                  <Row
                    a={T(lang, 'Phương pháp', 'Method')}
                    b={
                      result.method === 'blend'
                        ? T(
                            lang,
                            'Hệ số Doanh thu + Lợi nhuận',
                            'Revenue + profit multiples',
                          )
                        : T(
                            lang,
                            'Hệ số Doanh thu',
                            'Revenue multiple',
                          )
                    }
                  />
                  <Row
                    a={T(lang, 'Ngành', 'Industry')}
                    b={T(lang, industry.vi, industry.en)}
                  />
                  <Row
                    a={T(lang, 'Quốc gia', 'Country')}
                    b={T(
                      lang,
                      countryLabel.vi,
                      countryLabel.en,
                    )}
                  />
                </div>
              </>
            ) : (
              <>
                <h2>—</h2>
                <div>
                  <Row a={T(lang, 'Thấp', 'Low')} b="—" />
                  <Row
                    a={T(lang, 'Trung bình', 'Midpoint')}
                    b="—"
                  />
                  <Row a={T(lang, 'Cao', 'High')} b="—" />
                  <Row
                    a={T(lang, 'Phương pháp', 'Method')}
                    b="—"
                  />
                  <Row
                    a={T(lang, 'Ngành', 'Industry')}
                    b="—"
                  />
                  <Row
                    a={T(lang, 'Quốc gia', 'Country')}
                    b="—"
                  />
                </div>
                <p>
                  {T(
                    lang,
                    'Chọn quốc gia, ngành và nhập doanh thu năm hợp lệ để tính khoảng định giá tham chiếu.',
                    'Select a country and industry, then enter valid annual revenue to calculate the valuation benchmark.',
                  )}
                </p>
              </>
            )}

            <Link
              to={toLocalizedPath(
                '/register/business',
                lang,
              )}
            >
              {T(
                lang,
                'Đăng hồ sơ doanh nghiệp',
                'List your business',
              )}{' '}
              →
            </Link>
          </aside>
        </div>
      </section>

      <section className="d68-val-method">
        <h2>
          {T(
            lang,
            'Cách Deals68 tính tham khảo',
            'How Deals68 estimates',
          )}
        </h2>
        <div>
          <article>
            <b>1</b>
            <h3>
              {T(
                lang,
                'Bội số ngành',
                'Industry multiples',
              )}
            </h3>
            <p>
              {T(
                lang,
                'Dùng bội số EV/EBITDA và EV/Doanh thu theo 23 nhóm ngành chuẩn hóa.',
                'Uses EV/EBITDA and EV/Revenue multiples across the standardized 23 industries.',
              )}
            </p>
          </article>
          <article>
            <b>2</b>
            <h3>
              {T(
                lang,
                'Điều chỉnh hệ số',
                'Factor adjustment',
              )}
            </h3>
            <p>
              {T(
                lang,
                'Điều chỉnh theo quốc gia, tăng trưởng và quy mô doanh thu quy đổi USD.',
                'Adjusted by country, growth and USD-converted revenue size.',
              )}
            </p>
          </article>
          <article>
            <b>3</b>
            <h3>
              {T(
                lang,
                'Không thay thế thẩm định',
                'Not a formal valuation',
              )}
            </h3>
            <p>
              {T(
                lang,
                'Kết quả là tham khảo, chưa sử dụng các nghiệp vụ định giá chuyên sâu cho từng doanh nghiệp.',
                'The result is indicative and does not yet apply in-depth valuation work tailored to each business.',
              )}
            </p>
          </article>
        </div>
        <aside className="d68-static-notice">
          <span>{disclaimer}</span>
        </aside>
      </section>
    </main>
  );
}
