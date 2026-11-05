// 지침 · 그림 — 항목 사이 참조([[ID]]), 그림 파일, 지침 항목의 기계 검사(check).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseHtml, walk } from './html.mjs';

export const refsIn = (obj) => [...JSON.stringify(obj ?? '').matchAll(/\[\[([^\]\s]+)\]\]/g)].map((m) => m[1]);

/** 모든 항목의 ID → 어느 묶음 */
export function idIndex(project, comps) {
  const ids = new Map();
  const dup = [];
  const add = (id, where) => { if (ids.has(id)) dup.push(`${id} 가 ${ids.get(id)} 와 ${where} 에 둘 다 있습니다`); else ids.set(id, where); };
  for (const col of project.collections) {
    if (col.kind === 'tokens' || col.kind === 'components') continue;
    for (const it of col.items) add(String(it.id), col.id);
  }
  for (const c of comps) add(String(c.id), c.collection);
  return { ids, dup };
}

/** 그림 항목의 src 는 그 목록 파일(images.yaml) 기준 경로다 */
export const imagePath = (item) => path.resolve(path.dirname(item.file), item.src ?? '');

export function checkImages(col) {
  const out = [];
  for (const it of col.items) {
    if (!it.src) { out.push({ level: 'error', msg: `${col.id}/${it.id}: src(그림 파일)가 없습니다` }); continue; }
    if (!existsSync(imagePath(it))) out.push({ level: 'error', msg: `${col.id}/${it.id}: 그림 파일 ${it.src} 가 없습니다` });
    if (!it.learn) out.push({ level: 'warn', msg: `${col.id}/${it.id}: learn(이 그림에서 배울 것)이 없습니다 — 에이전트가 그림의 무엇을 따라야 할지 짐작합니다` });
  }
  return out;
}

/**
 * 지침 항목의 check — 생성 화면 한 장에.
 *   require-class · forbid-class · max-count: { 클래스: n } · require-attr
 *   조건: when-class(이 클래스가 있는 화면에만) · unless-class(이 클래스가 있는 화면은 빼고). 조건이 없으면 모든 화면에 걸린다.
 */
export function checkRules(html, rules) {
  const out = [];
  const els = [...walk(parseHtml(html))];
  const count = (c) => els.filter((e) => e.classes.includes(c)).length;
  for (const r of rules) {
    const ck = r.check;
    const when = [].concat(ck['when-class'] ?? []);
    const unless = [].concat(ck['unless-class'] ?? []);
    if (when.length && !when.some((c) => count(c))) continue;
    if (unless.some((c) => count(c))) continue;
    const level = r.severity === 'error' ? 'error' : 'warn';
    const say = (why) => out.push({ level, msg: `${r.id}${r.title ? ' ' + r.title : ''}: ${why}` });
    for (const c of [].concat(ck['require-class'] ?? [])) if (!count(c)) say(`${c} 가 있어야 합니다`);
    for (const c of [].concat(ck['forbid-class'] ?? [])) if (count(c)) say(`${c} 를 쓰지 않습니다`);
    for (const [c, n] of Object.entries(ck['max-count'] ?? {})) if (count(c) > n) say(`${c} 는 ${n}개까지 (지금 ${count(c)})`);
    for (const a of [].concat(ck['require-attr'] ?? [])) if (!els.some((e) => e.attrs.has(a))) say(`${a} 속성이 있어야 합니다`);
  }
  return out;
}

export function bodyOf(html) {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1] : html.replace(/<!doctype[^>]*>|<\/?html[^>]*>|<head>[\s\S]*?<\/head>/gi, '');
}
