# DOMAIN-CHAT-STATUTE

채팅 도메인 구현 규칙.

> 작성일: 2026-07-26. 기준 spec: `docs/superpowers/specs/2026-07-26-chat-domain-design.md`.
> 통합 방 모델·1:1 유일성·WebSocket 인증/인가·soft leave·append-only·인메모리 브로커·도메인 경계·페이징은 확정 규칙이다. 세부 시그니처는 구현 태스크에서 확정하며, 변경 시 이 문서를 갱신한다.

---

## 1. 패키지

```
com.back.domain.chat
├── controller        # REST 컨트롤러 + STOMP @MessageMapping 핸들러
├── service
├── repository
├── entity
└── dto

com.back.global.websocket        # WebSocket 인프라(도메인 아님)
├── WebSocketConfig              # STOMP 엔드포인트/브로커/prefix 설정
├── StompAuthChannelInterceptor  # CONNECT 인증 + SUBSCRIBE/SEND 인가
├── PresenceRegistry             # 접속 상태 인터페이스
└── InMemoryPresenceRegistry     # 인메모리 구현(추후 Redis 구현으로 교체)
```

* WebSocket 설정·인터셉터·presence는 특정 FE에 종속되지 않는 **전역 인프라**이므로 `com.back.global.websocket`에 둔다(보안 `com.back.global.security`와 같은 위치 정책).

---

## 2. 엔티티

`BaseEntity` 상속(createdAt/updatedAt). 기존 패턴 준수: `@NoArgsConstructor(access = PROTECTED)` + private 생성자 + static 팩토리, 단순 접근자는 Lombok `@Getter`, setter 금지(의도가 드러나는 변경 메서드).

### 2.1 ChatRoom

| 필드 | 타입 | 제약 |
|---|---|---|
| `id` | Long | PK |
| `type` | enum(`DIRECT`/`GROUP`) | non-null |
| `title` | String | 그룹방 이름. ≤100, nullable. DIRECT는 항상 null(읽을 때 상대 닉네임으로 파생) |
| `createdBy` | Long | 방 생성자. non-null |
| `directKey` | String | **1:1 중복 방지 키**. `min(a,b):max(a,b)` 형식. DIRECT만 값 있음, GROUP은 null. **unique 제약** |
| `lastMessageAt` | LocalDateTime | 마지막 메시지 시각(비정규화). **생성 시각으로 초기화(non-null)**, 메시지 전송 시 갱신. 방 목록 정렬·페이징 기준 |

* `lastMessageAt`은 CHAT 자신의 데이터로, 방 생성 시 생성 시각으로 초기화하고 메시지 전송 시 서비스가 갱신한다(`updateLastMessageAt(now)`). MEMBER 데이터 비정규화 금지와 무관하다. 방 목록을 DB에서 "마지막 메시지 최신순"으로 오프셋 페이징하기 위한 읽기모델 최적화다(메시지 전체 max 집계를 매 조회마다 하지 않기 위함). non-null로 두어 `NULLS LAST` 없이 MySQL·H2 양쪽에서 이식 가능한 정렬을 쓴다.
* 팩토리:
  * `createDirect(memberA, memberB)` — `directKey = min+":"+max`로 정규화. `memberA == memberB`면 `CHAT_INVALID_PARTICIPANTS`(자기 자신과 1:1 불가).
  * `createGroup(creatorId, title)` — `directKey = null`.
* **`directKey`의 unique 제약**: DB가 최후의 심판으로 중복 DIRECT 방을 차단한다. GROUP은 `directKey`가 null이며, 표준 SQL은 null을 unique 위반으로 치지 않으므로 여러 GROUP 방이 공존한다.
* 방 자체는 이번 범위에서 soft delete를 두지 않는다(참여자 단위 leave로 처리). 모든 참여자가 나간 방의 정리(GC)는 범위 밖.

### 2.2 ChatParticipant

| 필드 | 타입 | 제약 |
|---|---|---|
| `id` | Long | PK |
| `roomId` | Long | non-null |
| `memberId` | Long | non-null |
| `leftAt` | LocalDateTime | 퇴장 마킹. null=활성 참여 |
| `lastReadMessageId` | Long | 읽음 커서. nullable(아직 아무것도 안 읽음) |

* `(roomId, memberId)` **unique 제약**(한 방에 같은 회원은 한 행). 재입장은 새 행을 만들지 않고 기존 행의 `leftAt`을 null로 되돌린다.
* 변경 메서드: `leave()`(leftAt=now), `rejoin()`(leftAt=null), `updateLastRead(messageId)`(더 큰 값으로만 전진), `isActive()`(leftAt==null).
* `joinedAt`은 `BaseEntity.createdAt`을 사용한다(별도 필드 없음).

### 2.3 ChatMessage (append-only)

| 필드 | 타입 | 제약 |
|---|---|---|
| `id` | Long | PK. 커서·읽음 판정 기준(단조 증가) |
| `roomId` | Long | non-null |
| `senderId` | Long | non-null |
| `content` | String | 본문(텍스트). non-null, ≤2000 |

* 팩토리: `create(roomId, senderId, content)`. 변경 메서드 없음(이번 범위 수정·삭제 없음).
* 정렬·커서·읽음 판정은 `id`(단조 증가)를 기준으로 한다. `createdAt`은 표시용.

---

## 3. WebSocket 설정 & 인증/인가 (확정)

### 3.1 STOMP 설정 (`WebSocketConfig`)

* 엔드포인트: `/ws`(네이티브 WebSocket). 브라우저 폴백이 필요하면 SockJS는 FE 이터레이션에서 검토(범위 밖).
* application prefix(클라→서버): `/app`.
* broker prefix(서버→클라 구독): `/topic`, `/user`. 이번엔 인메모리 Simple Broker(`enableSimpleBroker("/topic", "/user")`).
* **Redis 교체 지점**: 다중 서버 시 `enableStompBrokerRelay(...)`로 이 설정만 바꾸면 된다. 도메인 코드는 `SimpMessagingTemplate`만 사용하므로 영향 없음.

### 3.2 목적지(Destination)

| 방향 | 목적지 | 설명 |
|---|---|---|
| SUBSCRIBE | `/topic/rooms/{roomId}` | 그 방의 실시간 메시지·typing·presence 이벤트 수신 |
| SEND | `/app/rooms/{roomId}/send` | 메시지 전송. body `{content}` → 영속화 → `/topic/rooms/{roomId}`로 브로드캐스트 |
| SEND | `/app/rooms/{roomId}/typing` | 입력 중 신호. **영속화 안 함** → `/topic/rooms/{roomId}`로 브로드캐스트 |

* presence(접속/해제)는 클라 전송 없이 서버가 연결 생명주기 이벤트로 감지해 관련 방 topic에 브로드캐스트한다(§3.4).

### 3.3 인증/인가 (`StompAuthChannelInterceptor`, 인바운드 채널)

* **CONNECT**: STOMP CONNECT 프레임의 `Authorization: Bearer <access>` 헤더를 `JwtProvider`로 검증 → `Principal`(memberId) 설정. 실패 시 연결 거절. 기존 REST의 Bearer JWT와 동일 개념·동일 `JwtProvider` 재사용.
* **SUBSCRIBE** `/topic/rooms/{roomId}`: Principal이 그 방의 **활성 참여자**(`leftAt IS NULL`)인지 검증. 아니면 거절(`NOT_ROOM_PARTICIPANT`).
* **SEND** `/app/rooms/{roomId}/**`: 동일하게 활성 참여자 검증. 아니면 거절.
* WebSocket 인가 실패는 REST의 `ApiResponse` 래퍼가 아니라 STOMP ERROR 프레임으로 클라에 전달된다(전송 계층이 다름). 사유 코드는 REST 에러코드(`NOT_ROOM_PARTICIPANT` 403-03)와 동일 어휘를 쓴다.

### 3.4 presence (`PresenceRegistry`)

* `SessionConnectedEvent`/`SessionDisconnectEvent`를 리스닝해 온라인 memberId 집합을 인메모리로 갱신한다.
* 상태 변화 시 그 회원이 활성 참여 중인 방들의 `/topic/rooms/{roomId}`에 presence 이벤트(`{memberId, online}`)를 브로드캐스트한다.
* 한 회원이 여러 연결(탭·기기)을 가질 수 있으므로 **연결 수 카운팅**으로 online/offline을 판정한다(마지막 연결이 끊길 때만 offline).
* **한계(문서화)**: 인메모리·단일 서버 기준으로만 정확하다. 다중 서버에서는 Redis 기반 `PresenceRegistry` 구현으로 교체해야 정확해진다.

---

## 4. 방 생성 & 참여자 규칙 (확정)

### 4.1 방 생성 (`POST /api/chat/rooms`)

* body `{type, participantIds[], title?}`. `type`은 `DIRECT`/`GROUP`.
* **DIRECT**: `participantIds`는 상대 1명(자신 제외). 요청자+상대로 `directKey` 계산 → `findByDirectKey`로 **find-or-create**. 이미 있으면 그 방 반환(200), 없으면 생성.
  * 동시성: `find → insert` 사이 경합으로 unique 위반이 나면 예외를 잡고 기존 방을 재조회해 반환한다(멱등). FEED 좋아요 멱등 처리와 동일한 사고방식.
  * 검증: 상대가 정확히 1명 아님/자기 자신이면 `CHAT_INVALID_PARTICIPANTS`(400-03).
* **GROUP**: 요청자를 포함해 초기 참여자 행을 만든다. `participantIds`가 비어도 요청자 단독 방은 허용(이후 초대). `title`은 선택.

### 4.2 참여자 관리 (평평한 모델)

| 행위 | 자격 | 위반 시 |
|---|---|---|
| 초대(추가) `POST /rooms/{id}/participants` | 그 방의 **활성 참여자 누구나**(GROUP만) | 비참여자 `NOT_ROOM_PARTICIPANT`(403-03) |
| 퇴장 `DELETE /rooms/{id}/participants/me` | 본인 | — |

* 초대는 GROUP 방에만 허용한다. DIRECT 방에 참여자를 추가하는 요청은 `CHAT_INVALID_PARTICIPANTS`(400-03)로 거절(1:1의 의미 보존).
* 초대 시 이미 활성 참여자면 no-op(멱등). 과거 퇴장자(`leftAt` 존재)를 다시 초대하면 `rejoin()`.
* 방장 권한·강제 퇴장(kick)은 두지 않는다(CONSTITUTION §2 평평한 모델).

---

## 5. 메시지 전송 & 읽음 규칙 (확정)

### 5.1 전송 (WebSocket)

* 클라가 `/app/rooms/{roomId}/send`로 `{content}` 전송 → 인터셉터가 활성 참여자 인가 → 서비스가 `ChatMessage` 영속화 → `SimpMessagingTemplate`로 `/topic/rooms/{roomId}`에 `ChatMessageResponse` 브로드캐스트.
* 영속화가 먼저, 브로드캐스트가 나중(저장 실패 시 방송 안 함). 발신자 표시정보는 응답 조립 시 MEMBER 협력으로 채운다.

### 5.2 이력 (REST)

* `GET /rooms/{id}/messages?cursor=&size=` — **커서 페이징**(최신→과거). `cursor`(마지막으로 받은 messageId) 미만을 `id DESC`로 조회, 응답에 `nextCursor` 포함. FEED 타임라인 커서 방식 재사용.
* size 기본 20 / 최대 50(초과 clamp). 활성 참여자만 조회 가능(아니면 403-03).

### 5.3 읽음 처리 & 안 읽은 수

* `POST /rooms/{id}/read` body `{lastReadMessageId}` — 참여자의 `lastReadMessageId`를 **더 큰 값으로만 전진**시킨다(뒤로 안 감).
* 안 읽은 수 = 그 방에서 `id > lastReadMessageId AND senderId != me`인 메시지 수(본인 메시지는 세지 않음). `lastReadMessageId == null`이면 상대 메시지 전체.
* 방 목록 응답의 방별 안 읽은 수는 페이지 방 묶음에 대해 **배치 집계**(방별 그룹 카운트 1회)로 계산해 방마다 쿼리하는 N+1을 피한다.

---

## 6. 표시 협력 (확정)

* 방·참여자·메시지는 `createdBy`/`memberId`/`senderId`(원시 Long)만 저장한다. 표시정보(닉네임·인증뱃지)는 **MEMBER 서비스 배치 조회**로 파생한다.
  * `MemberQueryService.findDisplaysByIds(Set<Long>) → Map<Long, MemberDisplay>`를 재사용한다(`MemberDisplay{memberId, nickname, verified}`).
  * 방 목록·메시지 이력·참여자 목록 응답은 등장하는 memberId를 한 번에 조회해 N+1을 피한다.
* DIRECT 방의 표시 이름은 저장하지 않고 **요청자 관점에서 상대 참여자의 닉네임**으로 파생한다. 그룹 방은 `title` 사용(없으면 참여자 닉네임 요약은 FE 몫, 범위 밖).
* fetch join을 쓰지 않는 이유: 도메인 경계상 CHAT 엔티티에 `Member` 연관 매핑이 없다(원시 Long). 표시정보는 서비스 협력 + IN 배치 조회로 조립한다.

---

## 7. 페이징 & 목록 규칙 (확정)

* 방 목록(`GET /rooms`): Spring `Pageable`(오프셋). size 기본 20 / 최대 50, `page<0`이면 0. 요청자의 **활성 참여 방**만, 마지막 메시지 시각 최신순.
* 메시지 이력(`GET /rooms/{id}/messages`): 커서 페이징(§5.2).
* `now`/집계 기준은 서비스에서 계산한다.

---

## 8. API (REST)

모두 인증 필요(principal = memberId). 경로 접두사 `/api/chat`.

* `POST /rooms` : 방 생성. body `{type, participantIds[], title?}`. DIRECT는 find-or-create. → `ChatRoomResponse`.
* `GET /rooms?page=&size=` : 내 활성 참여 방 목록(마지막 메시지·안 읽은 수 포함). → `Page<ChatRoomSummaryResponse>`.
* `GET /rooms/{id}` : 방 상세(참여자 표시정보 포함). 비참여자 403-03, 없음 404-10. → `ChatRoomDetailResponse`.
* `GET /rooms/{id}/messages?cursor=&size=` : 메시지 이력(커서). → `ChatMessagePageResponse{messages[], nextCursor}`.
* `POST /rooms/{id}/participants` : 그룹방 참여자 초대. body `{memberIds[]}`. → `ChatRoomDetailResponse`.
* `DELETE /rooms/{id}/participants/me` : 방 나가기(soft leave). → 성공.
* `POST /rooms/{id}/read` : 읽음 커서 갱신. body `{lastReadMessageId}`. → 성공(또는 갱신된 안 읽은 수).

### 8.1 WebSocket (STOMP)

* SUBSCRIBE `/topic/rooms/{roomId}` — 실시간 수신.
* SEND `/app/rooms/{roomId}/send` body `{content}` — 메시지 전송.
* SEND `/app/rooms/{roomId}/typing` — 입력 중 신호.

### 8.2 응답 DTO

* `ChatRoomResponse`: `id, type, title(파생/nullable), participants[{id,nickname,verified}], createdAt`.
* `ChatRoomSummaryResponse`: `id, type, displayName(파생), lastMessage{content,senderId,createdAt}, unreadCount, updatedAt`.
* `ChatRoomDetailResponse`: `id, type, title, participants[{id,nickname,verified,online}], createdAt`.
* `ChatMessageResponse`: `id, roomId, sender{id,nickname,verified}, content, createdAt`.
* `ChatMessagePageResponse`: `messages[ChatMessageResponse], nextCursor`.
* 참여자·발신자의 `{nickname,verified}`는 `MemberDisplay` 배치 협력 파생. `online`은 `PresenceRegistry` 조회 파생.

---

## 9. 에러 코드 (전역 `ErrorCode`에 추가, 도메인 전용 enum 분리는 계속 보류)

| 코드 | resultCode | HTTP | 사유 |
|---|---|---|---|
| `CHAT_ROOM_NOT_FOUND` | 404-10 | 404 | 방 없음 |
| `CHAT_MESSAGE_NOT_FOUND` | 404-11 | 404 | 메시지 없음(읽음 커서가 없는 메시지 지정 등) |
| `NOT_ROOM_PARTICIPANT` | 403-03 | 403 | 비참여자의 구독/전송/조회/초대 시도 |
| `CHAT_INVALID_PARTICIPANTS` | 400-03 | 400 | 1:1 상대가 1명 아님/자기 자신/DIRECT에 참여자 추가 등 |

* 권한 위반(비참여자)은 `NOT_ROOM_PARTICIPANT`(403-03)로 통일한다. 기존 `FORBIDDEN`(403-01)과 구분해 "그 방의 참여자가 아님"을 명확히 한다.
* Bean Validation 실패(빈 content, content 초과 등)는 기존 `INVALID_INPUT_VALUE`(400-01) 매핑. 참여자 구성 규칙 위반은 의미가 다르므로 `CHAT_INVALID_PARTICIPANTS`(400-03)로 분리한다. (400-02는 기존 `INVALID_FILE`이 점유 중이므로 400-03을 쓴다.)

---

## 10. 테스트 (구현 시)

* **엔티티**: `ChatRoom` DIRECT/GROUP 팩토리(directKey 정규화·자기자신 거절), `ChatParticipant` leave/rejoin/updateLastRead(전진만)/isActive, `ChatMessage` 생성.
* **리포지토리**: `findByDirectKey`(유일성), 활성 참여 방 목록(오프셋 페이징, leftAt 필터), 메시지 커서 조회(id DESC), 안 읽은 수 배치 집계, 방별 참여자 조회.
* **서비스**: DIRECT find-or-create(재요청 시 동일 방·멱등), GROUP 생성/초대(멱등·rejoin)/퇴장(soft leave), 메시지 전송(영속화 후 응답), 이력 커서 조회, 읽음 커서 전진·안 읽은 수 계산, 비참여자 접근 403-03, 표시 협력 파생(닉네임·verified·online).
* **WebSocket 통합**: `@SpringBootTest(webEnvironment = RANDOM_PORT)` + `@ActiveProfiles("test")` + `WebSocketStompClient`로 실제 연결→CONNECT 인증(유효/무효 토큰)→구독 인가(참여자/비참여자)→전송→수신, typing 브로드캐스트, presence connect/disconnect 이벤트.
* **REST 컨트롤러**: 방 생성(DIRECT/GROUP)·목록(안 읽은 수)·상세·이력(커서)·초대·퇴장·읽음 각 성공/실패(403-03/404-10/400-02) 케이스. `@WebMvcTest` 슬라이스에서 WebSocket/`PresenceRegistry`/`StorageProperties` 등 필요한 빈은 목/설정으로 준비.
