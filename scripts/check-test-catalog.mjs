// Verifies the 1:1 mapping between docs/test-cases.md and tests/e2e/*.spec.js.
// Runs as `pretest`, so `npm test` fails whenever catalog and specs drift apart.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'docs', 'test-cases.md');
const SPEC_DIR = path.join(ROOT, 'tests', 'e2e');

const PREFIX_TO_SPEC = {
  POP: 'popup.spec.js',
  SET: 'settings.spec.js',
  ERR: 'errors.spec.js',
  HIS: 'history.spec.js',
  CS: 'content-script.spec.js'
};

const errors = [];
const warnings = [];

// --- Parse the catalog: one row per testId, last cell is the Loại column ---
const catalog = new Map();
for (const line of readFileSync(CATALOG_PATH, 'utf8').split('\n')) {
  const match = line.match(/^\|\s*(TC-[A-Z]+-\d{3})\s*\|/);
  if (!match) continue;

  const id = match[1];
  const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
  const type = cells[cells.length - 1];

  if (catalog.has(id)) {
    errors.push(`ID trùng trong catalog: ${id}`);
  }
  catalog.set(id, { type });
}

// --- Scan spec files for testIds ---
const specIds = new Map(); // id -> spec file
for (const file of readdirSync(SPEC_DIR).filter((f) => f.endsWith('.spec.js'))) {
  const source = readFileSync(path.join(SPEC_DIR, file), 'utf8');
  const regex = /test(?:\.(?:skip|fixme|fail|only))?\(\s*['"`](TC-[A-Z]+-\d{3})/g;
  for (const match of source.matchAll(regex)) {
    const id = match[1];
    if (specIds.has(id)) {
      errors.push(`ID xuất hiện nhiều lần trong spec: ${id} (${specIds.get(id)} và ${file})`);
    }
    specIds.set(id, file);
  }
}

// --- Cross-check both directions ---
for (const [id, { type }] of catalog) {
  if (type === 'Auto' && !specIds.has(id)) {
    errors.push(`${id} là Auto trong catalog nhưng không có test trong tests/e2e/`);
  }
  if ((type === 'Manual' || type === 'Retired') && specIds.has(id)) {
    errors.push(`${id} là ${type} trong catalog nhưng vẫn có test trong ${specIds.get(id)}`);
  }
}

for (const [id, file] of specIds) {
  if (!catalog.has(id)) {
    errors.push(`${id} có trong ${file} nhưng không có trong docs/test-cases.md`);
  }
  const prefix = id.match(/^TC-([A-Z]+)-/)[1];
  const expected = PREFIX_TO_SPEC[prefix];
  if (expected && file !== expected) {
    warnings.push(`${id} nên nằm trong ${expected}, đang ở ${file}`);
  }
}

for (const warning of warnings) {
  console.warn(`⚠️  ${warning}`);
}
if (errors.length > 0) {
  for (const error of errors) {
    console.error(`❌ ${error}`);
  }
  console.error(`\nCatalog và spec đang lệch nhau (${errors.length} lỗi). Xem quy tắc trong docs/test-cases.md.`);
  process.exit(1);
}
console.log(`✅ Catalog khớp spec: ${specIds.size} test Auto, ${catalog.size} test case tổng.`);
