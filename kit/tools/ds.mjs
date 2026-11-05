#!/usr/bin/env node
// ds — 디자인 시스템 스타터킷 도구. 지침 지도(design/map.yaml)를 따라 읽고 · 만들고 · 검사한다. 읽는 쪽은 주로 에이전트다.
//
//   ds status                        작업 상태 — 지금 할 수 있는 일 · 막힌 일과 푸는 법
//   ds progress <작업> <상태> [--note "…"]   상태 적기 (todo · doing · blocked · done · skipped)
//   ds baseline [--profile <ID>]     보편 기준을 design/ 에 깐다 (한 번). --diff 는 깐 뒤 무엇을 고쳤나
//   ds icons list <세트> [찾을 말] · add <세트> <이름…> · import <폴더>   아이콘 들이기 (세트: lucide · tabler · phosphor · heroicons · material)
//   ds figma outline <저장한 get_metadata 결과> [--depth 2] [--type frame,section]   피그마 구조의 첫 목록
//   ds build                         값 → CSS 변수, 컴포넌트 CSS · 동작 묶기, 키트 · 피그마 대응 → build/
//   ds check [화면.html …]           원천 검사. 화면을 주면 계약 검사(지어낸 클래스 · 엉뚱한 변형 · 짜임 · 속성)와 문법 검사
//   ds map                           빈칸 지도 — 칸마다 채워진 정도와, 지금 생성하면 에이전트가 짐작할 곳
//   ds context --session judge|draw [--ids A,B] [--out 파일]   생성 세션에 넘길 지침 묶음
//   ds preview 화면.html [--viewport ID] [--image ID] [--mode dark] [--name 이름]   기기 틀에 입혀 기준 화면과 나란히
//   ds serve [--port 6107]           build/ 를 http://localhost 로
//
//   모든 명령에 --root <폴더> — 다른 폴더를 대상으로.
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, cpSync, statSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { loadProject, byKind, loadFor, DsError, readYaml } from './lib/load.mjs';
import { buildTokens, tokensCss, tokensMarkdown, cssName } from './lib/tokens.mjs';
import { loadComponents, indexOf, checkComponent, checkContract, matrix, figmaSpec, reviewOf } from './lib/components.mjs';
import { idIndex, refsIn, checkImages, checkRules, bodyOf, imagePath } from './lib/guidance.mjs';
import { evaluate, setProgress } from './lib/progress.mjs';
import { SETS, listIcons, addIcons, importIcons } from './lib/icons.mjs';
import { outline } from './lib/figma.mjs';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT_VERSION = existsSync(path.join(KIT, 'VERSION')) ? readFileSync(path.join(KIT, 'VERSION'), 'utf8').trim() : '0.0.0';

// ── 인자 ──
const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = {};
const rest = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); flags[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true); }
  else rest.push(a);
}
const root = path.resolve(flags.root ?? process.cwd());

const COMMANDS = { status, progress, baseline, icons, figma, build, check, map: blankMap, context, preview, serve };
async function main() {
  if (COMMANDS[cmd]) return COMMANDS[cmd]();
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(0, 17).map((l) => l.slice(3)).join('\n'));
  return cmd && cmd !== 'help' ? 1 : 0;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const list = (v) => [].concat(v ?? []).filter((x) => x != null && x !== '');
const text = (v) => (Array.isArray(v) ? v.join(' · ') : v ?? '');

function readConfig() {
  const f = path.join(root, 'ds.config.yaml');
  if (!existsSync(f)) throw new DsError('ds.config.yaml 이 없습니다 — 스타터킷 폴더에서 실행하세요');
  return readYaml(f);
}
function profileOf(config) {
  const id = config.profile;
  if (!id || id === 'core') return null;
  const f = path.join(KIT, 'baseline/profiles', id, 'profile.yaml');
  return existsSync(f) ? { id, ...readYaml(f) } : null;
}
const viewportsOf = (config) => config.viewports ?? profileOf(config)?.viewports ?? [{ id: 'phone', width: 390, height: 844 }, { id: 'desktop', width: 1280, height: 800 }];

// ── 모으기 ──
function gather() {
  const project = loadProject(root);
  const tokens = buildTokens(byKind(project, 'tokens'));
  const comps = loadComponents(project);
  const idx = indexOf(comps);
  const { ids, dup } = idIndex(project, comps);
  const rules = byKind(project, 'guidance').flatMap((c) => c.items.filter((it) => it.check && typeof it.check === 'object'));
  return { project, tokens, comps, idx, ids, dup, rules };
}
const outDir = (p, ...sub) => { const d = path.join(root, p.config.build ?? 'build', ...sub); mkdirSync(d, { recursive: true }); return d; };
const MIME = { svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', woff2: 'font/woff2' };
const dataUri = (file) => `data:${MIME[path.extname(file).slice(1).toLowerCase()] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`;

/** 컴포넌트 CSS — 폴더의 그림 파일(url)은 안에 넣는다. 쓰지 않음(unused) 표시한 것은 뺀다 */
function compsCss(comps) {
  return comps.filter((c) => c.css && reviewOf(c).status !== 'unused').map((c) => {
    const css = c.css.trim().replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, src) => {
      if (/^(data:|https?:|#|%23)/.test(src)) return m;
      const f = path.resolve(c.dir, src);
      return existsSync(f) ? `url("${dataUri(f)}")` : m;
    });
    return `/* ${c.collection}/${c.id} */\n${css}\n`;
  }).join('\n');
}
const compsJs = (comps) => comps.filter((c) => c.js && reviewOf(c).status !== 'unused').map((c) => `/* ${c.id} */\n${c.js.trim()}\n`).join('\n');
const fullCss = (g) => tokensCss(g.tokens) + '\n' + compsCss(g.comps);

// ── status · progress ──
function status() {
  const config = readConfig();
  const designDir = path.join(root, config.design ?? 'design');
  const { tasks, pending, required } = evaluate({ root, kitDir: KIT, config, designDir });
  const mark = { done: '●', skipped: '–', doing: '◐', blocked: '✕', todo: '○' };
  console.log(`# 작업 상태 — ${config.title ?? config.name ?? ''} (스타터킷 ${KIT_VERSION})\n`);
  for (const t of tasks) {
    const tail = t.status === 'blocked' ? ` — 막힘: ${t.note ?? ''}${t.unblock ? ` → ${t.unblock}` : ''}` : t.waiting?.length && !['done', 'skipped'].includes(t.status) ? ` — 기다림: ${t.waiting.join(' · ')}` : t.note ? ` — ${t.note}` : '';
    console.log(`${mark[t.status] ?? '○'} ${t.id.padEnd(15)} ${t.title}${tail}`);
  }
  const ready = tasks.filter((t) => t.ready && !['done', 'skipped'].includes(t.status));
  console.log(`\n## 지금 할 수 있는 일\n${ready.length ? ready.map((t) => `- ${t.id} — ${t.title} (절차: ${t.skill})`).join('\n') : '- 없음'}`);
  if (pending.length) console.log(`\n## 피그마로 다시 볼 것 (figma-check: pending)\n${pending.map((p) => `- design/${p}`).join('\n')}`);
  if (required.length) console.log(`\n## 끝나야 「완료」 — ${required.map((t) => `${t.id}${t.unblock ? ` (${t.unblock})` : ''}`).join(' · ')}`);
  if (config.implementation?.approach == null || config.implementation?.approach === 'undecided') console.log('\n구현 방식: 미정 — 생성 · 미리보기는 HTML 참조 구현으로 진행한다');
  return 0;
}
function progress() {
  const [id, st] = rest;
  if (!id || !st) throw new DsError('ds progress <작업> <todo|doing|blocked|done|skipped> [--note "…"]');
  setProgress(root, KIT, id, st, flags.note === true ? '' : flags.note);
  console.log(`${id} → ${st}${flags.note && flags.note !== true ? ` (${flags.note})` : ''}`);
  return 0;
}

// ── baseline ──
function hashTree(dir, base = dir, out = {}) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    if (n.startsWith('.')) continue;
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) hashTree(p, base, out);
    else out[path.relative(base, p)] = createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
  }
  return out;
}
function baseline() {
  const config = readConfig();
  const designDir = path.join(root, config.design ?? 'design');
  const stamp = path.join(designDir, '.baseline.yaml');
  if (flags.diff) {
    if (!existsSync(stamp)) throw new DsError('아직 기준을 깔지 않았습니다');
    const s = readYaml(stamp);
    const now = hashTree(designDir);
    const changed = Object.keys(s.files).filter((f) => now[f] && now[f] !== s.files[f]);
    const removed = Object.keys(s.files).filter((f) => !now[f]);
    const added = Object.keys(now).filter((f) => !s.files[f]);
    console.log(`기준 ${s.kit} (${s.profile}) 을 ${s.date} 에 깔았습니다.\n고친 것 ${changed.length} · 지운 것 ${removed.length} · 더한 것 ${added.length}`);
    for (const [t, l] of [['고침', changed], ['지움', removed], ['더함', added]]) for (const f of l) console.log(`  ${t}  ${f}`);
    return 0;
  }
  if (existsSync(path.join(designDir, 'map.yaml'))) throw new DsError('design/ 에 이미 기준이 있습니다 — 무엇을 고쳤는지는 npm run ds -- baseline --diff');
  const profile = flags.profile ?? config.profile ?? 'core';
  const core = path.join(KIT, 'baseline/core');
  if (!existsSync(core)) throw new DsError('kit/baseline/core 가 없습니다');
  mkdirSync(designDir, { recursive: true });
  cpSync(core, designDir, { recursive: true });
  if (profile !== 'core') {
    // 프로필은 다른 프로필을 이어받을 수 있다(extends) — 바탕부터 차례로 덮는다
    const chain = [];
    for (let id = profile; id; ) {
      const p = path.join(KIT, 'baseline/profiles', id);
      if (!existsSync(p)) throw new DsError(`프로필 ${id} 가 없습니다 — ${readdirSync(path.join(KIT, 'baseline/profiles')).join(' · ')}`);
      chain.unshift(p);
      id = readYaml(path.join(p, 'profile.yaml')).extends;
    }
    for (const p of chain) if (existsSync(path.join(p, 'design'))) cpSync(path.join(p, 'design'), designDir, { recursive: true });
  }
  const files = hashTree(designDir);
  writeFileSync(stamp, `# 기준을 깐 기록 — 나중에 스타터킷의 새 기준과 견줄 때 쓴다. 손으로 고치지 않는다\n${YAML.stringify({ kit: KIT_VERSION, profile, date: new Date().toISOString().slice(0, 10), files })}`);
  console.log(`기준을 깔았습니다 — 스타터킷 ${KIT_VERSION} · ${profile} · 파일 ${Object.keys(files).length}개 → design/`);
  return 0;
}

// ── icons ──
function icons() {
  const [sub, ...args] = rest;
  const config = readConfig();
  const designDir = path.join(root, config.design ?? 'design');
  if (sub === 'list') {
    const names = listIcons(root, args[0], args[1]);
    console.log(`${args[0]} — ${names.length}개${args[1] ? ` (「${args[1]}」)` : ''}\n${names.slice(0, 200).join('  ')}${names.length > 200 ? ' …' : ''}`);
    return 0;
  }
  if (sub === 'add') {
    const added = addIcons(root, designDir, args[0], args.slice(1));
    console.log(`아이콘에 더했습니다(${args[0]}) — ${added.length ? added.map((n) => `-${n}`).join(' · ') : '새로 더한 것 없음'}`);
    return 0;
  }
  if (sub === 'import') {
    const added = importIcons(designDir, path.resolve(args[0] ?? ''));
    console.log(`자체 아이콘을 더했습니다 — ${added.length}개`);
    return 0;
  }
  console.log(`ds icons list <세트> [찾을 말] · add <세트> <이름…> · import <SVG 폴더>\n세트: ${Object.entries(SETS).map(([k, v]) => `${k}(${v.pkg}, ${v.license})`).join(' · ')}`);
  return 0;
}

// ── figma ──
function figma() {
  const [sub, file] = rest;
  if (sub !== 'outline' || !file) throw new DsError('ds figma outline <get_metadata 결과를 저장한 파일> [--depth 2] [--type frame,section,component]');
  const rows = outline(path.resolve(file), { depth: Number(flags.depth ?? 2), types: flags.type ? String(flags.type).split(',') : null });
  for (const r of rows) console.log(`${'  '.repeat(r.level)}${r.tag} ${r.id} 「${r.name}」${r.w ? ` ${Math.round(r.w)}×${Math.round(r.h)}` : ''}`);
  console.log(`\n${rows.length}개 — 깊이 ${flags.depth ?? 2}. 더 보려면 그 노드 ID 로 get_metadata 를 다시 부른다`);
  return 0;
}

// ── build ──
function build() {
  const g = gather();
  const problems = [...g.tokens.problems, ...g.project.collections.flatMap((c) => c.problems)];
  if (problems.length) { report(problems.map((msg) => ({ level: 'error', msg }))); return 1; }
  const dir = outDir(g.project);
  const css = fullCss(g);
  const js = compsJs(g.comps);
  writeFileSync(path.join(dir, 'ds.css'), css);
  writeFileSync(path.join(dir, 'ds.js'), js);
  writeFileSync(path.join(dir, 'kit.html'), kitHtml(g, css, js));
  writeFileSync(path.join(dir, 'classes.json'), JSON.stringify(Object.fromEntries([...g.idx.known].map((k) => [k, (g.idx.root.get(k) ?? g.idx.slot.get(k)?.comp ?? g.idx.mods.get(k)?.[0]?.comp)?.id])), null, 2));
  writeFileSync(path.join(dir, 'figma.json'), JSON.stringify({ kit: KIT_VERSION, components: g.comps.filter((c) => reviewOf(c).status !== 'unused').map(figmaSpec) }, null, 2));
  console.log(`만들었습니다 — build/ds.css · ds.js · kit.html · classes.json · figma.json (계약 값 ${g.tokens.contract.size} · 컴포넌트 ${g.comps.length} · 클래스 ${g.idx.known.size})`);
  return 0;
}

const CHROME = `
.dskit{font:14px/1.5 system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;color:#1b1b1f;background:#fff;margin:0;padding:32px;max-width:1280px}
:where(.dskit) :where(h1,h2,h3,table,td,th,pre,code):where(:not(.dskit-frame *, .stage *)){all:revert}
:where(.dskit) h1:where(:not(.dskit-frame *, .stage *)){font-size:24px;margin:0 0 4px}
:where(.dskit) h2:where(:not(.dskit-frame *, .stage *)){font-size:18px;margin:40px 0 8px;border-top:1px solid #ddd;padding-top:16px}
:where(.dskit) h3:where(:not(.dskit-frame *, .stage *)){font-size:15px;margin:24px 0 4px}
:where(.dskit) table:where(:not(.dskit-frame *, .stage *)){border-collapse:collapse;width:100%;font-size:12px}
:where(.dskit) :where(td,th):where(:not(.dskit-frame *, .stage *)){border-bottom:1px solid #eee;padding:4px 8px;text-align:left;vertical-align:top}
:where(.dskit) pre:where(:not(.dskit-frame *, .stage *)){background:#f5f5f7;padding:12px;overflow:auto;white-space:pre-wrap;font:12px/1.5 ui-monospace,monospace}
.dskit .meta{color:#666;margin:0 0 8px}.dskit .sw{display:inline-block;width:14px;height:14px;border:1px solid #ccc;vertical-align:middle}
.dskit .stage{border:1px dashed #ccc;padding:16px;margin:8px 0;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
.dskit .cell{display:flex;flex-direction:column;gap:4px}.dskit .cell>small{color:#888;font:11px ui-monospace,monospace}
.dskit-frames{display:flex;gap:24px;align-items:flex-start;flex-wrap:nowrap;overflow-x:auto;padding-bottom:8px}
.dskit-frame{border:1px solid #bbb;overflow:auto;background:#fff;flex:none}.dskit-frame>img{display:block;width:100%}
.dskit-cap{font:12px system-ui;color:#555;margin:0 0 4px}.dskit .badge{font:11px system-ui;border:1px solid #ccc;border-radius:4px;padding:0 4px;margin-left:6px;color:#666}`;

function kitHtml(g, css, js) {
  const { project, tokens, comps } = g;
  const c = project.config;
  const isColor = (v) => /^(#|rgb|hsl|oklch|linear-gradient)/.test(String(v));
  const tokenRows = [...tokens.contract].map(([k, v]) => `<tr><td><code>${cssName(k)}</code></td><td>${isColor(v.resolved) ? `<span class="sw" style="background:${esc(v.resolved)}"></span> ` : ''}<code>${esc(v.resolved)}</code></td><td>${esc(v.description ?? '')}${v.use ? `<br>언제: ${esc(v.use)}` : ''}</td><td>${esc(v.avoid ?? '')}</td></tr>`).join('');
  const vocab = Object.entries(project.vocab ?? {}).map(([k, v]) => `<h3>${esc(v.title ?? k)} <code>${esc(k)}</code></h3><p class="meta">${esc(v.how ?? '')}</p><table>${Object.entries(v.values ?? {}).map(([vk, vv]) => `<tr><td><code>${esc(vk)}</code></td><td>${esc(vv)}</td></tr>`).join('')}</table>`).join('');
  const compSec = comps.map((p) => {
    const rv = reviewOf(p);
    const cells = matrix(p).map((m) => `<div class="cell"><small>${esc(m.caption)}</small>${m.html}</div>`).join('');
    const props = p.props.map((x) => `<tr><td><code>${esc(x.name)}</code></td><td>${x.kind === 'enum' ? x.values.map((v) => `<code>${esc(x.classes[v])}</code>${String(x.default) === v ? '(기본)' : ''}`).join(' ') : `<code>${esc(x.class)}</code>`}</td><td>${esc(x.note ?? '')}</td></tr>`).join('');
    const states = p.states.map((s) => `<tr><td>${esc(s.name)}</td><td><code>${s.interaction ? '(손이 만듦)' : esc(`${s.attr}${s.value != null ? `="${s.value}"` : ''}`)}</code></td><td>${esc(s.note ?? '')}</td></tr>`).join('');
    const slots = p.slots.map((s) => `<tr><td>${esc(s.name)}</td><td><code>${esc(s.class)}</code></td><td>${esc(s.note ?? '')}${s.optional ? ' (선택)' : ''}</td></tr>`).join('');
    return `<h3 id="${esc(p.id)}">${esc(p.title ?? p.id)} <code>${esc(p.class)}</code><span class="badge">${esc(rv.status)}</span></h3>
<p class="meta">${esc(p.summary ?? '')}${p.use ? '<br>언제: ' + esc(text(p.use)) : ''}${p.avoid ? '<br>쓰지 않을 때: ' + esc(text(p.avoid)) : ''}</p>
${props ? `<table><tr><th>props</th><th>클래스</th><th></th></tr>${props}</table>` : ''}${states ? `<table><tr><th>상태</th><th>속성</th><th></th></tr>${states}</table>` : ''}${slots ? `<table><tr><th>짜임</th><th>클래스</th><th></th></tr>${slots}</table>` : ''}
${cells ? `<div class="stage">${cells}</div>` : ''}${p.examples ? `<div class="stage">${p.examples}</div><pre>${esc(p.examples.trim())}</pre>` : ''}`;
  }).join('\n');
  const guide = byKind(project, 'guidance').map((col) => `<h3>${esc(col.title ?? col.id)}</h3><p class="meta">${esc(col.what ?? '')}</p><ul>${col.items.map((it) => `<li><b>${esc(it.id)}</b> ${esc(it.title ?? '')}${it.rule ? ' — ' + esc(it.rule) : it.summary ? ' — ' + esc(it.summary) : ''}</li>`).join('')}</ul>`).join('');
  return `<!doctype html><html lang="${esc(c.language ?? 'ko')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.title ?? c.name ?? '디자인 시스템')} — 키트</title><style>${css}\n${CHROME}</style></head><body><div class="dskit">
<h1>${esc(c.title ?? c.name ?? '디자인 시스템')}</h1><p class="meta">${esc(c.description ?? '')} · 대상 ${esc(c.profile ?? '미정')} · 구현 ${esc(c.implementation?.approach ?? '미정')} · 접두사 <code>${esc(project.prefix)}-</code> · 스타터킷 ${KIT_VERSION}</p>
<p class="meta">이 페이지는 디자인 시안을 보는 곳이다. 개발에서 쓸 컴포넌트는 구현 방식(ds.config.yaml 의 implementation)과 대응표를 따른다.</p>
<h2>값 (계약)</h2><table><tr><th>이름</th><th>값</th><th>뜻 · 언제</th><th>쓰지 않을 때</th></tr>${tokenRows}</table>
${vocab ? `<h2>어휘</h2>${vocab}` : ''}
<h2>컴포넌트</h2>${compSec || '<p class="meta">아직 없음</p>'}
<h2>지침</h2>${guide || '<p class="meta">아직 없음</p>'}
</div><script>${js}</script></body></html>`;
}

// ── check ──
function check() {
  const g = gather();
  const out = [];
  for (const c of g.project.collections) for (const m of c.problems) out.push({ level: 'error', msg: `지도 · ${c.id ?? '?'}: ${m}` });
  for (const m of g.tokens.problems) out.push({ level: 'error', msg: `값: ${m}` });
  // 줄 높이(…line)는 짝인 글자 크기(…size)의 뜻을 따른다
  const meaning = (k, v) => v.description || v.use || (k.endsWith('.line') && g.tokens.contract.get(k.replace(/\.line$/, '.size'))?.description);
  for (const [k, v] of g.tokens.contract) if (!meaning(k, v)) out.push({ level: 'warn', msg: `값 ${k}: 뜻($description) · 언제($use)가 없습니다 — 에이전트가 이름만 보고 고릅니다` });
  for (const m of g.dup) out.push({ level: 'error', msg: `ID 중복: ${m}` });
  const owner = new Map();
  for (const c of g.comps) {
    out.push(...checkComponent(c, { contract: g.tokens.contract, idx: g.idx, prefix: g.project.prefix, vocab: g.project.vocab }));
    for (const k of [c.class, ...c.slots.map((s) => s.class)].filter(Boolean)) { if (owner.has(k)) out.push({ level: 'error', msg: `클래스 ${k} 를 ${owner.get(k)} 와 ${c.id} 가 함께 정의합니다` }); owner.set(k, c.id); }
  }
  for (const col of byKind(g.project, 'images')) out.push(...checkImages(col));
  for (const col of g.project.collections.filter((c) => c.kind !== 'tokens')) {
    const items = col.kind === 'components' ? g.comps.filter((c) => c.collection === col.id) : col.items;
    for (const it of items) for (const r of refsIn(strip(it))) if (!g.ids.has(r)) out.push({ level: 'error', msg: `${col.id}/${it.id}: [[${r}]] 가 가리키는 항목이 없습니다` });
    for (const f of list(col.require)) for (const it of items) if (it[f] == null || it[f] === '') out.push({ level: 'warn', msg: `${col.id}/${it.id}: ${f} 가 비었습니다 (지도의 require)` });
    if (col.kind === 'guidance') for (const it of items) if (it.template) {
      const f = path.join(g.project.designDir, it.template);
      if (!existsSync(f)) out.push({ level: 'error', msg: `${col.id}/${it.id}: 골격 ${it.template} 가 없습니다` });
      else for (const r of checkContract(readFileSync(f, 'utf8'), g.idx)) out.push({ level: 'error', msg: `${col.id}/${it.id} 골격 ${it.template}: ${r.msg}` });
    }
    if (col.fields) for (const it of items) for (const k of Object.keys(strip(it))) if (!['id', 'review', 'figma-check', ...list(col.fields)].includes(k)) out.push({ level: 'warn', msg: `${col.id}/${it.id}: 지도에 없는 칸 ${k} — 오타인지 보고, 새 칸이면 지도의 fields 와 how 에 적습니다` });
  }
  const impl = g.project.config.implementation ?? {};
  if (impl.approach && !['undecided', 'html'].includes(impl.approach)) {
    const f = path.join(root, impl.mapping ?? 'design/implementation.yaml');
    const mapping = existsSync(f) ? readYaml(f).mapping ?? {} : {};
    const missingImpl = g.comps.filter((c) => reviewOf(c).status !== 'unused' && !mapping[c.id]).map((c) => c.id);
    if (missingImpl.length) out.push({ level: 'warn', msg: `구현 방식 ${impl.approach}${impl.target ? ` (${impl.target})` : ''} — 대응표에 없는 컴포넌트 ${missingImpl.length}개: ${missingImpl.slice(0, 10).join(' · ')}${missingImpl.length > 10 ? ' …' : ''}` });
  }
  if (!existsSync(path.join(g.project.designDir, g.project.map.reading ?? 'reading.md'))) out.push({ level: 'warn', msg: '읽는 법(reading.md)이 없습니다' });
  for (const file of rest) {
    const html = readFileSync(path.resolve(file), 'utf8');
    const rel = path.relative(root, path.resolve(file));
    for (const r of [...checkContract(html, g.idx), ...checkRules(html, g.rules)]) out.push({ ...r, msg: `${rel}: ${r.msg}` });
  }
  return report(out, '원천' + (rest.length ? ` + 화면 ${rest.length}장` : ''));
}
// 원천 항목에서 도구가 붙인 칸(파일 위치 · 읽어 들인 CSS · 계산한 클래스)을 뺀다 — 참조 · 칸 검사는 원천의 칸만 본다
const strip = (it) => {
  const { file, dir, css, js, examples, collection, mods, classes, ...o } = it;
  if (Array.isArray(o.props)) { const { props, slots, states, ...r } = o; return r; }
  return o;
};

function report(out, what = '') {
  const errors = out.filter((o) => o.level === 'error');
  const warns = out.filter((o) => o.level === 'warn');
  for (const o of errors) console.log(`✗ ${o.msg}`);
  if (!flags.quiet) for (const o of warns) console.log(`△ ${o.msg}`);
  console.log(errors.length ? `\n${what} 검사 실패 — 오류 ${errors.length} · 알림 ${warns.length}` : `\n${what} 검사 통과${warns.length ? ` — 알림 ${warns.length}` : ''}`);
  return errors.length ? 1 : 0;
}

// ── map (빈칸 지도) ──
function blankMap() {
  const g = gather();
  const { project, tokens, comps } = g;
  const guidance = byKind(project, 'guidance');
  const images = byKind(project, 'images').flatMap((c) => c.items);
  const live = comps.filter((c) => reviewOf(c).status !== 'unused');
  const slotOf = (s) => guidance.filter((c) => c.slot === s);
  const L = [];
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const row = (ok, name, state, guess) => L.push(`| ${ok === true ? '●' : ok === 'half' ? '◐' : '○'} | ${name} | ${state} | ${ok === true ? '—' : guess} |`);
  const lvl = (a, b) => (!b ? false : a === b ? true : a ? 'half' : false);
  L.push(`# 빈칸 지도 — ${project.config.title ?? project.config.name ?? ''}`, '', '칸은 에이전트가 화면을 만들 때 어떤 디자인 시스템에서든 찾는 것이다. 비어 있는 칸은 에이전트가 학습 데이터의 관례로 메운다.', '');
  L.push('| | 칸 | 지금 | 비어 있으면 에이전트는 |', '|---|---|---|---|');
  const hasReading = existsSync(path.join(project.designDir, project.map.reading ?? 'reading.md'));
  row(hasReading, '읽는 법', hasReading ? 'reading.md 있음' : '없음', '무엇부터 고르고 무엇을 지킬지 순서를 스스로 정한다');
  const meant = [...tokens.contract].filter(([k, v]) => v.description || v.use || (k.endsWith('.line') && tokens.contract.get(k.replace(/\.line$/, '.size'))?.description)).length;
  row(lvl(meant, tokens.contract.size), '값', `계약 ${tokens.contract.size} · 뜻 적힌 것 ${pct(meant, tokens.contract.size)}%${tokens.modes.size ? ' · 모드 ' + [...tokens.modes.keys()].join('/') : ''}`, '값을 이름만 보고 고르거나 지어낸다');
  const vocabN = Object.keys(project.vocab ?? {}).length;
  row(vocabN ? true : false, '어휘', vocabN ? `${vocabN}갈래 (${Object.keys(project.vocab).join(' · ')})` : '없음', '컴포넌트마다 변형 이름이 달라 섞어 쓴다');
  const contractOk = (c) => c.summary && c.use && (c.template || c.examples) && (c.states.length || c['no-states']);
  row(lvl(live.filter(contractOk).length, live.length), '컴포넌트', `${live.length}개 · 계약 갖춘 것(무엇 · 언제 · 상태 · 예시) ${live.filter(contractOk).length} · 승인 ${live.filter((c) => reviewOf(c).status === 'approved').length}`, '익숙한 라이브러리의 모양 · 이름을 쓰고 상태를 짐작한다');
  const gram = slotOf('grammar');
  row(gram.some((c) => c.items.length) ? true : false, '문법', gram.length ? gram.map((c) => `${c.title ?? c.id} ${c.items.length}`).join(' · ') : '없음 (지도의 slot: grammar)', '위계 · 간격 · 정렬 · 문구를 요청마다 다르게 잡는다');
  row(lvl(images.filter((i) => i.learn).length, images.length), '그림', `${images.length}장 (배울 것 적힌 것 ${images.filter((i) => i.learn).length})`, '분위기 · 밀도 · 배치를 평균적인 앱처럼 잡는다');
  const judge = slotOf('judge');
  // 비어도 되는 묶음(optional — 업무처럼 제품을 들일 때 채우는 것)은 반쯤으로만 센다
  row(judge.length ? (judge.every((c) => c.items.length || c.optional) ? (judge.some((c) => c.optional && !c.items.length) ? 'half' : true) : 'half') : false, '판단', judge.length ? judge.map((c) => `${c.title ?? c.id} ${c.items.length}`).join(' · ') : '없음 (지도의 slot: judge)', '화면 구성(무엇을 어디에)을 요청마다 다르게 고른다');
  row(g.rules.length ? true : false, '검사', `계약 검사 + 기계 검사가 붙은 항목 ${g.rules.length}`, '지침을 어겨도 아무도 모른다');
  L.push('', '## 묶음', '', '| 묶음 | 종류 · 칸 | 항목 | 초안 | 읽힘(판단/그리기) |', '|---|---|---|---|---|');
  for (const c of project.collections) {
    const items = c.kind === 'components' ? comps.filter((p) => p.collection === c.id) : c.kind === 'tokens' ? [] : c.items;
    const n = c.kind === 'tokens' ? `${c.items.length}파일` : items.length;
    const draft = items.filter((it) => reviewOf(it).status === 'draft').length;
    L.push(`| ${c.title ?? c.id} | ${c.kind}${c.slot ? ' · ' + c.slot : ''} | ${n} | ${draft || '—'} | ${loadFor(c, 'judge')} / ${loadFor(c, 'draw')} |`);
  }
  const notes = [];
  for (const c of live) if (!contractOk(c)) notes.push(`컴포넌트 ${c.id}: ${[!c.summary && 'summary', !c.use && 'use', !(c.template || c.examples) && 'template · examples', !(c.states.length || c['no-states']) && 'states(없으면 no-states: true)'].filter(Boolean).join(' · ')} 없음`);
  for (const i of images) if (!i.learn) notes.push(`그림 ${i.id}: learn 없음`);
  const missMeaning = [...tokens.contract].filter(([k, v]) => !v.description && !v.use && !(k.endsWith('.line') && tokens.contract.get(k.replace(/\.line$/, '.size'))?.description)).map(([k]) => k);
  if (missMeaning.length) notes.push(`뜻 없는 값 ${missMeaning.length}개 — ${missMeaning.slice(0, 8).join(' · ')}${missMeaning.length > 8 ? ' …' : ''}`);
  if (notes.length) L.push('', '## 채울 곳', '', ...notes.map((n) => `- ${n}`));
  const out = L.join('\n') + '\n';
  writeFileSync(path.join(outDir(project), 'map.md'), out);
  console.log(out);
  return 0;
}

// ── context ──
function itemBlock(it, designDir) {
  const { file, id, title, body, ...fields } = it;
  const y = Object.keys(fields).length ? '```yaml\n' + YAML.stringify(fields).trim() + '\n```\n' : '';
  // 화면 유형처럼 template(HTML 골격)이 있으면 그 HTML 을 함께 싣는다 — 생성은 이 골격에서 출발한다
  const tpl = it.template && designDir && existsSync(path.join(designDir, it.template)) ? `골격(${it.template}) — 여기서 출발한다:\n\`\`\`html\n${readFileSync(path.join(designDir, it.template), 'utf8').trim()}\n\`\`\`\n` : '';
  return `### ${id}${title ? ' ' + title : ''}\n${body ? body + '\n' : ''}${y}${tpl}`;
}
function compBlock(c) {
  const L = [`### ${c.id}${c.title ? ' ' + c.title : ''} — \`${c.class}\``, c.summary ?? ''];
  if (c.use) L.push(`- 언제: ${text(c.use)}`);
  if (c.avoid) L.push(`- 쓰지 않을 때: ${text(c.avoid)}`);
  for (const p of c.props) L.push(p.kind === 'enum' ? `- ${p.name}: ${p.values.map((v) => `\`${p.classes[v]}\`${String(p.default) === v ? '(기본 — 안 적어도 됨)' : ''}`).join(' · ')} 중 하나${p.note ? ` — ${p.note}` : ''}` : `- ${p.name}: \`${p.class}\`${p['requires-attr'] ? ` (${list(p['requires-attr']).join(' · ')} 속성 함께)` : ''}${p.note ? ` — ${p.note}` : ''}`);
  const st = c.states.filter((s) => !s.interaction);
  if (st.length) L.push(`- 상태(속성으로): ${st.map((s) => `${s.name} \`${s.attr}${s.value != null ? `="${s.value}"` : ''}\`${s.note ? ` — ${s.note}` : ''}`).join(' · ')}`);
  for (const s of c.slots) L.push(`- 짜임 ${s.name}: \`${s.class}\`${s.optional ? ' (선택)' : ''}${s.note ? ` — ${s.note}` : ''}${list(s.modifiers).length ? ` · 변형 ${list(s.modifiers).map((m) => `\`${m.class ?? m}\``).join(' ')}` : ''}`);
  if (c['requires-attr']) L.push(`- 늘 함께: ${list(c['requires-attr']).join(' · ')} 속성`);
  if (c.a11y) L.push(`- 접근성: ${text(c.a11y)}`);
  const ex = c.examples ?? (c.template ? matrix(c).slice(0, 3).map((m) => m.html).join('\n') : '');
  if (ex) L.push('```html', ex.trim(), '```');
  return L.join('\n') + '\n';
}
function lineOf(col, it) {
  if (col.line) return col.line.replace(/\{([\w-]+)\}/g, (_, f) => text(it[f]));
  return `${it.id}${it.title ? ' ' + it.title : ''}${it.rule ? ' — ' + it.rule : it.summary ? ' — ' + it.summary : ''}`;
}
function context() {
  const session = flags.session;
  if (!['judge', 'draw'].includes(session)) throw new DsError('--session judge(무엇을 고를지 판단) 또는 draw(화면을 그림) 를 주세요');
  const g = gather();
  const { project, tokens, comps } = g;
  const want = String(flags.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const missing = want.filter((id) => !g.ids.has(id));
  if (missing.length) throw new DsError(`없는 ID: ${missing.join(', ')}`);
  const c = project.config;
  const S = [];
  const included = [];
  S.push(`# ${c.title ?? c.name} — ${session === 'judge' ? '판단' : '그리기'} 세션 지침`, '');
  S.push(`대상: ${c.platform ?? c.profile ?? ''} · 화면 ${viewportsOf(c).map((v) => `${v.id} ${v.width}×${v.height}`).join(' / ')}`, '');
  const reading = path.join(project.designDir, project.map.reading ?? 'reading.md');
  if (existsSync(reading)) S.push(readFileSync(reading, 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim(), '');
  if (session === 'draw') {
    S.push('## 마크업 규약 (도구가 검사한다)', '',
      `- 아래 컴포넌트의 클래스만 쓴다. 뿌리 클래스(\`${project.prefix}-…\`)에 변형(\`-…\`)을 함께 단다. 변형은 그 컴포넌트에 있는 것만, 한 prop 에 하나만.`,
      '- 짜임 클래스(`…__…`)는 그 컴포넌트 안에서만 쓴다.',
      '- 상태는 클래스가 아니라 속성으로 — `disabled` · `aria-invalid="true"` · `aria-selected="true"` · `aria-busy="true"` … (컴포넌트마다 적힌 대로).',
      '- `style=""` · `<style>` 로 값을 주지 않는다. 색 · 간격은 클래스가 이미 갖고 있다. 간격 · 줄 맞춤은 배치 컴포넌트로.',
      '- 컴포넌트에 없는 것이 필요하면 있는 클래스로 모양만 그리고 그 요소에 `data-local="<이름>"` 을 단다. 클래스를 지어내지 않는다.',
      '- 다 그린 뒤 `npm run ds -- check <파일>` 로 검사한다.', '');
  }
  // related 의 근거 — 고른 항목과 그 골격 HTML, 그리고 이 세션에 늘 읽히는 지침(상태 · 구성 문법 · 규칙 …)이 가리키는 것.
  // 상태 문법이 [[empty]] 를 가리키면 빈 상태 컴포넌트도 실린다 — 화면의 상태를 그릴 재료가 빠지지 않게
  const guideCols = project.collections.filter((col) => col.kind === 'guidance');
  const pickedItems = guideCols.flatMap((col) => col.items.filter((it) => want.includes(String(it.id))));
  const alwaysItems = guideCols.filter((col) => loadFor(col, session) === 'always').flatMap((col) => col.items);
  const tplText = pickedItems.filter((it) => it.template && existsSync(path.join(project.designDir, it.template))).map((it) => readFileSync(path.join(project.designDir, it.template), 'utf8'));
  const pickedText = [...pickedItems, ...alwaysItems].map((it) => JSON.stringify(it)).concat(tplText).join('\n');
  const vocabAlways = project.vocab && session === 'draw';
  if (vocabAlways) {
    S.push('## 어휘 — 컴포넌트가 함께 쓰는 변형 이름', '');
    for (const [k, v] of Object.entries(project.vocab)) S.push(`- **${v.title ?? k}** (\`${k}\`): ${Object.entries(v.values ?? {}).map(([vk, vv]) => `\`${vk}\` ${vv}`).join(' · ')}${v.how ? ` — ${v.how}` : ''}`);
    S.push('');
  }
  for (const col of project.collections) {
    const mode = loadFor(col, session);
    const items = col.kind === 'components' ? comps.filter((p) => p.collection === col.id && reviewOf(p).status !== 'unused') : col.kind === 'tokens' ? [] : col.items;
    const picked = items.filter((it) => want.includes(String(it.id)));
    if (mode === 'on-demand' && !picked.length) continue;
    S.push(`## ${col.title ?? col.id}`, '');
    if (col.what) S.push(String(col.what).trim(), '');
    if (col.how && mode !== 'on-demand') S.push(`읽는 법: ${String(col.how).trim()}`, '');
    if (col.kind === 'tokens') { S.push(tokensMarkdown(tokens)); included.push(`${col.id}:*`); continue; }
    if (col.kind === 'images') {
      for (const it of items) S.push(`- **${it.id}** ${it.title ?? ''} — 보이는 것: ${it.see ?? '?'} · 배울 것: ${it.learn ?? '?'} · 파일: ${path.relative(root, imagePath(it))}`);
      S.push('', '그림 파일은 필요할 때 열어 본다. 「배울 것」 만 따르고, 그림의 글 · 데이터를 베끼지 않는다.', '');
      included.push(...items.map((it) => it.id));
      continue;
    }
    const isRelated = (it) => pickedText.includes(`[[${it.id}]]`) || (col.kind === 'components' && it.class && new RegExp(`(^|[^\\w-])${it.class}([^\\w-]|$)`).test(pickedText));
    const full = mode === 'always' ? items : mode === 'related' ? items.filter((it) => picked.includes(it) || isRelated(it)) : picked;
    const indexOnly = mode === 'index' || mode === 'related' ? items.filter((it) => !full.includes(it)) : [];
    for (const it of full) { S.push(col.kind === 'components' ? compBlock(it) : itemBlock(it, project.designDir)); included.push(String(it.id)); }
    if (indexOnly.length) S.push(`목록 — 본문이 필요하면 \`npm run ds -- context --session ${session} --ids <ID>\` 로 더 읽는다.`, '', ...indexOnly.map((it) => `- ${col.kind === 'components' ? `${it.id} \`${it.class}\` — ${it.summary ?? ''}${it.use ? ' · 언제: ' + text(it.use) : ''}` : lineOf(col, it)}`), '');
  }
  const body = S.join('\n');
  const receipt = { session, ids: want, included: [...new Set(included)], kit: KIT_VERSION, hash: createHash('sha256').update(body).digest('hex').slice(0, 16) };
  const full = body + '\n---\n지침 전달 기록: ' + JSON.stringify(receipt) + '\n';
  if (flags.out) { mkdirSync(path.dirname(path.resolve(flags.out)), { recursive: true }); writeFileSync(path.resolve(flags.out), full); console.log(`${flags.out} — ${full.length.toLocaleString()}자 · 항목 ${receipt.included.length}`); }
  else process.stdout.write(full);
  return 0;
}

// ── preview ──
function preview() {
  const file = rest[0];
  if (!file) throw new DsError('미리 볼 HTML 파일을 주세요');
  const g = gather();
  const { project } = g;
  const vps = viewportsOf(project.config);
  const vp = vps.find((v) => v.id === flags.viewport) ?? vps[0];
  const dir = outDir(project, 'preview');
  const abs = path.resolve(file);
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') && !flags.name) throw new DsError(`${file} 는 이 폴더 밖에 있습니다 — 화면 원본은 work/ 나 quality/runs/ 아래에 두세요(또는 --name 으로 이름을 주세요)`);
  if (!existsSync(abs)) throw new DsError(`${file} 가 없습니다`);
  const body = bodyOf(readFileSync(abs, 'utf8'));
  const name = String(flags.name ?? rel.replace(/\.html?$/, '').replace(/^work[\\/]/, '')).replace(/[\\/]+/g, '-').replace(/[^\w가-힣.-]+/g, '_');
  const scale = Math.min(1, 720 / vp.height);
  let image = '';
  if (flags.image) {
    const img = byKind(project, 'images').flatMap((c) => c.items).find((i) => i.id === flags.image);
    if (!img) throw new DsError(`그림 ${flags.image} 가 없습니다`);
    image = `<div><p class="dskit-cap">그림 ${esc(img.id)} — 배울 것: ${esc(img.learn ?? '')}</p><div class="dskit-frame" style="width:${vp.width}px;zoom:${scale}"><img src="${dataUri(imagePath(img))}" alt="${esc(img.see ?? '')}"></div></div>`;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>미리보기 — ${esc(name)}</title>
<style>${fullCss(g)}\n${CHROME}</style></head>
<body class="dskit"><h1>${esc(name)}</h1><p class="meta">${esc(vp.id)} ${vp.width}×${vp.height}${flags.mode ? ' · ' + esc(flags.mode) : ''} · 원본 ${esc(rel)} · 디자인 시안(개발 컴포넌트 아님)</p>
<div class="dskit-frames"><div><p class="dskit-cap">생성 화면</p><div class="dskit-frame" style="width:${vp.width}px;height:${vp.height}px;zoom:${scale}"${flags.mode ? ` data-mode="${esc(flags.mode)}"` : ''}>${body}</div></div>${image}</div><script>${compsJs(g.comps)}</script></body></html>`;
  const out = path.join(dir, `${name}.html`);
  writeFileSync(out, html);
  console.log(`${path.relative(process.cwd(), out)} — 브라우저로 여세요 (file:// 이 안 열리면 npm run ds -- serve)`);
  return 0;
}

// ── serve ──
async function serve() {
  const config = readConfig();
  const base = path.join(root, config.build ?? 'build');
  mkdirSync(base, { recursive: true });
  const port = Number(flags.port ?? 6107);
  const { createServer } = await import('node:http');
  const types = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', json: 'application/json', md: 'text/markdown; charset=utf-8', ...MIME };
  createServer((req, res) => {
    const p = path.join(base, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(base) || !existsSync(p) || statSync(p).isDirectory()) {
      const pv = path.join(base, 'preview');
      const files = ['kit.html', 'map.md', ...(existsSync(pv) ? readdirSync(pv).filter((f) => f.endsWith('.html')).sort().map((f) => `preview/${f}`) : [])];
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<ul>${files.map((f) => `<li><a href="/${f}">${f}</a></li>`).join('')}</ul>`);
    }
    res.writeHead(200, { 'content-type': types[path.extname(p).slice(1)] ?? 'application/octet-stream' });
    res.end(readFileSync(p));
  }).listen(port, '127.0.0.1', () => console.log(`http://localhost:${port}/ — 키트 · 빈칸 지도 · 미리보기 목록 (끄려면 Ctrl+C)`));
  return new Promise(() => {});
}

try {
  process.exitCode = await main();
} catch (e) {
  if (e instanceof DsError) { console.error(`✗ ${e.message}`); process.exitCode = 1; }
  else throw e;
}
