// 진행 상태 — kit/tasks.yaml(작업과 선행 조건) + progress.yaml(이 폴더의 상태) + 내용으로 판정하는 작업.
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { readYaml, DsError, glob } from './load.mjs';

/** 재료 대조 — 컴포넌트 · 조립(배치 · 글자 묶음 layout 은 빼고)의 calibration 상태를 센다 */
export function partsCalibration(designDir) {
  const files = [...glob(designDir, 'components/*/spec.yaml'), ...glob(designDir, 'composites/*/spec.yaml')];
  const rows = files.map((f) => { const s = readYaml(f); return { id: path.basename(path.dirname(f)), review: s.review?.status ?? s.review, status: s.calibration?.status ?? 'untested' }; })
    .filter((r) => r.review !== 'unused');
  const ok = rows.filter((r) => ['matched', 'kept'].includes(r.status));
  return { total: rows.length, ok: ok.length, todo: rows.filter((r) => !['matched', 'kept'].includes(r.status)).map((r) => `${r.id}(${r.status})`) };
}

/** 화면 대조 — quality/calibration.yaml 의 기준 화면마다 passed 인가 */
export function screensCalibration(root) {
  const f = path.join(root, 'quality/calibration.yaml');
  const screens = existsSync(f) ? readYaml(f).screens ?? [] : [];
  return { total: screens.length, passed: screens.filter((s) => s.status === 'passed').length, failing: screens.filter((s) => s.status !== 'passed').map((s) => `${s.image ?? s.id}(${s.status ?? 'todo'})`) };
}

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
    'calibrate-parts': () => { const c = partsCalibration(designDir); return c.total && c.ok === c.total ? 'done' : c.ok ? 'doing' : 'todo'; },
    'calibrate-screens': () => { const c = screensCalibration(root); return c.total && c.passed === c.total ? 'done' : c.total ? 'doing' : 'todo'; },
    graphics: () => (config.icons?.source && config.icons.source !== 'undecided' ? 'done' : 'todo'),
    'figma-verify': () => (pending.length ? 'todo' : saved['figma-connect']?.status === 'done' ? 'done' : 'todo'),
  };
  const state = new Map();
  const statusOf = (t) => {
    if (!t.auto) return saved[t.id]?.status ?? 'todo';
    const a = auto[t.auto]();
    // 내용으로 판정하는 작업도 막힘 · 건너뜀은 적은 대로 — 끝나면(done) 그것이 이긴다
    return a !== 'done' && ['blocked', 'skipped'].includes(saved[t.id]?.status) ? saved[t.id].status : a;
  };
  for (const t of tasks) state.set(t.id, { ...t, status: statusOf(t), note: saved[t.id]?.note, date: saved[t.id]?.date });
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
  const task = tasks.find((t) => t.id === id);
  const AUTO_HINT = { 'calibrate-parts': '컴포넌트 · 조립 spec 의 calibration.status 가 모두 matched 또는 kept 가 되면', 'calibrate-screens': 'quality/calibration.yaml 의 기준 화면이 모두 passed 가 되면', shape: 'ds.config.yaml 의 description 과 profile 을 채우면', baseline: 'npm run ds -- baseline 으로 기준을 깔면', graphics: 'ds.config.yaml 의 icons.source 를 정하면(own · lucide …)', 'figma-verify': 'figma-check: pending 이 없고 figma-connect 가 done 이면' };
  if (task.auto && ['done', 'todo', 'doing'].includes(status)) throw new DsError(`${id} 는 내용으로 판정하는 작업이라 상태를 적어도 바뀌지 않습니다 — ${AUTO_HINT[task.auto] ?? '내용을 채우면'} done 이 됩니다(막힘 · 건너뜀만 적을 수 있다)`);
  const p = readProgress(root);
  p[id] = { status, ...(note ? { note } : {}), date: new Date().toISOString().slice(0, 10) };
  writeProgress(root, p);
}
