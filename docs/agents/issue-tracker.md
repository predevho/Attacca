# 이슈 트래커: 저장소 안 마크다운 (docs/features/)

기능 설명(spec)과 작업 단위(ticket)는 GitHub Issues가 아니라 `docs/features/` 아래 마크다운으로 관리한다.
스킬 원문의 `.scratch/`는 이 저장소에서 `docs/features/`로 읽는다.

## 규칙

- 기능 하나에 폴더 하나: `docs/features/<기능-slug>/`
- 기능 설명: `spec.md`. 이미 승인된 설계 문서가 다른 곳(예: `docs/superpowers/specs/`)에 있으면 내용을 복제하지 않고 그 문서를 가리키는 안내만 둔다.
- 작업 단위: `issues/<NN>-<slug>.md`, 01부터 선행 작업 순서대로, 파일 하나에 티켓 하나.
- 상태: 파일 위쪽 `**Status:**` 줄에 `ready-for-agent`(착수 가능) / `in-progress` / `done`.
- 논의 기록은 파일 끝 `## Comments` 아래에 덧붙인다.
- 전체 상태판은 `docs/TODO-*.md`가 정본이다. 해당 TODO 항목에서 기능 폴더로 링크하고 상태를 맞춘다.
- 모든 내용은 한국어로 쓴다.

## 스킬 지시를 이렇게 읽는다

- "이슈 트래커에 게시" → `docs/features/<slug>/` 아래 파일 생성
- "티켓을 가져와" → 지정된 경로의 파일 읽기
- 하지 않는 것: GitHub 이슈·라벨 생성, `gh` 명령
