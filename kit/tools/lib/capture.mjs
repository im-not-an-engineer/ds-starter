// 캡처 — 생성 화면 · 컴포넌트를 실제 브라우저로 그려 PNG 로. 피그마 원본과 나란히 대조하는 재료다.
// 이 PC 의 크롬 계열 브라우저(Chrome · Edge · Brave · Chromium)를 헤드리스로 쓴다. 없으면 DS_BROWSER 에 실행 파일 경로를 준다.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { DsError } from './load.mjs';

const CANDIDATES = [
  process.env.DS_BROWSER,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

export function findBrowser() {
  const hit = CANDIDATES.find((p) => existsSync(p));
  if (!hit) throw new DsError('캡처할 브라우저(Chrome · Edge · Brave · Chromium)를 찾지 못했습니다 — 설치하거나 DS_BROWSER 에 실행 파일 경로를 줍니다. 그동안은 에이전트의 브라우저 도구로 미리보기를 찍어도 된다');
  return hit;
}

/** html(조각) 을 css · js 와 함께 그려 out(PNG)에. width × height 창 크기 */
export function capturePng({ body, css, js, width, height, out, mode, workDir }) {
  mkdirSync(path.dirname(out), { recursive: true });
  mkdirSync(workDir, { recursive: true });
  const page = path.join(workDir, `_capture-${process.pid}.html`);
  writeFileSync(page, `<!doctype html><html${mode ? ` data-mode="${mode}"` : ''}><head><meta charset="utf-8"><style>${css}
html,body{margin:0;height:100%;background:var(--color-bg-canvas)}</style></head><body${mode ? ` data-mode="${mode}"` : ''}>${body}<script>${js ?? ''}</script></body></html>`);
  const browser = findBrowser();
  try {
    execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${path.join(workDir, '.browser')}`,
      `--window-size=${width},${height}`, `--screenshot=${out}`, `file://${page}`], { stdio: 'pipe', timeout: 60000 });
  } catch (e) {
    if (!existsSync(out)) throw new DsError(`캡처하지 못했습니다 — ${String(e.message).split('\n')[0]}`);
  }
  return out;
}
