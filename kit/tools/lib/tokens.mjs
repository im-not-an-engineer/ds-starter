// 값 — 토큰 파일을 펼쳐 CSS 변수로. 에이전트가 값을 고를 근거(뜻 · 언제 · 쓰지 않을 때 · 짝)도 함께 읽는다.
//
// 파일 머리
//   layer: primitive(재질 — CSS 로 나가지 않는다) · contract(계약 — 부품 CSS 는 이 이름만 쓴다)
//   mode: <이름>   이 붙은 contract 파일은 그 모드에서 계약 값을 덮는다(예: dark)
//   groups:        갈래(맨 앞 이름 — color · space …)마다 { title, how } — 그 갈래에서 값을 고르는 법. 에이전트가 읽는다
//
// 값 하나
//   'gray.900'                              값만
//   { $value, $description, $use, $avoid, $pair }
//     $description  무엇인가(한 줄)
//     $use          언제 쓰나
//     $avoid        쓰지 않을 때 — 헷갈리는 이웃 값과 가르는 말
//     $pair         함께 쓰는 값(예: 강조 면 ↔ 그 위 글자) — 계약 이름(점 표기)
const REF = /\{([^{}]+)\}/g;
const META = ['$description', '$use', '$avoid', '$pair'];

function flatten(tree, prefix = [], out = new Map()) {
  for (const [k, v] of Object.entries(tree ?? {})) {
    const key = [...prefix, k];
    if (v && typeof v === 'object' && !Array.isArray(v) && !('$value' in v)) flatten(v, key, out);
    else if (v && typeof v === 'object' && '$value' in v) {
      const meta = {};
      for (const m of META) if (v[m] != null) meta[m.slice(1)] = v[m];
      out.set(key.join('.'), { value: v.$value, ...meta });
    } else out.set(key.join('.'), { value: v });
  }
  return out;
}

export const cssName = (dotted) => '--' + dotted.replace(/\./g, '-');

export function buildTokens(collections) {
  const primitive = new Map();
  const contract = new Map();
  const modes = new Map();
  const groups = new Map();
  const problems = [];
  for (const col of collections) {
    for (const item of col.items) {
      const { layer, mode, tokens, groups: g } = item.data;
      if (!['primitive', 'contract'].includes(layer)) { problems.push(`${item.id}: layer 는 primitive 또는 contract (지금: ${layer})`); continue; }
      for (const [k, v] of Object.entries(g ?? {})) groups.set(k, v);
      const flat = flatten(tokens);
      const target = layer === 'primitive' ? primitive : mode ? (modes.get(mode) ?? modes.set(mode, new Map()).get(mode)) : contract;
      for (const [k, v] of flat) {
        if (target.has(k)) problems.push(`${item.id}: ${k} 가 두 번 정의됐습니다`);
        target.set(k, { ...v, file: item.id });
      }
    }
  }
  const resolve = (value, stack = []) => String(value).replace(REF, (_, ref) => {
    if (stack.includes(ref)) { problems.push(`순환 참조: ${[...stack, ref].join(' → ')}`); return '?'; }
    const hit = primitive.get(ref) ?? contract.get(ref);
    if (!hit) { problems.push(`없는 값을 가리킵니다: {${ref}} (${stack[0] ?? ''})`); return '?'; }
    return resolve(hit.value, [...stack, ref]);
  });
  const resolved = new Map([...contract].map(([k, v]) => [k, { ...v, resolved: resolve(v.value, [k]) }]));
  for (const [k, v] of contract) {
    for (const p of [].concat(v.pair ?? [])) if (!contract.has(p)) problems.push(`${k}: 짝($pair) ${p} 가 계약에 없습니다`);
  }
  const modeResolved = new Map();
  for (const [name, m] of modes) {
    for (const k of m.keys()) if (!contract.has(k)) problems.push(`모드 ${name}: 계약에 없는 키 ${k} 를 덮습니다`);
    modeResolved.set(name, new Map([...m].map(([k, v]) => [k, { ...v, resolved: resolve(v.value, [k]) }])));
  }
  return { primitive, contract: resolved, modes: modeResolved, groups, problems };
}

export function tokensCss(t) {
  const decl = (m) => [...m].map(([k, v]) => `  ${cssName(k)}: ${v.resolved};`).join('\n');
  let css = `:root {\n${decl(t.contract)}\n}\n`;
  for (const [name, m] of t.modes) css += `\n[data-mode="${name}"] {\n${decl(m)}\n}\n`;
  return css;
}

/** 에이전트가 읽는 값 표 — 갈래마다 고르는 법 + 이름 · 값 · 뜻 · 언제 · 쓰지 않을 때 · 짝 */
export function tokensMarkdown(t) {
  const byGroup = new Map();
  for (const [k, v] of t.contract) {
    const g = k.split('.')[0];
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push([k, v]);
  }
  const L = [];
  const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  for (const [g, rows] of byGroup) {
    const info = t.groups.get(g) ?? {};
    L.push(`### ${info.title ?? g}`);
    if (info.how) L.push(String(info.how).trim());
    L.push('', '| 이름 | 값 | 뜻 · 언제 | 쓰지 않을 때 | 짝 |', '|---|---|---|---|---|');
    for (const [k, v] of rows) {
      const what = [v.description, v.use && `언제: ${v.use}`].filter(Boolean).join(' — ');
      L.push(`| \`${cssName(k)}\` | ${cell(v.resolved)} | ${cell(what)} | ${cell(v.avoid)} | ${[].concat(v.pair ?? []).map((p) => `\`${cssName(p)}\``).join(' ')} |`);
    }
    L.push('');
  }
  return L.join('\n');
}
