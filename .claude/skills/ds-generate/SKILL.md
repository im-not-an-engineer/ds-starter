---
name: ds-generate
description: 이 디자인 시스템으로 화면을 만들어 본다 — 지침 묶음(ds context)을 만들고, 이 대화와 떨어진 생성 세션(서브에이전트)이 그 지침만 읽고 판단(사실 · 화면 유형) → 그리기(골격에서 출발) → 검사를 하게 한 뒤, 미리보기로 기준 화면과 나란히 보여 주고 생성 세션이 「짐작한 것」 을 모은다. 작업 generate. "이 요청으로 화면 만들어 봐", "홈 화면 생성해 봐", "지금 상태로 테스트", "ds-generate" 같은 요청에 쓴다.
---

# 화면 만들어 보기

이 대화는 시스템을 짓느라 맥락이 많다. 그 맥락으로 만들면 지침의 빈틈이 가려지므로 **생성은 지침 파일만 받은 생성 세션이 한다.**
나오는 것은 **디자인 시안(HTML)** 이다 — 개발 컴포넌트는 구현 방식과 대응표를 따른다.

## 0. 준비

새 요청으로 만들기 전에 원본 대조(`ds-calibrate`)를 통과해야 한다 — `npm run status` 의 calibrate-screens 가 ● 인지 본다. 아니면 그 일부터.
이 절차의 1~2(판단 · 그리기 세션)는 원본 대조의 재현 생성에서도 그대로 쓴다.

`npm run check` 가 통과해야 한다. 작업 폴더는 이 폴더 안 — `work/<작업 이름>/`(품질 루프 회차면 `quality/runs/<날짜>-<회차>/<요청 id>/`).
요청 문장은 디자이너의 말 그대로 `request.md`.

## 1. 판단 세션

```bash
npm run ds -- context --session judge --out <작업>/judge.md
```

서브에이전트에게:

> `judge.md` 와 `request.md` 만 읽는다. 읽는 법의 「고르는 순서」 1~3 을 따라 `decision.md` 를 쓴다 —
> 업무(있으면) · 확인한 사실과 가정한 것(사실 ID 마다 값, 모르면 if-unknown) · 화면마다 고른 화면 유형과 근거(fits · avoid) · 맞는 것이 없으면 P-free 와 이유 ·
> 그릴 상태 목록 · 시스템에 없던 것. 화면은 그리지 않는다. 마지막 줄에 그리기 지침에 넘길 ID 들(화면 유형 · 사실 · 업무)을 쉼표로.

## 2. 그리기 세션

```bash
npm run ds -- context --session draw --ids <decision.md 마지막 줄의 ID> --out <작업>/draw.md
```

새 서브에이전트에게:

> `draw.md` · `request.md` · `decision.md` 만 읽는다. 원천 파일(design/ · kit/ · 다른 work/)은 열지 않는다. 그림 파일은 지침이 가리키면 열어 본다.
> draw.md 에 목록으로만 있는 항목의 본문이 필요하면 `npm run ds -- context --session draw --ids <ID>` 로 더 읽어도 된다 — 더 읽은 ID 와 이유를 notes.md 에 적는다(그것이 지침의 빈틈이다).
> 고른 화면 유형의 **골격 HTML 에서 출발**해 regions 를 채운다. 상태마다 파일 하나 — `<작업>/<화면>-<상태>.html`(HTML 조각, html · head 없이).
> `npm run ds -- check <작업>/*.html` 이 통과할 때까지 고친다.
> `<작업>/notes.md` — 고른 것과 근거 · 가정한 것 · **지침에 없어서 짐작한 것(빠짐없이, 번호 목록, 각각 어느 칸 — 읽는 법 · 값 · 어휘 · 컴포넌트 · 문법 · 판단 · 그림 · 규칙 — 의 빈틈인지)** · data-local 을 단 곳.

지침이 너무 크면(3만 자 넘게) 지도에서 컴포넌트 묶음의 `load` 를 `{ judge: index, draw: related }` 로 바꾸자고 제안한다 — 고른 화면 유형과 그 골격,
그리고 늘 읽히는 문법(상태 처리 · 구성)과 규칙이 가리키는 컴포넌트만 본문으로 싣는다. 바꾼 뒤 draw.md 에 빈 상태 · 안내처럼 상태를 그릴 컴포넌트가 실렸는지 한 번 본다.

## 3. 보기

```bash
npm run ds -- preview <작업>/<화면>-<상태>.html --image <기준 화면 ID>
npm run ds -- preview <작업>/<화면>-<상태>.html --viewport <ID> --mode dark
```

`build/preview/` 의 파일을 연다(안 열리면 `npm run ds -- serve`).

## 4. 보고

검사 결과 · 미리보기 · 고른 화면 유형(P-free 면 이유) · **짐작한 것**(칸별로 묶어서) · 기준 화면과 다른 곳 · data-local.
그다음: 빈틈을 채울지(`ds-edit`), 같은 요청으로 다시 돌릴지(`ds-loop`). `npm run ds -- progress generate done`(처음이면).

생성 세션이 원천을 고쳤으면 되돌리고 알린다.
