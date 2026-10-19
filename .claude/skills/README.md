# 프로젝트 스킬

이 폴더의 스킬은 Matt Pocock의 스킬 모음에서 필요한 것만 복사했다.

- 원본: https://github.com/mattpocock/skills
- 기준 커밋: `49dd158d1076134a641b33efb035946536778336` (2026-10-09, 플러그인 버전 1.3.1)
- 라이선스: MIT — `LICENSE-mattpocock-skills` (Copyright (c) 2026 Matt Pocock)
- 도입 결정: 2026-10-19, `docs/AI-MAJOR-EVENT.md`

## 복사한 스킬 (13개)

| 단계 | 스킬 | 호출 |
|---|---|---|
| 설정 | `setup-matt-pocock-skills` | 사용자 |
| 결정·용어 | `grilling`, `grill-me`, `grill-with-docs`, `domain-modeling` | grilling·domain-modeling은 모델도 호출 가능 |
| 설계 | `codebase-design` | 모델도 호출 가능 |
| 계획 | `to-spec`, `to-tickets` | 사용자 |
| 구현 | `tdd`, `implement` | tdd는 모델도 호출 가능 |
| 버그 | `diagnosing-bugs` | 모델도 호출 가능 |
| 회고 | `retro`, `writing-for-agents` | retro는 사용자, writing-for-agents는 모델도 호출 가능(`retro`가 내부에서 사용) |

`implement`가 부르는 `code-review`는 원본 스킬이 아니라 Claude Code 기본 `/code-review`다.

## 복사하지 않은 스킬과 이유

- `implement-spec`, `wayfinder`, `triage`, `pr`: 자동 머지·PR·GitHub 이슈와 라벨을 전제한다.
- `wizard`: `.env`와 GitHub secrets에 값을 쓴다.
- `code-review`, `research`, `prototype`: Claude Code 기본 명령과 이름이 겹치거나 기본 기능과 중복된다.
- `teach`, `to-questionnaire`, `ask-matt`, `wait-what`, `improve-codebase-architecture`: 지금 목적에 필요 없다.
- misc·in-progress 폴더 전부: 동결·베타이거나 TypeScript 전용이다.

## 이 저장소에 맞춘 점

- 스킬 원문(영어)은 고치지 않는다. 원본과 비교해 갱신하기 쉽게 하기 위해서다.
- 저장소 규칙과의 연결은 `CLAUDE.md`의 `## Agent skills` 절과 `docs/agents/*.md`에 둔다.
- `CLAUDE.md`의 규칙이 스킬 지시보다 우선한다(한국어 산출물, 요청 시에만 커밋 등).

## 갱신 방법

원본을 새로 받아 위 13개 폴더만 비교한 뒤, 바뀐 부분을 검토하고 덮어쓴다. 기준 커밋도 함께 갱신한다. 자동 갱신은 하지 않는다.
