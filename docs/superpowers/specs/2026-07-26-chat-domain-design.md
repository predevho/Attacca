# CHAT 도메인 설계 스펙

> 작성일: 2026-07-26. brainstorming 산출물. 정본 규칙은 `DOMAIN-CHAT-CONSTITUTION.md`(원칙) / `DOMAIN-CHAT-STATUTE.md`(구현 규칙). 이 문서는 결정 배경·근거를 담는다.

---

## 1. 목표

Attacca의 마지막 미구현 도메인 CHAT을 **BE 먼저** 구현한다. 1:1(DIRECT)과 그룹(GROUP) 실시간 채팅을 하나의 방 모델로 통합하고, 메시지 전송/수신/이력/방목록 + 읽음(안 읽은 수) + 접속 상태(presence) + 입력 중(typing)까지 다룬다. FE 화면은 다음 이터레이션.

CHAT은 지금까지 도메인(REST 요청-응답)과 달리 **서버가 클라이언트에 먼저 push**해야 하므로 WebSocket(STOMP)이라는 새 전송 계층이 들어온다.

---

## 2. 확정된 설계 결정 (brainstorming)

| # | 결정 | 선택 | 근거 |
|---|---|---|---|
| 1 | 채팅 범위 | **1:1 + 그룹 통합** | "방+참여자" 한 모델로 1:1을 참여자 2명 특수 케이스로 흡수 → 중복 로직 없음 |
| 2 | 메시지 브로커 | **인메모리 Simple Broker** | 단일 서버로 기능 전체 완성·테스트 가능. Redis는 scale-out 시 설정 교체로 도입(로직 불변). 메시지 영속화는 브로커와 별개 |
| 3 | WebSocket 인증 | **STOMP CONNECT 프레임 + JWT** | 기존 REST Bearer JWT와 동일 개념·`JwtProvider` 재사용, 플랫폼 무관(모바일 재사용). BFF·쿠키 결합은 FE 이터레이션 관심사 |
| 4 | 부가 기능 | **읽음/안읽은수 + presence + typing 전부** | 학습·완성도 목적. presence는 인메모리·단일 서버 한계 명시 |
| 5 | 그룹 참여자 관리 | **평평한 모델** | 방장 권한 계층 없음. 활성 참여자 누구나 초대, 본인은 leave. FEED 평면 댓글과 같은 단순화 |
| 6 | 1:1 중복 방지 | **`directKey` 정렬 키 + unique 제약 + find-or-create** | 아래 §3 |

---

## 3. 핵심 트릭: `directKey`로 1:1 방 유일성

**문제**: 1:1 방은 두 회원당 하나여야 하는데, 순진한 생성 API는 A→B, B→A, A→B 반복마다 방을 새로 만들어 대화가 흩어진다.

**해결**: 두 memberId를 **정렬**해 결정적 키를 만든다.
```
directKey = min(a, b) + ":" + max(a, b)
```
- A(3)→B(7): `"3:7"`, B(7)→A(3): `"3:7"` → 누가 걸든 **같은 키**(unordered pair 정규화).

**두 겹 방어**:
1. 애플리케이션 — `findByDirectKey` 후 없으면 생성(find-or-create).
2. DB — `directKey` **unique 제약**. 동시 요청 경합(둘 다 "없음" 판정 후 각자 insert)에서 두 번째 insert가 unique 위반 → 예외를 잡고 기존 방 재조회·반환(멱등). FEED 좋아요(`saveAndFlush`+catch)·RECRUITMENT 지원 유일성과 같은 패턴.

**GROUP**: `directKey = null`. 같은 구성으로 여러 방이 정상이며, 표준 SQL은 null을 unique 위반으로 치지 않아 공존한다.

---

## 4. 아키텍처

### 4.1 계층/패키지
- `com.back.domain.chat`(controller/service/repository/entity/dto) — REST + STOMP `@MessageMapping`.
- `com.back.global.websocket`(WebSocketConfig, StompAuthChannelInterceptor, PresenceRegistry/InMemoryPresenceRegistry) — 전역 인프라(보안과 같은 위치 정책).

### 4.2 REST vs WebSocket 역할 분담
- **WebSocket(STOMP)** = 지금 일어나는 일: 실시간 메시지 송수신, typing, presence.
- **REST** = 상태·이력: 방 목록/상세, 지난 메시지(커서), 읽음 처리, 참여자 초대/퇴장.

### 4.3 STOMP 목적지
```
SUBSCRIBE /topic/rooms/{roomId}          방의 실시간 메시지·typing·presence 수신
SEND      /app/rooms/{roomId}/send       {content} → 영속화 → /topic/rooms/{roomId} 브로드캐스트
SEND      /app/rooms/{roomId}/typing     저장 안 함 → /topic/rooms/{roomId} 브로드캐스트
```
- 엔드포인트 `/ws`, app prefix `/app`, broker `/topic`,`/user`(인메모리 Simple Broker).

### 4.4 인증/인가 (`StompAuthChannelInterceptor`)
- CONNECT: `Authorization: Bearer <access>` → `JwtProvider` 검증 → Principal(memberId). 실패 시 연결 거절.
- SUBSCRIBE/SEND `/…/rooms/{roomId}`: 그 방의 **활성 참여자**(leftAt null)만 허용, 아니면 STOMP ERROR(`NOT_ROOM_PARTICIPANT` 403-03).

### 4.5 presence (`PresenceRegistry`)
- `SessionConnectedEvent`/`SessionDisconnectEvent` 리스닝 → 온라인 memberId 집합 갱신 → 활성 참여 방 topic에 `{memberId, online}` 브로드캐스트.
- 회원당 다중 연결(탭/기기)은 **연결 수 카운팅**으로 판정(마지막 연결 종료 시 offline).
- 한계: 인메모리·단일 서버만 정확. 다중 서버는 Redis 구현으로 교체.

---

## 5. 데이터 모델 (엔티티 3종)

- **ChatRoom**: `id, type(DIRECT/GROUP), title(nullable), createdBy, directKey(unique, DIRECT만)`.
- **ChatParticipant**: `id, roomId, memberId, leftAt(soft leave), lastReadMessageId(읽음 커서)`. `(roomId,memberId)` unique. 재입장=rejoin(행 재사용).
- **ChatMessage**(append-only): `id, roomId, senderId, content(≤2000)`. 정렬·읽음 판정은 `id` 기준.

표시정보(닉네임·verified)는 `MemberQueryService.findDisplaysByIds` 배치 협력으로 파생(N+1 없음). CHAT 엔티티에 `Member` 연관 매핑 없음(원시 Long).

---

## 6. 읽음 & 안 읽은 수
- `POST /rooms/{id}/read {lastReadMessageId}` — 커서를 더 큰 값으로만 전진.
- 안 읽은 수 = `id > lastReadMessageId AND senderId != me`(본인 메시지 제외). 방 목록은 방별 그룹 카운트 1회로 배치 집계(N+1 회피).

---

## 7. 에러 코드 (전역 `ErrorCode` 시퀀스 이어서)
| 코드 | resultCode | HTTP |
|---|---|---|
| `CHAT_ROOM_NOT_FOUND` | 404-10 | 404 |
| `CHAT_MESSAGE_NOT_FOUND` | 404-11 | 404 |
| `NOT_ROOM_PARTICIPANT` | 403-03 | 403 |
| `CHAT_INVALID_PARTICIPANTS` | 400-03 | 400 |

---

## 8. 테스트 전략
- 엔티티/서비스/리포지토리: 기존처럼 TDD 단위 테스트.
- REST 컨트롤러: `@WebMvcTest` 슬라이스.
- **WebSocket 통합**: `@SpringBootTest(RANDOM_PORT)` + `@ActiveProfiles("test")` + `WebSocketStompClient`로 실제 연결→인증→구독 인가→송수신→typing→presence 검증. (REST의 MockMvc로는 STOMP를 못 다루므로 실제 연결 필요 — 이번 도메인의 새 테스트 기법.)

---

## 9. 범위 밖 (요약)
메시지 수정·삭제, 파일 첨부, 메시지 검색, 알림 푸시, 다중 서버 정확 presence/릴레이(Redis), 방장 권한·kick, 타 도메인(RECRUITMENT/PERFORMANCE) 채팅 연계, refresh 토큰 로테이션. 상세는 CONSTITUTION §5.

---

## 10. 구현 순서(예정, writing-plans에서 상세화)
1. WebSocket 인프라(WebSocketConfig, 인증 인터셉터) + CONNECT 인증 통합 테스트.
2. 엔티티 3종 + 리포지토리(directKey 유일성·커서·배치 집계).
3. 방 생성/목록/상세/초대/퇴장 서비스·REST.
4. 메시지 전송(STOMP)·이력(REST) + 표시 협력.
5. 읽음/안 읽은 수.
6. presence + typing 브로드캐스트 + WebSocket 통합 테스트.
7. 에러코드·전역 회귀·최종 리뷰.
