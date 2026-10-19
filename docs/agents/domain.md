# 도메인 문서

## 탐색 전에 읽을 것

- 루트 `GLOSSARY.md`(용어집). 없으면 그냥 진행한다. `/domain-modeling`이 용어가 실제로 정해질 때 만든다.
- 작업할 도메인의 `docs/DOMAIN-<X>-CONSTITUTION.md`(원칙)와 `docs/DOMAIN-<X>-STATUTE.md`(규칙)
- `docs/ARCHITECTURE-CONSTITUTION.md`, `docs/ARCHITECTURE-STATUTE.md`

## 결정 기록 (docs/adr/ 대신)

이 저장소는 `docs/adr/`를 쓰지 않는다. 스킬이 ADR을 쓰라고 하면:

- `docs/AI-MAJOR-EVENT.md`(상세)와 `docs/AI-MAJOR-EVENT-RECAP.md`(요약)에 항목을 추가한다.
- 도메인 원칙이면 해당 `DOMAIN-<X>-CONSTITUTION.md`에도 반영한다.
- 기록 조건은 세 가지가 모두 맞을 때다: 되돌리기 어렵다 / 맥락 없이 보면 의외다 / 실제 트레이드오프가 있다.
- 원칙·구조 변경은 사용자 승인 후에만 확정한다.

## 용어집의 말을 쓴다

산출물에서 도메인 개념을 부를 때는 `GLOSSARY.md`의 용어를 쓴다. 없는 개념이면 `/domain-modeling` 대상으로 표시한다.

## 기존 결정과 충돌하면 드러낸다

> 예: "AI-MAJOR-EVENT 2026-10-19 결정과 충돌하지만, 다시 열 가치가 있는 이유는…"
