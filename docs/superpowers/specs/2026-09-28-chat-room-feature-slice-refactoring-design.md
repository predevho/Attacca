# 채팅 방 화면 기능 단위 정리 설계

## 목표

`/chat/[id]` 라우트에 함께 있던 화면 표현을 분리하되, REST 이력·읽음 처리와 STOMP 연결·재구독·스크롤 보정의 동작은 바꾸지 않는다.

## 선택

* `ChatRoomHeader`는 방 이름 파생, 뒤로가기, GROUP 전용 참여자·초대·나가기 UI를 맡는다.
* `ChatRoomTimeline`은 과거 이력 버튼과 메시지 버블 목록만 맡는다.
* 라우트 페이지는 BFF 호출, STOMP lifecycle, 메시지 병합, 읽음 처리, 스크롤 위치 보정을 계속 조합한다.

## 유지하는 경계

* `MessageComposer`의 IME 조합 중 Enter 차단은 그대로 둔다. 마지막 글자 중복 전송을 막는 운영 수정이기 때문이다.
* `lib/chat/stompClient.ts`의 연결 전 구독 보관과 재연결 재구독은 통신 경계라 이동하지 않는다.
* 메시지 수신 시 바닥 근처 여부를 추가 전에 판단하고, 과거 이력 추가 시 높이 차를 보정하는 로직은 라우트 상태와 같은 곳에 둔다.

## 비선택

* `useChatRoom` 훅으로 네트워크 상태까지 한 번에 추출하지 않는다. 효과, ref, cleanup의 소유권이 한 번에 이동해 회귀 범위가 커진다.
* URL, BFF 계약, STOMP destination, 메시지 DTO, 화면 문구는 변경하지 않는다.

## 검증

* 새 헤더와 타임라인의 단위 렌더링을 테스트한다.
* 기존 방 페이지 테스트로 이력·구독·수신·전송·읽음·DIRECT 헤더·실패 화면을 회귀 확인한다.
* FE 테스트, 타입 검사, lint, 색 토큰 검사, production build를 실행한다.

## 참고

* 내부 규칙: `docs/ARCHITECTURE-STATUTE.md` §4, `docs/DOMAIN-CHAT-STATUTE.md`
* 운영 수정 기록: `docs/AI-ACTION-LOGS.md`의 2026-09-19 WebSocket/IME 항목
