# 채팅(CHAT) FE 설계 — MVP

- 작성일: 2026-08-12
- 범위: 채팅 도메인 프론트엔드 **MVP**(방 목록 + 대화창 실시간 송수신 + 1:1 시작 + 읽음)
- 참고 선행 구현: 피드/공연/구인/인증연주자 FE (3계층 BFF 패턴). 실시간은 신규.

---

## 결정 사항 요약

1. **범위**: MVP만 — 방 목록(`/chat`), 대화창(`/chat/[id]`: 이력 + 실시간 송수신 + 읽음), 1:1 DIRECT 시작. 그룹/타이핑/presence/검색은 후속 spec.
2. **WS 인증**: BFF `GET /api/bff/chat/ws-token`이 httpOnly access 쿠키를 서버측에서 읽어 토큰을 클라이언트에 반환 → STOMP CONNECT 헤더에 사용. **access 토큰이 WS 연결 동안 JS에 노출됨(사용자 승인한 트레이드오프, 짧은 TTL로 완화).**
3. **STOMP 라이브러리**: `@stomp/stompjs` 추가(프로젝트 "라이브러리 미도입" 관례의 유일 예외 — raw WS STOMP 수작업 비현실적).
4. **1:1 시작**: 회원 검색 API가 없어 회원 id 입력으로 시작(크루드, MVP 한정).

---

## BE 계약 (확인 완료)

REST `/api/chat/**`(인증):
- `POST /rooms` — `CreateRoomRequest{ type:'DIRECT'|'GROUP', participantIds:Long[], title? }`. DIRECT는 participantIds=[상대1명], find-or-create → `ChatRoomResponse`
- `GET /rooms?page=&size=` — `Page<ChatRoomSummaryResponse>`(오프셋)
- `GET /rooms/{id}` — `ChatRoomResponse`
- `GET /rooms/{id}/messages?cursor=&size=` — `CursorPage<ChatMessageResponse>`(id desc, 최신→과거, `nextCursor` null=마지막)
- `POST /rooms/{id}/read` — `ReadRequest{ lastReadMessageId:Long }`
- (초대 `POST /rooms/{id}/participants`, 퇴장 `DELETE /rooms/{id}/participants/me` — MVP 범위 밖)

STOMP:
- 엔드포인트 `/ws`(raw WebSocket, `setAllowedOriginPatterns("*")` — 크로스오리진 허용), app prefix `/app`, broker `/topic`,`/user`
- CONNECT: 네이티브 헤더 `Authorization: Bearer <accessToken>` → Principal=memberId
- `SEND /app/rooms/{id}/send` — `SendMessageRequest{ content:String(≤2000) }` → BE 영속화 후 `/topic/rooms/{id}`로 `ChatMessageResponse` 브로드캐스트
- `SUBSCRIBE /topic/rooms/{id}` — 활성 참여자만(인터셉터 인가)
- (typing/presence — MVP 범위 밖)

DTO:
- `ChatRoomSummaryResponse` = `{ id, type, displayName, lastMessage:{content,senderId,createdAt}|null, unreadCount, lastMessageAt }`
- `ChatRoomResponse` = `{ id, type, title, participants:ParticipantView[], createdAt }`
- `ParticipantView` = `{ id, nickname, verified, online }`
- `ChatMessageResponse` = `{ id, roomId, sender:{id,nickname,verified}, content, createdAt }`
- `CursorPage<T>` = `{ items:T[], nextCursor:Long|null }`
- 에러코드 404-10(ROOM)/404-11(MESSAGE)/403-03(NOT_PARTICIPANT)/400-03(INVALID_PARTICIPANTS)

---

## 1. 라우팅 (페이지 2)

| 경로 | 역할 |
|------|------|
| `/chat` | 방 목록(displayName·마지막 메시지·안읽은 배지) + "새 대화" 시작 |
| `/chat/[id]` | 대화창(참여자 헤더 + 이력 + 실시간 송수신 + 읽음) |

미들웨어 `/chat/:path*` 보호 추가(로그인 1차 방어).

---

## 2. 실시간(STOMP) 통합 (핵심)

- **ws-token 라우트**: `GET /api/bff/chat/ws-token`은 `cookies()`로 `access_token` 쿠키 값을 읽어 `{ token }` 반환(없으면 401). BE로 프록시하지 않는 특수 라우트.
- **연결 순서(만료 완화)**: 대화창 진입 시 ① REST로 상세+이력 로드(`proxyAuthed`→`authedBeFetch`가 401이면 reissue+쿠키 갱신) → ② ws-token 취득(이제 갱신된 쿠키) → ③ STOMP 연결. REST가 먼저 reissue를 태우므로 토큰이 신선하다.
- **클라이언트**: `NEXT_PUBLIC_BE_WS_URL`(예 `ws://localhost:8080/ws`)로 BE에 직접 연결. `@stomp/stompjs`의 `Client({ brokerURL, beforeConnect })`. `beforeConnect`에서 ws-token을 async로 취득해 `connectHeaders={Authorization:'Bearer '+token}` 설정(재연결 시 토큰 재취득).
- **수신**: `SUBSCRIBE /topic/rooms/{id}` → 콜백에서 `ChatMessage`를 목록에 append(`mergeMessages`로 id 중복 제거 — 자기 전송 메시지도 브로드캐스트로 돌아오므로).
- **전송**: `client.publish({ destination:'/app/rooms/{id}/send', body: JSON.stringify({content}) })`.
- **읽음**: 이력 로드 후 + 새 메시지 수신 시 최신 메시지 id로 `POST /rooms/{id}/read`(디바운스 불필요, 단순 최신 id).
- **격리**: 모든 STOMP 로직을 `lib/chat/stompClient.ts` 래퍼에 캡슐화. 페이지는 `connect/subscribeRoom/send/disconnect`만 호출.

---

## 3. 1:1 대화 시작

- `NewChatForm`: 회원 id(number) 입력 → `POST /api/bff/chat/rooms` `{ type:'DIRECT', participantIds:[id] }` → 응답 `id`로 `/chat/{id}` 이동. DIRECT는 find-or-create라 이미 있으면 기존 방.
- 제약: 닉네임 검색/디렉터리 없음(BE 미제공). MVP는 id 입력. 후속에서 검색 도입.

---

## 4. 데이터 계층 (`FE/lib/chat/`)

- `types.ts`
  - `RoomType = 'DIRECT' | 'GROUP'`
  - `RoomSummary` = `{ id, type, displayName, lastMessage: { content, senderId, createdAt } | null, unreadCount, lastMessageAt: string | null }`
  - `RoomDetail` = `{ id, type, title: string | null, participants: ParticipantView[], createdAt }`
  - `ParticipantView` = `{ id, nickname, verified, online }`
  - `ChatMessage` = `{ id, roomId, sender: { id, nickname, verified }, content, createdAt }`
  - `SpringPage<T>` (방 목록), `CursorPage<T>`(feed 재사용, `{ items, nextCursor }`)
  - `NewChatFormValues = { memberId: string }`
- `logic.ts`
  - `toRoomCursorPage(page: SpringPage<RoomSummary>)` — 오프셋→커서(`useInfiniteList` 재사용)
  - `mergeMessages(existing, incoming)` — id 기준 중복 제거 후 id 오름차순 정렬 유지(과거 로드는 앞에, 새 메시지는 뒤에)
  - `sortByIdAsc(msgs)` — id 오름차순(이력 응답은 desc라 표시 전 뒤집기)
  - `formatTime(iso)` — "HH:mm"
  - `validateNewChat(v)` — 회원 id 양의 정수
  - `toCreateDirectRequest(v)` — `{ type:'DIRECT', participantIds:[Number(memberId)] }`
- `stompClient.ts` — `@stomp/stompjs` 래퍼(아래 인터페이스)
  - `createChatSocket(): { connect, subscribeRoom, send, disconnect }`
  - `connect(handlers: { onConnect?, onError? }): void` — ws-token을 beforeConnect에서 취득, `NEXT_PUBLIC_BE_WS_URL`로 연결
  - `subscribeRoom(roomId, onMessage: (m: ChatMessage) => void): () => void` — 구독, 해제 함수 반환
  - `send(roomId, content): void` — publish
  - `disconnect(): void`

---

## 5. BFF 라우트 (`FE/app/api/bff/chat/**`)

```
/api/bff/chat/rooms                 GET(목록 ?page&size) / POST(생성)
/api/bff/chat/rooms/[id]            GET(상세)
/api/bff/chat/rooms/[id]/messages   GET(이력 ?cursor&size)
/api/bff/chat/rooms/[id]/read       POST
/api/bff/chat/ws-token              GET(access 쿠키→{token}, 특수 — proxy 아님)
```
- ws-token 외에는 `proxyAuthed` 얇은 프록시(query/body 통과).
- ws-token: `cookies()`에서 `ACCESS_COOKIE` 읽어 `NextResponse.json({ ok:true, data:{ token }, message:null })`, 없으면 401(`{ ok:false, message:'로그인이 필요합니다.' }`).

---

## 6. 컴포넌트 (`FE/components/chat/`)

- `RoomListItem` — 방 목록 항목(displayName, 마지막 메시지 미리보기, 안읽은수 배지, onOpen)
- `NewChatForm` — 회원 id 입력 → onStart(values)
- `MessageBubble` — 발신자(내 메시지면 우측 정렬·닉네임 생략), 내용, `formatTime`
- `MessageComposer` — textarea + 전송 버튼(Enter 전송, 빈 값 차단, ≤2000)

---

## 7. 권한 / 에러

- 로그인 필요. 미들웨어 `/chat/:path*` 보호 + 페이지에서 신원 확인 실패 시 `/login`.
- BE 에러코드 → BFF message 노출(404-10 없는 방/403-03 비참여자 등). 대화창 진입 시 상세 실패 → "없거나 접근할 수 없는 방입니다".
- WS 연결 끊김 → 상단 배너("실시간 연결이 끊겼습니다. 재연결 중…") + `@stomp/stompjs` 자동 재연결(`reconnectDelay`).

---

## 8. 테스트 (Vitest)

- **logic**: `toRoomCursorPage` / `mergeMessages`(중복·순서) / `sortByIdAsc` / `formatTime` / `validateNewChat` / `toCreateDirectRequest`
- **bff**: 5라우트. ws-token은 쿠키 있으면 `{token}` 반환·없으면 401. rooms 목록/생성/상세/messages/read는 프록시 경로·body/query 전달.
- **stompClient**: `@stomp/stompjs`를 `vi.mock`으로 대체 → `connect`가 `beforeConnect`/`brokerURL` 설정, `subscribeRoom`이 `/topic/rooms/{id}` 구독, `send`가 `/app/rooms/{id}/send`로 publish 하는지 배선 검증.
- **components**: RoomListItem(배지·onOpen), NewChatForm(검증·onStart), MessageBubble(내/상대 정렬), MessageComposer(빈 값 차단·전송).
- **pages**: `/chat`(목록 렌더·안읽은·새 대화→push), `/chat/[id]`(이력 렌더·전송 시 stompClient.send 호출·수신 메시지 append·읽음 호출·상세 실패 안내). `lib/chat/stompClient`를 `vi.mock`으로 대체해 실제 WS 없이 검증.

---

## 9. 범위 밖 (후속 spec)

그룹 방 생성/초대/퇴장, 타이핑 표시, presence(online 필드 활용), 회원 검색/디렉터리, WS용 완전한 reissue 처리(현재는 REST 선행 reissue에 의존), 알림/뱃지 동기화, 메시지 수정/삭제·파일 첨부.

---

## 10. 진행 방식

- TDD, 서브에이전트 주도. 새 브랜치 `feature/chat-fe`(main 분기 — 다른 FE 브랜치와 독립).
- `@stomp/stompjs` 의존성 추가(`FE/package.json`).
- 환경변수 `NEXT_PUBLIC_BE_WS_URL`(로컬 `ws://localhost:8080/ws`) 문서화.
- 문서 반영: CONTEXT/TODO/AI-ACTION-LOGS.

---

## 미해결/확인 필요 사항 (모두 사용자 승인됨)

1. `@stomp/stompjs` 의존성 추가 — 승인.
2. 1:1 시작을 회원 id 입력으로(검색 API 부재) — 승인.
3. WS 연결 동안 access 토큰 JS 노출 — 승인(짧은 TTL 완화).

BE는 완성돼 있어 이번 작업은 FE만. WS 실제 왕복(브라우저↔BE STOMP)은 BE 기동 후 수동 검증 대상(자동 테스트는 stompClient 배선을 목으로 검증).
