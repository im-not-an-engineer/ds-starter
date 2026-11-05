# 디자인 시스템 스타터킷

**에이전트가 읽고 화면을 만드는 디자인 시스템**을 세우는 출발점이다. 디자이너는 피그마(또는 화면 캡처)만 가지고, Claude Code 같은 코딩 에이전트와 대화하며 세운다.

- **보편 기준이 미리 깔린다** — 값 · 어휘 · 컴포넌트 26개(+ 대상별) · 구성 · 문구 · 상태 문법 · 화면 유형 10과 골격 · 판단 기준 · 규칙.
  피그마가 들어오면 이 기준에 **이 시스템의 모양을 입힌다**. 넣은 화면에 없던 요청도 에이전트가 기준으로 짓는다.
- **대상을 고른다** — 모바일 앱 · 모바일 웹 · 데스크톱 웹(나중에 정해도 된다).
- **구현 방식을 고른다** — HTML 참조 구현 그대로 · 헤드리스 + 우리 스타일 · 오픈소스 그대로 · 기존 코드(나중에 정해도 된다).
- 에이전트가 만드는 것은 **HTML 디자인 시안**이다. 개발 컴포넌트는 고른 구현 방식과 대응표를 따른다.

## 시작하기

필요한 것

| | |
|---|---|
| Node 20 이상 | `node -v` 로 확인 |
| Claude Code | 터미널(`claude`) 또는 Claude 데스크톱 앱의 Code 탭. `AGENTS.md` 를 읽는 다른 코딩 에이전트도 된다 |
| 피그마 MCP | 에이전트가 피그마를 읽으려면 필요하다 — `kit/docs/figma-mcp.md`. 없어도 시작할 수 있다(화면 캡처로 먼저 하고 나중에 잇는다) |
| 브라우저 | 키트 · 미리보기는 파일 하나짜리 HTML. 원본 대조의 캡처에는 Chrome · Edge · Brave 중 하나 |

1. 압축을 빈 폴더에 푼다.
2. 그 폴더에서:

   ```bash
   npm install
   ```

3. 그 폴더를 Claude Code 로 열고 말한다 — **「디자인 시스템 시작하자」**, 피그마 링크가 있으면 함께.

에이전트가 작업 상태를 보고 할 일을 고른다. 언제든 **「어디까지 됐어?」** 라고 물으면 된다(`npm run status`).

## 흐름 — 순서대로가 아니라 상태를 보고

| 작업 | 무엇 | 먼저 필요한 것 |
|---|---|---|
| 바탕 잡기 | 무엇을 위한 시스템 · 대상 · 구현 방식 · 아이콘 수급 | — |
| 기준 깔기 | 보편 기준을 `design/` 에 | 바탕 |
| 피그마 연결 | 에이전트가 피그마를 읽게 | — (반드시 필요) |
| 기준 화면 · 값 · 컴포넌트 | 피그마의 모양을 기준에 입힘 | 기준 + 피그마(또는 캡처) |
| **재료 대조** | 컴포넌트 · 조립의 실제 렌더를 피그마 원본과 나란히 보고 맞춤 | 컴포넌트 |
| 문법 · 판단 맞추기 | 기준 화면에서 이 시스템의 위계 · 간격 · 업무 | 기준 화면 · 컴포넌트 |
| **화면 대조(관문)** | 따로 도는 에이전트가 기준 화면을 재현 → 캡처 · 구조 대조 → 원천을 고침, 통과할 때까지 | 재료 대조 · 문법 |
| 검토 | 디자이너가 초안을 보고 승인 | 컴포넌트 |
| 생성 시험 · 품질 루프 | 지침만 받은 에이전트가 새 요청으로 화면을 만들고, 짐작한 것을 구조로 채움 | 화면 대조 |

막힌 일(예: 피그마 MCP 가 아직 없음)은 이유와 함께 남기고 다른 일을 먼저 한다. 세션 · 기기가 바뀌어도 `progress.yaml` 로 이어진다.

## 명령

| | |
|---|---|
| `npm run status` | 작업 상태 — 지금 할 수 있는 일 · 막힌 일과 푸는 법 |
| `npm run check` | 만들고(build) 원천을 검사 |
| `npm run map` | 빈칸 지도 — 칸마다 채워진 정도 |
| `npm run ds -- baseline` | 보편 기준 깔기(한 번). `--diff` 는 깐 뒤 무엇을 고쳤나 |
| `npm run ds -- figma outline <파일>` | 저장한 피그마 구조(get_metadata)에서 섹션 · 프레임 목록만 |
| `npm run ds -- icons list · add · import` | 아이콘 들이기 — 자체 SVG 또는 lucide · tabler · phosphor · heroicons · material |
| `npm run ds -- check <화면.html>` | 생성 화면 검사 — 계약 · 직접 준 스타일 · 규칙 |
| `npm run ds -- context --session judge\|draw [--ids …]` | 생성 세션에 넘길 지침 |
| `npm run ds -- preview <화면.html> [--image <기준 화면>]` | 기기 틀에 입혀 기준 화면과 나란히 → `build/preview/` |
| `npm run ds -- capture <화면.html> \| --component <ID>` | 실제 브라우저(Chrome · Edge …)로 그려 PNG 로 |
| `npm run ds -- compare <화면.html> --image <원본> [--figma <구조>] \| --component <ID>` | 원본과 나란히 · 구조 대조 · 진단표 → `build/compare/` |
| `npm run ds -- serve` | `build/` 를 http://localhost:6107 로 |

`build/kit.html` — 값 · 어휘 · 컴포넌트(조합표) · 지침을 한 장에. 디자이너가 검토하는 곳이다.

## 폴더

```
ds.config.yaml · progress.yaml · decisions.md    신분증 · 진행 상태 · 결정 기록      ← 이 조직의 것
design/                                          이 시스템의 원천(기준에서 시작)       ← 이 조직의 것
work/ · quality/                                 생성 시험 · 품질 루프                ← 이 조직의 것
kit/                                             스타터킷 — 도구 · 작업 목록 · 보편 기준 원본 · 안내
.claude/skills/ · AGENTS.md · CLAUDE.md          에이전트의 절차와 규칙
```

**스타터킷 새 판으로 바꾸기:** `kit/` · `.claude/skills/` · `AGENTS.md` · `CLAUDE.md` 를 새 판의 것으로 바꾼다. 조직의 것은 그대로 둔다.
새 판의 보편 기준과 지금 `design/` 의 차이는 `npm run ds -- baseline --diff` 로 본다(`kit/VERSION` · `design/.baseline.yaml`).

안내: [구조](kit/docs/structure.md) · [피그마 MCP](kit/docs/figma-mcp.md) · [구현 방식](kit/docs/implementation.md) · [품질 루프](kit/docs/quality-loop.md) · [세션 나누기](kit/docs/sessions.md) · [참고 사례](kit/docs/reference-case.md)
