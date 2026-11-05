---
name: ds-review
description: 디자이너와 초안(draft)을 하나씩 검토하고, 디자이너가 승인한 것만 approved 로 적는다 — 컴포넌트 · 화면 유형 · 문법 · 규칙 · 그림. 위임으로 정한 것을 먼저 모아 보여 준다. 작업 review. "검토하자", "승인할 거 보여줘", "초안 몇 개 남았어?", "이거 승인", "ds-review" 같은 요청에 쓴다.
---

# 검토

승인은 디자이너의 말로만 적는다. 「다 좋아」 는 그때 보여 준 항목에만 해당한다.

## 1. 남은 것

`npm run map` 의 묶음 표 「초안」 열과 `decisions.md` 의 「일괄 위임」 단락. 순서 제안:
1. 위임으로 정한 것(디자이너가 본 적 없는 결정)
2. 컴포넌트(키트에서 눈으로 본다)
3. 화면 유형 · 골격(미리보기로 본다)
4. 문법 · 규칙 · 그림의 learn

## 2. 보여 주는 법

- 컴포넌트: `npm run build` → `build/kit.html` 의 그 컴포넌트(조합표 · 상태) + 피그마의 그 컴포넌트 스크린샷을 나란히. 무엇이 기준 그대로이고 무엇을 피그마에 맞췄는지 한 줄.
- 화면 유형: `npm run ds -- preview design/layouts/<P-…>.html --name <P-…> --image <기준 화면>` — 골격과 기준 화면을 나란히.
- 문법 · 규칙: 항목의 rule 과 이것을 어기는 예 · 지키는 예(do · dont).

한 번에 다섯 개 안팎으로 묶어 보여 준다.

## 3. 적는다

- 승인: `review: { status: approved, by: <디자이너 이름>, date: <오늘> }`.
- 고쳐서 승인: 고치고(`ds-edit`) 다시 보여 준 뒤 승인.
- 이 시스템에서 안 씀: `review: { status: unused, by, date }`.
- 보류: draft 그대로, decisions.md 에 무엇을 기다리는지.

## 4. 끝에

`npm run check && npm run map` — 승인 수 · 남은 초안. 컴포넌트가 다 승인되면 `npm run ds -- progress review done`.
