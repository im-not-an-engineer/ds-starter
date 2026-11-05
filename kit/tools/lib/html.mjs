// 작은 HTML 해석기 — 생성 화면을 요소 나무로 읽어 컴포넌트 계약을 검사한다.
// 브라우저만큼 관대하지 않다: 닫는 태그가 어긋나면 가장 가까운 같은 이름까지 거슬러 닫는다. 의존성 없이.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);

function parseAttrs(src) {
  const attrs = new Map();
  for (const m of src.matchAll(/([^\s=/>"']+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs.set(m[1].toLowerCase(), m[3] ?? m[4] ?? m[5] ?? '');
  }
  return attrs;
}

export function parseHtml(html) {
  const root = { tag: '#root', attrs: new Map(), classes: [], children: [], parent: null, line: 1 };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/\s*([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const line = html.slice(0, m.index).split('\n').length;
    if (m[1]) {
      const name = m[1].toLowerCase();
      let n = cur;
      while (n && n !== root && n.tag !== name) n = n.parent;
      if (n && n !== root) cur = n.parent;
      continue;
    }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    const attrs = parseAttrs(m[3] ?? '');
    const el = { tag, attrs, classes: (attrs.get('class') ?? '').split(/\s+/).filter(Boolean), children: [], parent: cur, line };
    cur.children.push(el);
    if (RAW.has(tag)) {
      const end = html.toLowerCase().indexOf(`</${tag}`, re.lastIndex);
      if (end >= 0) re.lastIndex = end;
      continue;
    }
    if (!VOID.has(tag) && !m[4]) cur = el;
  }
  return root;
}

export function* walk(node) {
  for (const c of node.children) { yield c; yield* walk(c); }
}

export function ancestors(el) {
  const out = [];
  for (let n = el.parent; n && n.tag !== '#root'; n = n.parent) out.push(n);
  return out;
}

export const hasAttr = (el, name, value) => el.attrs.has(name) && (value == null || el.attrs.get(name) === String(value));
