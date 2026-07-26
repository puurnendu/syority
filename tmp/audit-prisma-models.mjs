import fs from 'fs';
import path from 'path';

const delegates = new Set(JSON.parse(fs.readFileSync('tmp/prisma-delegates.json', 'utf8')));
for (const x of [
  '$connect',
  '$disconnect',
  '$transaction',
  '$queryRaw',
  '$executeRaw',
  '$queryRawUnsafe',
  '$executeRawUnsafe',
  '$on',
  '$use',
  '$extends',
]) {
  delegates.add(x);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'tmp'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk('.');
const bad = new Map();
const re = /prisma\.([A-Za-z_][A-Za-z0-9_]*)\s*\./g;

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('prisma.')) continue;
  let m;
  while ((m = re.exec(src))) {
    const model = m[1];
    if (['constructor', 'then', 'catch', 'finally'].includes(model)) continue;
    if (!delegates.has(model)) {
      if (!bad.has(model)) bad.set(model, []);
      const line = src.slice(0, m.index).split(/\n/).length;
      bad.get(model).push({
        file: f.replace(/\\/g, '/'),
        line,
        snippet: src.split(/\n/)[line - 1].trim().slice(0, 140),
      });
    }
  }
}

const report = [...bad.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([model, locs]) => ({ model, count: locs.length, locations: locs }));

fs.writeFileSync('tmp/prisma-undefined-models.json', JSON.stringify(report, null, 2));
console.log('Undefined models:', report.length);
for (const r of report) {
  console.log(`- ${r.model} (${r.count}) e.g. ${r.locations[0].file}:${r.locations[0].line}`);
}
