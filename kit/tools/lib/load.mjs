// 원천 읽기 — 설정(ds.config.yaml) · 지도(map.yaml) · 묶음의 항목.
// 도구가 아는 묶음 종류는 넷뿐이다: tokens(값) · components(컴포넌트 — 계약과 HTML 참조 구현) · images(그림) · guidance(그 밖의 모든 지침 — 문법 · 판단 · 규칙).
// 어떤 묶음을 몇 개 두고 무엇이라 부를지는 조직이 지도에 정한다. 도구는 지도를 따라 읽기만 한다.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const KINDS = ['tokens', 'components', 'images', 'guidance'];

export class DsError extends Error {}

export function readYaml(file) {
  try {
    return YAML.parse(readFileSync(file, 'utf8')) ?? {};
  } catch (e) {
    const hint = /\[\[/.test(readFileSync(file, 'utf8')) && /flow|Missing , or :/.test(e.message)
      ? ' — [ ] · { } 안에 [[ID]] 가 있으면 그 글을 따옴표로 감쌉니다: ["비어 있음 — [[empty]]"]' : '';
    throw new DsError(`${file} 를 읽지 못했습니다 — ${e.message.split('\n')[0]}${hint}`);
  }
}

/** 'dir/*.yaml' · 'dir/*\/part.yaml' 같은 단순 패턴. '*' 는 한 단계 안의 이름 하나. */
export function glob(base, pattern) {
  const parts = pattern.split('/');
  let found = [base];
  for (const seg of parts) {
    const next = [];
    for (const dir of found) {
      if (!seg.includes('*')) {
        const p = path.join(dir, seg);
        if (existsSync(p)) next.push(p);
        continue;
      }
      if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
      const re = new RegExp('^' + seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      for (const name of readdirSync(dir).sort()) if (re.test(name) && !name.startsWith('.')) next.push(path.join(dir, name));
    }
    found = next;
  }
  return found;
}

export function loadProject(root = process.cwd()) {
  const configFile = path.join(root, 'ds.config.yaml');
  if (!existsSync(configFile)) throw new DsError('ds.config.yaml 이 없습니다. 스타터킷 폴더(또는 그것을 복사한 폴더)에서 실행하세요.');
  const config = readYaml(configFile);
  const designDir = path.join(root, config.design ?? 'design');
  const mapFile = path.join(designDir, 'map.yaml');
  if (!existsSync(mapFile)) throw new DsError(`design/map.yaml(지침 지도)이 없습니다 — 기준을 아직 깔지 않았으면 npm run ds -- baseline`);
  const map = readYaml(mapFile);
  const collections = (map.collections ?? []).map((c) => loadCollection(designDir, c));
  const vocabFile = path.join(designDir, map.vocabulary ?? 'vocabulary.yaml');
  const vocab = existsSync(vocabFile) ? readYaml(vocabFile).vocab ?? {} : null;
  return { root, config, designDir, map, collections, vocab, prefix: config.prefix ?? 'ds' };
}

function loadCollection(designDir, c) {
  const col = { ...c, items: [], problems: [] };
  if (!c.id) col.problems.push('묶음에 id 가 없습니다');
  if (!KINDS.includes(c.kind)) col.problems.push(`kind 는 ${KINDS.join(' · ')} 중 하나여야 합니다 (지금: ${c.kind})`);
  if (!c.source) { col.problems.push('source 가 없습니다'); return col; }
  const [pattern, key] = String(c.source).split('#');
  const files = glob(designDir, pattern);
  col.files = files;
  for (const file of files) {
    const rel = path.relative(designDir, file);
    if (c.kind === 'tokens') { col.items.push({ id: rel, file, data: readYaml(file) }); continue; }
    if (file.endsWith('.md')) { col.items.push(...readMarkdown(file).map((it) => ({ ...it, file }))); continue; }
    const data = readYaml(file);
    const list = key ? data[key] : data;
    if (key && !Array.isArray(list)) { col.problems.push(`${rel} 에 목록 ${key} 가 없습니다`); continue; }
    for (const item of Array.isArray(list) ? list : [list]) {
      if (!item || typeof item !== 'object') continue;
      // 부품은 폴더 하나가 부품 하나 — 따로 적지 않으면 폴더 이름이 ID 다
      const idFrom = c['id-from'] ?? (c.kind === 'components' ? 'dir' : 'file');
      const id = item.id ?? (idFrom === 'dir' ? path.basename(path.dirname(file)) : path.basename(file).replace(/\.[^.]+$/, ''));
      col.items.push({ ...item, id, file });
    }
  }
  return col;
}

/** Markdown — '## <ID> <제목>' 하나가 항목 하나. 아래 글은 body. */
function readMarkdown(file) {
  const items = [];
  let cur = null;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^##\s+(\S+)\s*(.*)$/);
    if (m) { cur = { id: m[1], title: m[2], body: '' }; items.push(cur); continue; }
    if (cur) cur.body += line + '\n';
  }
  for (const it of items) it.body = it.body.trim();
  return items;
}

export function byKind(project, kind) {
  return project.collections.filter((c) => c.kind === kind);
}

/** 지도의 load — 'always' · 'index' · 'on-demand' 또는 세션마다 { judge: …, draw: … } */
export function loadFor(col, session) {
  const l = col.load ?? 'on-demand';
  if (typeof l === 'string') return l;
  return l[session] ?? 'on-demand';
}
