// 아이콘 들이기 — 자체 SVG 폴더(import) 또는 오픈소스 세트(add)에서, 쓸 것만 아이콘 컴포넌트의 변형으로.
// 아이콘은 한 가지 색으로 다시 칠할 수 있게 mask 로 쓴다(색 = 둘러싼 글자색). 여러 색 그림 · 일러스트는 아이콘이 아니라 그림 부품(url)으로.
import { existsSync, readFileSync, writeFileSync, readdirSync, copyFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { DsError } from './load.mjs';

export const SETS = {
  lucide: { pkg: 'lucide-static', dir: 'icons', license: 'ISC', home: 'https://lucide.dev' },
  tabler: { pkg: '@tabler/icons', dir: 'icons/outline', license: 'MIT', home: 'https://tabler.io/icons' },
  phosphor: { pkg: '@phosphor-icons/core', dir: 'assets/regular', license: 'MIT', home: 'https://phosphoricons.com' },
  heroicons: { pkg: 'heroicons', dir: '24/outline', license: 'MIT', home: 'https://heroicons.com' },
  material: { pkg: '@material-symbols/svg-400', dir: 'outlined', license: 'Apache-2.0', home: 'https://fonts.google.com/icons' },
};

const safe = (n) => n.toLowerCase().replace(/\.svg$/, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

function setDir(root, set) {
  const s = SETS[set];
  if (!s) throw new DsError(`세트 ${set} 를 모릅니다 — ${Object.keys(SETS).join(' · ')}`);
  const d = path.join(root, 'node_modules', s.pkg, s.dir);
  if (!existsSync(d)) throw new DsError(`${s.pkg} 가 설치돼 있지 않습니다 — 먼저: npm install --save-dev ${s.pkg}  (라이선스 ${s.license} · ${s.home})`);
  return { ...s, path: d };
}

export function listIcons(root, set, word) {
  const s = setDir(root, set);
  const names = readdirSync(s.path).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4));
  return word ? names.filter((n) => n.includes(word)) : names;
}

/** icon 컴포넌트에 변형을 더한다 — spec 의 shape.values · sources, style.css 의 mask 줄, SVG 파일 */
function addToIconComponent(designDir, entries, source) {
  const dir = path.join(designDir, 'components/icon');
  const specFile = path.join(dir, 'spec.yaml');
  if (!existsSync(specFile)) throw new DsError('design/components/icon/spec.yaml 이 없습니다 — 기준을 먼저 깔아야 합니다');
  const doc = YAML.parseDocument(readFileSync(specFile, 'utf8'));
  const values = doc.getIn(['props', 'shape', 'values']);
  const have = new Set(values.items.map((i) => String(i.value ?? i)));
  const added = [];
  for (const { name, file } of entries) {
    const svg = readFileSync(file, 'utf8');
    if (/fill="(?!none|currentColor)[^"]+"[\s\S]*fill="(?!none|currentColor)[^"]+"/.test(svg) && new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1].toLowerCase())).size > 1) {
      console.log(`△ ${name}: 여러 색 SVG 입니다 — 아이콘(한 색)으로 넣으면 색이 사라집니다. 그림이면 그림 부품으로 넣으세요`);
    }
    copyFileSync(file, path.join(dir, `${name}.svg`));
    if (!have.has(name)) { values.add(name); have.add(name); appendFileSync(path.join(dir, 'style.css'), `.ds-icon.-${name} { mask-image: url("${name}.svg"); }\n`); added.push(name); }
  }
  const sources = doc.get('sources') ?? doc.createNode([]);
  const prev = sources.items?.find?.((i) => i.get?.('from') === source.from);
  if (prev) prev.set('icons', [...new Set([...(prev.get('icons')?.toJSON?.() ?? []), ...entries.map((e) => e.name)])]);
  else sources.add(doc.createNode({ ...source, icons: entries.map((e) => e.name) }));
  doc.set('sources', sources);
  writeFileSync(specFile, doc.toString());
  return added;
}

export function addIcons(root, designDir, set, names) {
  const s = setDir(root, set);
  const missing = names.filter((n) => !existsSync(path.join(s.path, `${n}.svg`)));
  if (missing.length) throw new DsError(`${set} 에 없는 이름: ${missing.join(' · ')} — npm run ds -- icons list ${set} <찾을 말>`);
  const version = JSON.parse(readFileSync(path.join(root, 'node_modules', s.pkg, 'package.json'), 'utf8')).version;
  return addToIconComponent(designDir, names.map((n) => ({ name: safe(n), file: path.join(s.path, `${n}.svg`) })), { from: `${s.pkg}@${version}`, license: s.license });
}

export function importIcons(designDir, folder) {
  if (!existsSync(folder)) throw new DsError(`${folder} 가 없습니다`);
  const files = readdirSync(folder).filter((f) => f.endsWith('.svg'));
  if (!files.length) throw new DsError(`${folder} 에 SVG 가 없습니다`);
  return addToIconComponent(designDir, files.map((f) => ({ name: safe(f), file: path.join(folder, f) })), { from: `own:${path.basename(folder)}`, license: '자체' });
}
