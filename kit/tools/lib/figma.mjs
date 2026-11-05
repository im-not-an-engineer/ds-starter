// 피그마 구조 목록 — get_metadata 가 돌려준 XML(페이지 전체는 수백만 자)을 파일로 받아, 위쪽 몇 단계만 짧은 표로.
//   npm run ds -- figma outline <파일> [--depth 2] [--type frame,section,component]
// 에이전트는 MCP 응답을 파일로 저장한 뒤 이 명령으로 첫 목록을 뽑는다 — 응답을 통째로 읽지 않는다.
import { readFileSync } from 'node:fs';

export function outline(file, { depth = 2, types } = {}) {
  const xml = readFileSync(file, 'utf8');
  const rows = [];
  let level = 0;
  for (const m of xml.matchAll(/<(\/?)([a-z-]+)\b([^>]*?)(\/?)>/gi)) {
    const [, close, tag, attrs, self] = m;
    if (close) { level--; continue; }
    const a = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    if (level < depth && (!types || types.includes(tag.toLowerCase()))) rows.push({ level, tag, id: a.id ?? '', name: a.name ?? '', w: a.width ?? '', h: a.height ?? '' });
    if (!self) level++;
  }
  return rows;
}
