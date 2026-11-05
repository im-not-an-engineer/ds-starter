// 진행 상태 — kit/tasks.yaml(작업과 선행 조건) + progress.yaml(이 폴더의 상태) + 내용으로 판정하는 작업.
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { readYaml, DsError } from './load.mjs';

const STATUSES = ['todo', 'doing', 'blocked', 'done', 'skipped'];

export function loadTasks(kitDir) {
  return readYaml(path.join(kitDir, 'tasks.yaml')).tasks ?? [];
}

export function readProgress(root) {
  const f = path.join(root, 'progress.yaml');
  return existsSync(f) ? readYaml(f).progress ?? {} : {};
}

export function writeProgress(root, progress) {
  const f = path.join(root, 'progress.yaml');
  const head = '# 진행 상태 — npm run ds -- progress <작업> <todo|doing|blocked|done|skipped> [--note "…"] 로 고친다. 작업 목록은 kit/tasks.yaml\n';
  writeFileSync(f, head + YAML.stringify({ progress }));
}

/** 캡처로 진행해 피그마로 다시 볼 것 — design/ 의 원천에 적힌 figma-check: pending */
export function figmaPending(designDir) {
  const hits = [];
  const visit = (d) => {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      if (n.startsWith('.')) continue;
      const p = path.join(d, n);
      if (statSync(p).isDirectory()) visit(p);
      // 주석 줄(# …)의 안내 글은 세지 않는다
      else if (/\.ya?ml$/.test(n) && readFileSync(p, 'utf8').split('\n').some((l) => !/^\s*#/.test(l) && /figma-check:\s*pending/.test(l.split(' #')[0]))) hits.push(path.relative(designDir, p));
    }
  };
  visit(designDir);
  return hits;
}

/** 작업마다 상태를 판정한다 */
export function evaluate({ root, kitDir, config, designDir }) {
  const tasks = loadTasks(kitDir);
  const saved = readProgress(root);
  const pending = figmaPending(designDir);
  const auto = {
    shape: () => (config.description && config.profile ? 'done' : saved.shape?.status === 'doing' ? 'doing' : 'todo'),
    baseline: () => (existsSync(path.join(designDir, '.baseline.yaml')) ? 'done' : 'todo'),
    graphics: () => (config.icons?.source && config.icons.source !== 'undecided' ? 'done' : 'todo'),
    'figma-verify': () => (pending.length ? 'todo' : saved['figma-connect']?.status === 'done' ? 'done' : 'todo'),
  };
  const state = new Map();
  for (const t of tasks) state.set(t.id, { ...t, status: t.auto ? auto[t.auto]() : saved[t.id]?.status ?? 'todo', note: saved[t.id]?.note, date: saved[t.id]?.date });
  for (const t of state.values()) {
    if (t.status === 'done' || t.status === 'skipped') continue;
    const missing = (t.needs ?? []).filter((n) => !['done', 'skipped'].includes(state.get(n)?.status));
    const anyOk = !t.any?.length || t.any.some((n) => state.get(n)?.status === 'done');
    t.waiting = [...missing, ...(anyOk ? [] : [`${t.any.join(' 또는 ')}`])];
    t.ready = !t.waiting.length && t.status !== 'blocked';
  }
  const required = [...state.values()].filter((t) => t.required && t.status !== 'done');
  return { tasks: [...state.values()], pending, required };
}

export function setProgress(root, kitDir, id, status, note) {
  const tasks = loadTasks(kitDir);
  if (!tasks.some((t) => t.id === id)) throw new DsError(`작업 ${id} 가 없습니다 — ${tasks.map((t) => t.id).join(' · ')}`);
  if (!STATUSES.includes(status)) throw new DsError(`상태는 ${STATUSES.join(' · ')} 중 하나`);
  const p = readProgress(root);
  p[id] = { status, ...(note ? { note } : {}), date: new Date().toISOString().slice(0, 10) };
  writeProgress(root, p);
}
