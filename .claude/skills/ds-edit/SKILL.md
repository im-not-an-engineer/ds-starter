---
name: ds-edit
description: 디자인 시스템의 값 · 어휘 · 컴포넌트 · 문법 · 판단(화면 유형 · 사실 · 갈림 · 업무) · 규칙 · 구현 대응표를 고치거나 더한다 — 지금 것과 그것을 쓰는 곳을 먼저 보여 주고, 같은 형식(계약 칸)을 다 채워 고치고, 검사한다. 작업 grammar · judge · implementation. "이 색 한 단계 진하게", "버튼 변형 하나 더", "이 화면 유형 고쳐줘", "업무 넣어줘", "구현은 shadcn 으로", "ds-edit" 같은 요청에 쓴다.
---

# 고치기

## 먼저 보여 준다

- 값: 지금 값 · 뜻, 그 계약을 쓰는 컴포넌트(`grep -r "var(--<이름>" design/`), 모드 짝.
- 컴포넌트: props · 상태 · 짜임, 가리키는 지침(`[[<id>]]`) · 쓰는 골격(`grep -r "<클래스>" design/layouts`).
- 지침 항목: 지금 내용, 가리키는 곳.

값 · 모양을 정해야 하면 두세 안과 화면에서 달라지는 곳을 보여 주고 고르게 한다.

## 형식 — 비면 검사가 알린다

| 무엇 | 꼭 채울 칸 |
|---|---|
| 계약 값 | `$value` · `$description` · `$use`, 헷갈리면 `$avoid`, 짝이 있으면 `$pair`. 모드 파일이 있으면 짝도 |
| 컴포넌트 | `class` · `summary` · `use` · `avoid` · `props`(어휘의 이름으로 — `vocab:`) · `states`(속성으로, 없으면 `no-states: true`) · `slots` · `template` · `a11y`. style.css 는 계약 값만 |
| 화면 유형 | `job` · `fits` · `avoid` · `needs-facts` · `template`(design/layouts/ 의 HTML 골격) · `regions` · `states` |
| 사실 | `ask` · `if-unknown` · `affects` |
| 갈림 | `between` · `pick` |
| 업무 | `use-when` · `steps`(화면 제목 · 화면 유형) · `words`(고정된 말) |
| 문법 · 규칙 | `rule` · `why` · `grade`(fixed · product · screen), 기계로 볼 수 있으면 `check` |

- 항목 사이는 `[[ID]]`. YAML 의 `[ ]` · `{ }` 안에서는 글을 따옴표로(`'… [[empty]] …'`).
- check 는 **모든 화면**에 걸린다 — 일부에만 걸려면 `when-class` · `unless-class`. 가를 클래스가 없으면 화면 틀에 변형을 더한다.
- 컴포넌트 CSS 는 다른 컴포넌트의 클래스를 선택자에 써도 된다(`.ds-card > .ds-list`). 어느 컴포넌트에도 없는 클래스만 막힌다.
- 이름을 바꾸거나 지우는 것: 쓰는 곳을 모두 함께 고친다. 이미 이 시스템으로 만든 화면 · 제품이 있으면 옛 이름을 한동안 남길지 묻는다. 지우는 대신 `review: { status: unused }` 를 먼저.

## 문법 · 판단을 이 시스템에 맞추기 (작업 grammar · judge)

- 기준 화면(그림)을 근거로 문법의 수치 · 화면 유형의 regions · 골격을 이 시스템의 것으로 고친다 — 근거 그림을 `applies` · `[[K-…]]` 로 잇는다.
- 업무(judge/tasks.yaml)는 디자이너와 — 이 제품의 일 · 단계 · 화면 제목 · 고정된 말. 이것이 비면 생성은 화면의 사실을 짐작한다.
- 보편 화면 유형에 없는 짜임이 기준 화면에 있으면 새 화면 유형 — 골격 HTML 부터.

## 구현 대응표 (작업 implementation)

`ds.config.yaml` 의 `implementation.approach` 를 디자이너 · 개발과 정하고(`kit/docs/implementation.md`), `design/implementation.yaml` 에 컴포넌트마다
target · props · states · gap. approach 가 html 이면 필요 없다.

## 끝에

```bash
npm run check && npm run map && npm run status
```

생성 결과가 달라질 고침(컴포넌트의 use · 판단 · 읽는 법 · 골격)이면 같은 요청으로 다시 만들어 볼지 묻는다(`ds-loop`). decisions.md 에 무엇을 · 왜 · 누가.
