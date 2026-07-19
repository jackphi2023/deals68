import type { Lang } from './i18n';
import { T } from './labelsBase';

export type LocationOption = {
  key: string;
  countryIso2: string;
  vi: string;
  en: string;
  type?: 'province' | 'city' | 'state' | 'territory' | 'region' | 'other';
  aliases?: string[];
  sortOrder?: number;
};

function norm(raw: any) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const vietnamProvinceOptions: LocationOption[] = [
  ['ha-noi','Hà Nội','Hanoi','city'], ['hue','Huế','Hue','city'], ['hai-phong','Hải Phòng','Hai Phong','city'], ['da-nang','Đà Nẵng','Da Nang','city'], ['ho-chi-minh','TP. Hồ Chí Minh','Ho Chi Minh City','city'], ['can-tho','Cần Thơ','Can Tho','city'],
  ['lai-chau','Lai Châu','Lai Chau','province'], ['dien-bien','Điện Biên','Dien Bien','province'], ['son-la','Sơn La','Son La','province'], ['lao-cai','Lào Cai','Lao Cai','province'], ['tuyen-quang','Tuyên Quang','Tuyen Quang','province'], ['cao-bang','Cao Bằng','Cao Bang','province'], ['lang-son','Lạng Sơn','Lang Son','province'], ['thai-nguyen','Thái Nguyên','Thai Nguyen','province'], ['phu-tho','Phú Thọ','Phu Tho','province'], ['bac-ninh','Bắc Ninh','Bac Ninh','province'], ['quang-ninh','Quảng Ninh','Quang Ninh','province'], ['hung-yen','Hưng Yên','Hung Yen','province'], ['ninh-binh','Ninh Bình','Ninh Binh','province'], ['thanh-hoa','Thanh Hóa','Thanh Hoa','province'], ['nghe-an','Nghệ An','Nghe An','province'], ['ha-tinh','Hà Tĩnh','Ha Tinh','province'], ['quang-tri','Quảng Trị','Quang Tri','province'], ['quang-ngai','Quảng Ngãi','Quang Ngai','province'], ['gia-lai','Gia Lai','Gia Lai','province'], ['dak-lak','Đắk Lắk','Dak Lak','province'], ['khanh-hoa','Khánh Hòa','Khanh Hoa','province'], ['lam-dong','Lâm Đồng','Lam Dong','province'], ['dong-nai','Đồng Nai','Dong Nai','province'], ['tay-ninh','Tây Ninh','Tay Ninh','province'], ['dong-thap','Đồng Tháp','Dong Thap','province'], ['vinh-long','Vĩnh Long','Vinh Long','province'], ['an-giang','An Giang','An Giang','province'], ['ca-mau','Cà Mau','Ca Mau','province']
].map(([key, vi, en, type], idx) => ({ key: `VN-${key}`, countryIso2: 'VN', vi, en, type: type as any, sortOrder: idx + 1,
  aliases: key === 'ho-chi-minh' ? ['TP.HCM','TP HCM','HCMC','Saigon','Sài Gòn','Ho Chi Minh City'] : key === 'ha-noi' ? ['Hanoi','HN'] : key === 'hai-phong' ? ['Hai Phong'] : key === 'da-nang' ? ['Da Nang'] : []
}));

const usStates = 'Alabama,Alaska,Arizona,Arkansas,California,Colorado,Connecticut,Delaware,Florida,Georgia,Hawaii,Idaho,Illinois,Indiana,Iowa,Kansas,Louisiana,Maine,Maryland,Massachusetts,Michigan,Minnesota,Mississippi,Missouri,Montana,Nebraska,Nevada,New Hampshire,New Jersey,New Mexico,New York,North Carolina,North Dakota,Ohio,Oklahoma,Oregon,Pennsylvania,Rhode Island,South Carolina,South Dakota,Tennessee,Texas,Utah,Vermont,Virginia,Washington,West Virginia,Wisconsin,Wyoming'.split(',');
const caRegions = ['Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador','Nova Scotia','Ontario','Prince Edward Island','Quebec','Saskatchewan','Northwest Territories','Nunavut','Yukon'];
const auRegions = ['Australian Capital Territory','New South Wales','Northern Territory','Queensland','South Australia','Tasmania','Victoria','Western Australia'];

function makeRegions(countryIso2: string, names: string[], type: LocationOption['type']): LocationOption[] {
  return names.map((name, idx) => ({ key: `${countryIso2}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, countryIso2, vi: name, en: name, type, sortOrder: idx + 1 }));
}

export const locationOptions: LocationOption[] = [
  ...vietnamProvinceOptions,
  ...makeRegions('US', usStates, 'state'),
  ...makeRegions('CA', caRegions, 'province'),
  ...makeRegions('AU', auRegions, 'state'),
  { key: 'SG-singapore', countryIso2: 'SG', vi: 'Singapore', en: 'Singapore', type: 'city', sortOrder: 1 },
  { key: 'HK-hong-kong', countryIso2: 'HK', vi: 'Hồng Kông', en: 'Hong Kong', type: 'city', sortOrder: 1 },
  { key: 'AE-dubai', countryIso2: 'AE', vi: 'Dubai', en: 'Dubai', type: 'city', sortOrder: 1 },
  { key: 'OTHER-other', countryIso2: 'OTHER', vi: 'Khác / nhập tự do', en: 'Other / free text', type: 'other', sortOrder: 999 }
];

const locationByCanonicalKey = new Map(
  locationOptions.map((option) => [option.key.toLowerCase(), option]),
);

function canonicalLocationOption(raw: any, countryIso2 = '') {
  const value = String(raw || '').trim();
  if (!value) return undefined;

  const direct = locationByCanonicalKey.get(value.toLowerCase());
  if (!direct) return undefined;

  const iso = String(countryIso2 || '').trim().toUpperCase();
  return !iso || direct.countryIso2 === iso ? direct : undefined;
}

export function getLocationOptionsForCountry(countryIso2: string) {
  const iso = String(countryIso2 || 'VN').toUpperCase();
  const matches = locationOptions.filter((x) => x.countryIso2 === iso).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return matches.length ? matches : [];
}

export function locationOptionFromValue(raw: any, countryIso2 = '') {
  const direct = canonicalLocationOption(raw, countryIso2);
  if (direct) return direct;

  const n = norm(raw);
  const iso = String(countryIso2 || '').toUpperCase();
  if (!n) return undefined;
  return locationOptions.find((x) =>
    (!iso || x.countryIso2 === iso) &&
    (norm(x.vi) === n || norm(x.en) === n ||
      (x.aliases || []).some((alias) => norm(alias) === n)),
  );
}

export function locationKeyFromLabel(label: string, countryIso2 = 'VN') {
  return locationOptionFromValue(label, countryIso2)?.key || '';
}

export function locationDbLabel(raw: any, countryIso2 = 'VN') {
  const item = locationOptionFromValue(raw, countryIso2);
  return item?.vi || String(raw || '').trim();
}

export function labelLocation(raw: any, lang: Lang) {
  const r = String(raw || '').trim();
  const item = locationOptionFromValue(r);
  return item ? T(lang, item.vi, item.en) : (r || T(lang, 'Đang cập nhật', 'Updating'));
}
