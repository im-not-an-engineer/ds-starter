---
name: ds
description: 디자인 시스템 스타터킷의 입구 — 작업 상태(npm run status)를 보고 지금 할 수 있는 일을 고르고, 막힌 일은 푸는 법을 알리고, 맞는 절차(ds-shape · ds-figma · ds-edit · ds-review · ds-generate · ds-loop)로 보낸다. "뭐부터 해?", "어디까지 됐어?", "이어서 하자", "디자인 시스템 시작하자", "ds" 처럼 무엇을 할지 정해지지 않은 요청과, 새 세션을 시작할 때 쓴다.
---

# 입구

1. `node_modules/` 가 없으면 `npm install`.
2. `npm run status` — 작업마다 상태 · 기다리는 것 · 막힌 이유, 「지금 할 수 있는 일」, 피그마로 다시 볼 것, 「끝나야 완료」.
3. **피그마 MCP 가 잇혀 있는지 본다** — 내 도구 목록에 Figma 도구(get_metadata · get_design_context …)가 있으면 잇혀 있다.
   잇혀 있는데 progress 의 figma-connect 가 done 이 아니면 `npm run ds -- progress figma-connect done`. 없으면 「지금 할 수 있는 일」 중 피그마가 필요 없는 것부터.
4. 디자이너의 요청이 있으면 그 일로, 없으면 「지금 할 수 있는 일」 중 위에 있는 것으로. 둘 이상이면 무엇을 먼저 할지 한 줄 제안.

| 상황 · 말 | 절차 |
|---|---|
| shape · baseline · graphics 가 안 됨 · "처음이야" · "모바일인데" · "아이콘은?" | `ds-shape` |
| figma-connect · keyscreens · values · components · figma-verify · 피그마 링크 · 캡처 | `ds-figma` |
| calibrate-parts · calibrate-screens · "피그마처럼 안 나와" · "원본이랑 비교" | `ds-calibrate` |
| grammar · judge · implementation · "이거 바꿔줘" | `ds-edit` |
| review · "검토하자" · "승인할 거 보여줘" | `ds-review` |
| generate · "화면 만들어 봐" | `ds-generate` |
| loop · "품질 올리자" | `ds-loop` |

5. 일을 마치면 `npm run status` 를 다시 보여 주고, 다음에 할 수 있는 일을 한 줄로.
6. 일이 여럿이고 서로 기다리지 않으면 `kit/docs/sessions.md` 를 보고 세션을 나눌지 제안한다.
