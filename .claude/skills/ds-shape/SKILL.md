---
name: ds-shape
description: 디자인 시스템의 바탕을 잡는다 — 무엇을 위한 시스템인지 · 대상(모바일 앱 · 모바일 웹 · 데스크톱 웹 · 미정) · 구현 방식(HTML · 헤드리스 · 오픈소스 · 기존 코드 · 미정) · 아이콘 수급(자체 · 오픈소스)을 디자이너에게 묻고 ds.config.yaml 에 적은 뒤, 보편 기준을 design/ 에 깐다(npm run ds -- baseline). 작업 shape · baseline · graphics. "처음 시작", "구조 잡아줘", "모바일인데", "아이콘은 어떻게?", "구현은 뭘로?", "ds-shape" 같은 요청에 쓴다.
---

# 바탕 잡기 — 신분증 · 기준 깔기 · 그래픽 수급

구조의 칸(값 · 어휘 · 컴포넌트 · 문법 · 판단 · 규칙)은 보편 기준이 이미 갖고 있다. 여기서는 **내용을 정할 질문만** 한다. 한 번에 다 묻지 말고 대화로.

## 1. 묻는다

| 물을 것 | 적는 곳 | 모르면 |
|---|---|---|
| 누가 무엇을 하려고 쓰는 제품인가 · 에이전트에게 무엇을 만들게 할 것인가(화면 한 장 · 흐름 · 섹션) | `description` | 다시 묻는다 — 비면 shape 가 끝나지 않는다 |
| 어디서 보나 | `profile`: mobile-app · mobile-web · desktop-web · core | `core` 로 시작하고 progress 에 메모. 나중에 프로필을 정하면 기준을 다시 깔지 디자이너에게 묻는다 |
| 앱이면 네이티브인가 웹뷰인가, 웹이면 어떤 프레임워크인가 | `platform` · `implementation` | `implementation.approach: undecided` — 생성은 HTML 참조 구현으로 진행 |
| 컴포넌트를 개발에서 무엇으로 쓰나 | `implementation.approach` · `target` | 위와 같다. 고를 때는 `kit/docs/implementation.md` 의 표를 보여 준다 |
| 아이콘 · 그림 리소스가 있나 — 자체 세트(피그마 · SVG 폴더)? | `icons.source: own` | 없으면 오픈소스 세트를 고르게 한다 — lucide(선 · 가장 넓음) · tabler(선 · 많음) · phosphor(굵기 여러 벌) · heroicons(선 · 면) · material(구글) — 피그마의 아이콘 몇 개를 보여 주고 닮은 세트를 추천 |
| 일러스트 · 3D · 여러 색 그림이 있나 | 메모 | 있으면 그림 부품(파일 + url)로 들인다(`ds-figma`) |

## 2. 쓴다 — 디자이너가 고른 것만

`ds.config.yaml` — name · title · description · profile · platform · implementation · icons. `prefix` 는 ds 로 둔다(기준 컴포넌트가 ds- 로 깔린다).
`decisions.md` 에 한 단락 — 무엇을 위한 시스템, 대상, 구현 방식, 아이콘 수급, 누가 골랐나, 버린 안.

## 3. 기준을 깐다

```bash
npm run ds -- baseline            # ds.config.yaml 의 profile 로. 한 번만 — 이미 있으면 막힌다
npm run check && npm run map && npm run status
```

빈칸 지도에서 비어 있는 칸은 대개 그림(기준 화면)과 업무다 — 다음은 `ds-figma`.

## 4. 아이콘을 들인다 (graphics)

```bash
npm install --save-dev lucide-static           # 오픈소스면 그 세트의 패키지(도구가 이름을 알려 준다)
npm run ds -- icons list lucide <찾을 말>
npm run ds -- icons add lucide <이름…>          # 피그마 · 기준 화면에 나오는 것만 — 다 넣지 않는다
npm run ds -- icons import <자체 SVG 폴더>       # 자체 세트
```

아이콘은 한 색으로 다시 칠하는 mask 방식이다. 여러 색 SVG 는 경고가 뜬다 — 그건 그림 부품으로.
기준 아이콘(check · close · plus · search · chevron · info · alert · more · back)이 세트의 모양과 다르면 같은 이름으로 세트의 것을 덮어 넣는다.

## 하지 않는 것

- 기준의 묶음 · 칸을 빼거나 새로 짜지 않는다 — 시스템에 안 맞는 항목은 고치거나 unused 로. 구조를 바꿔야 하면 디자이너와 이유를 decisions.md 에.
- 판단 · 문법의 내용을 일반론으로 더 채우지 않는다 — 내용은 기준 화면과 디자이너의 말에서 나온다(`ds-figma` · `ds-edit`).
