import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brand } from '../src/config/brand';
import {
  addonsTotal,
  estimate,
  formatPhone,
  formatPrice,
  leadPayload,
  leadSummary,
  packagePrice,
  phoneLooksValid,
  utmParams,
} from '../src/lib/pricing';

/** All subsets of add-on ids. */
function subsets<T>(arr: T[]): T[][] {
  return arr.reduce<T[][]>((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]);
}

test('every size × package × add-on combo sums correctly', () => {
  const ids = brand.ADDONS.map((a) => a.id);
  let combos = 0;
  brand.VEHICLE_SIZES.forEach((_, size) => {
    for (const pkg of brand.PACKAGES) {
      for (const set of subsets(ids)) {
        const expected = pkg.prices[size] + set.reduce((s, id) => s + brand.ADDONS.find((a) => a.id === id)!.price, 0);
        assert.equal(estimate(size, pkg.id, set), expected, `${size}/${pkg.id}/${set.join('+')}`);
        combos++;
      }
    }
  });
  assert.equal(combos, brand.VEHICLE_SIZES.length * brand.PACKAGES.length * 2 ** ids.length);
});

test('known example: Signature, SUV, pet hair = 289 + 40', () => {
  const data = {
    VEHICLE_SIZES: ['A', 'B', 'C'],
    PACKAGES: [{ id: 'signature', name: 'S', blurb: '', prices: [249, 289, 329], duration: '', includes: [] }],
    ADDONS: [{ id: 'pet_hair', name: 'Pet', price: 40 }],
  };
  assert.equal(estimate(1, 'signature', ['pet_hair'], data), 329);
});

test('unknown ids and duplicates are ignored, size is clamped', () => {
  const pkg = brand.PACKAGES[0];
  assert.equal(packagePrice('nope', 0), 0);
  assert.equal(estimate(0, 'nope', []), 0);
  assert.equal(addonsTotal(['nope']), 0);
  const a = brand.ADDONS[0];
  assert.equal(addonsTotal([a.id, a.id]), a.price);
  assert.equal(packagePrice(pkg.id, -5), pkg.prices[0]);
  assert.equal(packagePrice(pkg.id, 99), pkg.prices[brand.VEHICLE_SIZES.length - 1]);
  assert.equal(packagePrice(pkg.id, Number.NaN), pkg.prices[0]);
});

test('formatting helpers', () => {
  assert.equal(formatPrice(1234), '$1,234');
  assert.equal(formatPhone('3015550123'), '(301) 555-0123');
  assert.equal(formatPhone('+1 301 555 0123'), '(301) 555-0123');
  assert.equal(formatPhone('301'), '301');
  assert.equal(formatPhone('30155'), '(301) 55');
  assert.ok(phoneLooksValid('(301) 555-0123'));
  assert.ok(!phoneLooksValid('555-0123'));
});

const details = {
  name: ' Mike ',
  phone: '(301) 555-0123',
  zip: '20814',
  vehicle: '2022 Honda CR-V',
  date: '2026-11-02',
  window: 'Morning',
  notes: 'Dog hair',
};

test('lead payload shape', () => {
  const pkg = brand.PACKAGES[1];
  const addon = brand.ADDONS[0];
  const now = new Date('2026-10-28T12:00:00Z');
  const p = leadPayload(
    { size: 2, packageId: pkg.id, addons: [addon.id] },
    details,
    { pageUrl: 'https://x.com/', search: '?utm_source=ig&utm_campaign=fall&x=1', now },
  );
  assert.equal(p.source, 'website');
  assert.equal(p.brand, brand.BRAND_NAME);
  assert.equal(p.package, pkg.name);
  assert.equal(p.size, brand.VEHICLE_SIZES[2]);
  assert.deepEqual(p.addons, [addon.name]);
  assert.equal(p.estimate, pkg.prices[2] + addon.price);
  assert.equal(p.name, 'Mike');
  assert.equal(p.page_url, 'https://x.com/');
  assert.equal((p as Record<string, unknown>).utm_source, 'ig');
  assert.equal((p as Record<string, unknown>).utm_campaign, 'fall');
  assert.equal((p as Record<string, unknown>).x, undefined);
  assert.equal(p.submitted_at, now.toISOString());
  for (const k of ['zip', 'vehicle', 'date', 'window', 'notes']) assert.ok(k in p, k);
});

test('utm parsing', () => {
  assert.deepEqual(utmParams('?UTM_Medium=cpc&utm_term='), { utm_medium: 'cpc' });
});

test('summary text', () => {
  const pkg = brand.PACKAGES[0];
  const s = leadSummary({ size: 0, packageId: pkg.id, addons: [] }, details);
  assert.match(s, new RegExp(pkg.name));
  assert.match(s, /Estimate: \$\d+/);
  assert.match(s, /Name: Mike/);
  assert.doesNotMatch(s, /Add-ons/);
  const s2 = leadSummary({ size: 0, packageId: pkg.id, addons: [brand.ADDONS[1].id] }, { ...details, notes: '' });
  assert.match(s2, new RegExp(`Add-ons: ${brand.ADDONS[1].name}`));
  assert.doesNotMatch(s2, /Notes/);
});
