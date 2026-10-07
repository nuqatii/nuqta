// Every literal t('key') used in the code must exist in both English and Arabic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.document = { documentElement: {} };
const { keys } = await import('../assets/js/core/i18n.js');
const files = ['assets/js/pages', 'assets/js/ui'].flatMap((d) => readdirSync(d).map((f) => `${d}/${f}`));
const used = new Set();
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([a-z_0-9/-]+)'\s*[,)]/g)) used.add(m[1]);
test('all used keys exist in en and ar', () => {
  const { en, ar } = keys();
  assert.deepEqual([...used].filter((k) => !en.includes(k)), [], 'missing in en');
  assert.deepEqual([...used].filter((k) => !ar.includes(k)), [], 'missing in ar');
  assert.deepEqual(en.filter((k) => !ar.includes(k)), [], 'en keys without ar');
});
