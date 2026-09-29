# Chat Timezone And Date Separator Implementation Plan

**Goal:** 채팅 이력과 새 메시지를 KST 기준으로 표시하고 날짜 경계가 보이는 타임라인을 제공한다.

**Architecture:** BE 컨테이너 JVM의 기본 시간대를 Asia/Seoul로 고정한다. Flyway V9가 기존 채팅 도메인의 자동 시각만 한 번 보정하고, FE는 KST `LocalDateTime` 문자열을 날짜별 그룹으로 변환해 구분선을 렌더링한다.

**Spec:** `docs/superpowers/specs/2026-09-28-chat-timezone-and-date-separator-design.md`

## Task 1: 운영 시간대와 기존 채팅 시각 보정

BE JVM 시간대를 KST로 고정하고, 채팅 도메인의 자동 기록 시각만 Flyway V9로 보정한다.

## Task 2: 채팅 날짜·시간 순수 로직

KST 문자열을 날짜 라벨과 오전/오후 시각으로 변환하고 날짜별로 그룹화한다.

## Task 3: 날짜 구분 타임라인

접근 가능한 날짜 구분선을 메시지 그룹 사이에 표시한다.

## Task 4: 운영 배포와 검증 기록

DB 백업 후 Flyway V9, 대상 범위, 화면을 확인하고 문서 상태를 갱신한다.

## Constraints

- `LocalDateTime`은 Attacca 운영 도메인에서 KST 벽시계 값으로 해석한다.
- `chat_message`, `chat_room`, `chat_participant`의 자동 기록 시각만 보정한다.
- 공연·공지 등 사용자가 입력한 일정은 변경하지 않는다.
- 되돌림은 배포 전 DB 백업 또는 RDS 스냅샷으로만 한다.
- 기존 메시지 정렬, 과거 이력 prepend, 하단 고정, IME 전송 보호를 유지한다.
