# 구현 방식 고르기

컴포넌트의 **계약(spec.yaml)** 은 하나다. 개발에서 그 계약을 무엇으로 구현할지만 고른다. 생성 · 미리보기 · 검사는 어느 방식이든 HTML 참조 구현으로 같은 판에서 돈다.

| approach | 무엇 | 잘 맞을 때 | 얻는 것 / 잃는 것 |
|---|---|---|---|
| `html` | 스타터킷의 참조 구현(표준 HTML + CSS + 약간의 JS) 그대로 | 프레임워크 미정 · 여러 플랫폼 · 웹뷰 | 어디서나 · 가벼움 / 복잡한 동작(자동완성 · 달력)은 직접 |
| `headless` | 헤드리스(Base UI · Radix · React Aria · Ark UI)에 이 시스템의 값 · 모양을 입힘 | 피그마 디자인을 정확히 살리고 동작은 검증된 것을 | 모양 자유 + 동작 · 접근성 검증 / 프레임워크에 묶임 · 처음 구성이 큼 |
| `library` | 오픈소스 라이브러리 그대로(shadcn/ui · MUI · Ant · Chakra · Ionic · React Native Paper) + 값만 맞춤 | 빨리 시작 · 디자인 차별이 크지 않음 | 동작 완성 / 그 라이브러리처럼 보이고, 계약과 다른 곳이 남음(gap) |
| `existing` | 조직이 가진 컴포넌트 코드 | 개발 자산이 이미 있음 | 개발과 바로 이어짐 / 계약 ↔ 코드 대응 작업 |
| `undecided` | 아직 미정 | — | 생성 · 미리보기는 참조 구현으로 진행. 작업 상태에 「미정」 으로 남는다 |

## 정하는 순서

1. 대상(프로필)과 개발 팀의 프레임워크를 묻는다 — 네이티브 앱이면 계약이 명세가 된다(구현은 그 플랫폼의 코드).
2. `ds.config.yaml` 의 `implementation.approach` · `target` 을 적는다.
3. `design/implementation.yaml` 에 컴포넌트마다 대응을 적는다. 라이브러리에 없는 것 · 다른 것은 `gap` 에.
4. `npm run check` — approach 를 정했는데 대응이 없는 컴포넌트를 알린다.

## 대응 예 — library: shadcn/ui

```yaml
mapping:
  button:
    target: Button
    props: { intent.primary: 'variant="default"', intent.secondary: 'variant="outline"', intent.ghost: 'variant="ghost"', intent.danger: 'variant="destructive"', size.sm: 'size="sm"', size.lg: 'size="lg"', icon-only: 'size="icon"' }
    states: { loading: 'disabled + <Loader2 className="animate-spin" />' }
  badge:
    target: Badge
    gap: tone 의 info · success · warning 이 없다 — variant 를 더하거나 className 으로
```

## 대응 예 — headless: Base UI (React)

```yaml
mapping:
  dialog: { target: '<Dialog.Root> + <Dialog.Popup className="ds-dialog">', note: 클래스는 참조 구현의 CSS 를 그대로 쓴다 }
  switch: { target: '<Switch.Root className="ds-switch__control">' }
```
