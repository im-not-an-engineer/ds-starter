// 컴포넌트 — 플랫폼과 무관한 계약(spec.yaml)과 HTML 참조 구현(style.css · behavior.js · examples.html).
//
// spec.yaml 의 칸 (에이전트가 컴포넌트를 고르고 쓰는 근거)
//   title · summary(무엇) · use(언제) · avoid(쓰지 않을 때 — 헷갈리는 이웃과 가르는 말)
//   class        뿌리 클래스(ds-button)
//   props        { 이름: { values: [...], default, vocab, class, note } }  — 고르는 것. 값 하나 = 변형 클래스 하나(기본 '-{value}')
//                { 이름: { type: boolean, class: -block, requires-attr, note } }  — 켜고 끄는 것
//   states       { 이름: { attr, value, note } }  — 상태는 클래스가 아니라 속성으로(disabled · aria-invalid …). { interaction: true } 는 눌림 · 포커스처럼 손이 만드는 것
//   slots        { 이름: { class, note, optional, modifiers: [{ class, note }] } }  — 안에 들어가는 자리(짜임)
//   requires-attr  늘 있어야 하는 속성(예: img 의 alt)
//   template     조합표를 그리는 틀 — {class} · {attrs} · {label} 을 채운다
//   a11y · behavior · rules([[R-…]]) · figma({ name, node }) · review({ status: draft|approved|unused, by, date })
//
// 피그마 대응은 이 칸에서 나온다 — props 의 고르는 것 → Variant 속성, 켜고 끄는 것 → Boolean 속성, states → Variant 「State」, slots → 인스턴스 교체 · 텍스트.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { cssName } from './tokens.mjs';
import { parseHtml, walk, ancestors } from './html.mjs';

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

export function cssClasses(css) {
  const out = new Set();
  const selectors = stripComments(css).replace(/url\([^)]*\)/g, '').replace(/\{[^{}]*\}/g, ' ');
  for (const m of selectors.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(m[1]);
  return out;
}
export const cssVars = (css) => [...stripComments(css).matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
const list = (v) => [].concat(v ?? []).filter((x) => x != null && x !== '');
export const reviewOf = (it) => (typeof it.review === 'object' && it.review ? it.review : { status: it.review ?? 'draft' });

/** 한 컴포넌트의 클래스 모양을 정리한다 */
function shape(c) {
  const mods = []; // { class, where: 'root' | slotClass, prop, value, kind }
  const props = [];
  for (const [name, p] of Object.entries(c.props ?? {})) {
    if (p?.type === 'boolean') {
      const cls = p.class ?? `-${name}`;
      props.push({ name, kind: 'boolean', class: cls, ...p });
      mods.push({ class: cls, where: 'root', prop: name, kind: 'boolean' });
    } else {
      const values = list(p?.values).map(String);
      const pattern = p?.class ?? '-{value}';
      const classes = Object.fromEntries(values.map((v) => [v, pattern.replace('{value}', v)]));
      props.push({ name, kind: 'enum', values, classes, ...p });
      for (const v of values) mods.push({ class: classes[v], where: 'root', prop: name, value: v, kind: 'enum' });
    }
  }
  const slots = Object.entries(c.slots ?? {}).map(([name, s]) => ({ name, ...s }));
  for (const s of slots) for (const m of list(s.modifiers)) mods.push({ class: m.class ?? m, where: s.class, note: m.note, kind: 'slot' });
  const states = Object.entries(c.states ?? {}).map(([name, s]) => ({ name, ...s }));
  return { props, slots, states, mods };
}

export function loadComponents(project) {
  const comps = [];
  for (const col of project.collections.filter((c) => c.kind === 'components')) {
    for (const item of col.items) {
      const dir = path.dirname(item.file);
      const read = (name) => (existsSync(path.join(dir, name)) ? readFileSync(path.join(dir, name), 'utf8') : null);
      const c = { ...item, collection: col.id, dir, css: read('style.css'), js: read('behavior.js'), examples: read('examples.html') };
      Object.assign(c, shape(c));
      c.classes = [c.class, ...c.slots.map((s) => s.class), ...c.mods.map((m) => m.class)].filter(Boolean);
      comps.push(c);
    }
  }
  return comps;
}

export function indexOf(comps) {
  const root = new Map();
  const slot = new Map();
  const mods = new Map();
  for (const c of comps) {
    if (c.class) root.set(c.class, c);
    for (const s of c.slots) if (s.class) slot.set(s.class, { comp: c, slot: s });
    for (const m of c.mods) { if (!mods.has(m.class)) mods.set(m.class, []); mods.get(m.class).push({ ...m, comp: c }); }
  }
  const known = new Set([...root.keys(), ...slot.keys(), ...mods.keys()]);
  return { root, slot, mods, known };
}

/** 원천 검사 — 문제는 { level, msg } */
export function checkComponent(c, { contract, idx, prefix, vocab }) {
  const out = [];
  const err = (msg) => out.push({ level: 'error', msg: `${c.collection}/${c.id}: ${msg}` });
  const warn = (msg) => out.push({ level: 'warn', msg: `${c.collection}/${c.id}: ${msg}` });
  if (!c.class) err('class(뿌리 클래스)가 없습니다');
  for (const n of [c.class, ...c.slots.map((s) => s.class)].filter(Boolean)) if (prefix && !n.startsWith(prefix + '-')) warn(`${n} — 접두사 ${prefix}- 로 시작하지 않습니다`);
  for (const m of c.mods) if (!m.class.startsWith('-')) warn(`변형 ${m.class} 는 - 로 시작하게 합니다 — 뿌리 · 짜임 클래스와 구별되게`);
  for (const p of c.props) {
    if (p.kind === 'enum' && !p.values.length) err(`props.${p.name}: values 가 비었습니다`);
    if (p.kind === 'enum' && p.default != null && !p.values.includes(String(p.default))) err(`props.${p.name}: default ${p.default} 가 values 에 없습니다`);
    if (p.vocab) {
      const v = vocab?.[p.vocab];
      if (!v) err(`props.${p.name}: 어휘 ${p.vocab} 가 vocabulary 에 없습니다`);
      else { const ok = Object.keys(v.values ?? {}).map(String); const bad = p.values.filter((x) => !ok.includes(x)); if (bad.length) err(`props.${p.name}: ${bad.join(' · ')} 는 어휘 ${p.vocab}(${ok.join(' · ')})에 없습니다 — 어휘를 늘리거나 값을 맞춥니다`); }
    } else if (p.kind === 'enum' && vocab) {
      for (const [vn, v] of Object.entries(vocab)) {
        const ok = Object.keys(v.values ?? {}).map(String);
        if (p.values.length > 1 && p.values.every((x) => ok.includes(x))) warn(`props.${p.name}: 값이 모두 어휘 ${vn} 에 있습니다 — vocab: ${vn} 을 답니다`);
      }
    }
  }
  if (!['draft', 'approved', 'unused'].includes(reviewOf(c).status)) err(`review.status 는 draft · approved · unused 중 하나`);
  if (reviewOf(c).status === 'unused') return out;
  if (!c.css) err('style.css 가 없습니다');
  if (c.css) {
    const own = new Set(c.classes);
    for (const k of cssClasses(c.css)) if (!own.has(k) && !idx.known.has(k)) err(`style.css 의 .${k} 가 spec 에 없습니다 — 에이전트가 모르는 클래스가 됩니다`);
    const inCss = cssClasses(c.css);
    // 기본값의 변형 클래스(-md · -neutral …)와 글만 담는 짜임(text: true)은 따로 모양이 없어도 된다
    const quiet = new Set([...c.props.filter((p) => p.kind === 'enum' && p.default != null).map((p) => p.classes[String(p.default)]), ...c.slots.filter((s) => s.text).map((s) => s.class)]);
    for (const k of new Set(c.classes)) if (!inCss.has(k) && !quiet.has(k)) warn(`spec 의 ${k} 가 style.css 에 없습니다`);
    const names = new Set([...contract.keys()].map(cssName));
    for (const v of cssVars(c.css)) if (!v.startsWith('--_') && !names.has(v)) err(`style.css 가 계약에 없는 값 ${v} 를 씁니다`);
    for (const m of stripComments(c.css).matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
      if (!/^(data:|https?:|#|%23)/.test(m[2]) && !existsSync(path.resolve(c.dir, m[2]))) err(`url(${m[2]}) 파일이 컴포넌트 폴더에 없습니다`);
    }
    const body = stripComments(c.css).replace(/var\([^)]*\)/g, '').replace(/url\([^)]*\)/g, '');
    if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/.test(body)) err('style.css 에 색이 직접 적혀 있습니다 — 계약 값(var(--…))으로');
    const px = [...body.matchAll(/(?<![\w-])(\d*\.?\d+)px/g)].map((m) => m[1]).filter((n) => !['0', '1'].includes(n));
    if (px.length) warn(`style.css 에 치수가 직접 적혀 있습니다(${[...new Set(px)].slice(0, 4).join('px · ')}px) — 계약 값을 권합니다`);
  }
  if (!c.summary) warn('summary(무엇)가 없습니다 — 에이전트가 고를 근거가 없습니다');
  if (!c.use) warn('use(언제)가 없습니다 — 에이전트가 고를 근거가 없습니다');
  if (!c.template && !c.examples) warn('template 도 examples.html 도 없습니다 — 쓰는 법을 짐작합니다');
  if (c.examples) for (const p of checkContract(c.examples, idx)) err(`examples.html — ${p.msg}`);
  return out;
}

/** 생성 화면(또는 예시)의 계약 검사 — 지어낸 클래스 · 엉뚱한 곳의 변형 · 짜임 밖의 짜임 · 한 prop 에 값 둘 · 빠진 속성 */
export function checkContract(html, idx) {
  const out = [];
  const tree = parseHtml(html);
  const unknown = new Set();
  const seen = new Set();
  const say = (el, msg) => { const k = msg; if (seen.has(k)) return; seen.add(k); out.push({ level: 'error', msg: `${el.line}행 <${el.tag}> ${msg}` }); };
  for (const el of walk(tree)) {
    const roots = el.classes.filter((k) => idx.root.has(k)).map((k) => idx.root.get(k));
    for (const k of el.classes) {
      if (idx.root.has(k)) continue;
      if (idx.slot.has(k)) {
        const { comp } = idx.slot.get(k);
        if (!roots.includes(comp) && !ancestors(el).some((a) => a.classes.includes(comp.class))) say(el, `${k} 는 ${comp.class} 안에서만 씁니다(짜임)`);
        continue;
      }
      if (idx.mods.has(k)) {
        const owners = idx.mods.get(k);
        const ok = owners.some((o) => (o.where === 'root' ? el.classes.includes(o.comp.class) : el.classes.includes(o.where)));
        if (!ok) say(el, `${k} 를 붙일 곳이 아닙니다 — ${[...new Set(owners.map((o) => (o.where === 'root' ? o.comp.class : o.where)))].join(' · ')} 에 붙입니다`);
        continue;
      }
      unknown.add(k);
    }
    for (const c of roots) {
      for (const p of c.props) {
        if (p.kind === 'enum') {
          const hit = p.values.filter((v) => el.classes.includes(p.classes[v]));
          if (hit.length > 1) say(el, `${c.class} 의 ${p.name} 를 둘 줬습니다(${hit.map((v) => p.classes[v]).join(' · ')}) — 하나만`);
        } else if (el.classes.includes(p.class)) {
          for (const a of list(p['requires-attr'])) if (!el.attrs.has(a)) say(el, `${p.class} 에는 ${a} 속성이 있어야 합니다`);
        }
      }
      for (const a of list(c['requires-attr'])) if (!el.attrs.has(a)) say(el, `${c.class} 에는 ${a} 속성이 있어야 합니다`);
    }
  }
  if (unknown.size) out.unshift({ level: 'error', msg: `없는 클래스 ${unknown.size}개 — ${[...unknown].slice(0, 12).join(' · ')}${unknown.size > 12 ? ' …' : ''}. 컴포넌트에 없는 것은 있는 클래스로 모양만 그리고 data-local="<이름>" 을 답니다` });
  if (/\sstyle\s*=/.test(html)) out.push({ level: 'error', msg: 'style="" 로 값을 직접 줬습니다 — 클래스로만' });
  if (/<style[\s>]/i.test(html)) out.push({ level: 'error', msg: '<style> 을 넣었습니다 — 클래스로만' });
  return out;
}

/** 조합표 — template 으로 props 값마다 · 켜고 끄는 것마다 · 상태마다 한 칸 */
export function matrix(c) {
  if (!c.template) return [];
  const label = c.label ?? c.title ?? '';
  const render = (mods = [], attrs = '') => c.template.replaceAll('{class}', [c.class, ...mods].join(' ')).replaceAll('{attrs}', attrs).replaceAll('{label}', label);
  const cells = [];
  const defaults = c.props.filter((p) => p.kind === 'enum' && p.default != null).map((p) => p.classes[String(p.default)]);
  for (const p of c.props) {
    if (p.kind === 'enum') for (const v of p.values) cells.push({ caption: `${p.name}=${v}`, html: render([...defaults.filter((d) => !Object.values(p.classes).includes(d)), p.classes[v]]) });
    else cells.push({ caption: `${p.name}`, html: render([...defaults, p.class], list(p['requires-attr']).map((a) => ` ${a}="${label}"`).join('')) });
  }
  for (const s of c.states) if (!s.interaction && s.attr) cells.push({ caption: `상태 ${s.name}`, html: render(defaults, ` ${s.attr}${s.value != null ? `="${s.value}"` : ''}`) });
  if (!cells.length) cells.push({ caption: '기본', html: render(defaults) });
  return cells;
}

/** 피그마 대응 — 미러를 만들 때 쓰는 컴포넌트 속성 */
export function figmaSpec(c) {
  const properties = {};
  for (const p of c.props) properties[p.name] = p.kind === 'enum' ? { type: 'VARIANT', values: p.values, default: p.default != null ? String(p.default) : p.values[0] } : { type: 'BOOLEAN', default: false };
  const st = c.states.filter((s) => !s.interaction);
  if (st.length) properties.state = { type: 'VARIANT', values: ['default', ...st.map((s) => s.name)], default: 'default' };
  for (const s of c.slots) properties[s.name] = { type: s.text ? 'TEXT' : 'INSTANCE_SWAP', optional: !!s.optional };
  return { id: c.id, name: c.figma?.name ?? c.title ?? c.id, node: c.figma?.node ?? null, properties, interaction: c.states.filter((s) => s.interaction).map((s) => s.name) };
}
