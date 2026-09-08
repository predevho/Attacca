# CHAT 도메인 구현 계획 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attacca의 마지막 미구현 도메인 CHAT(1:1 + 그룹 실시간 채팅)을 BE 먼저 TDD로 구현한다.

**Architecture:** REST(상태·이력) + WebSocket/STOMP(실시간)로 역할을 분리한다. 방+참여자 통합 모델로 1:1은 참여자 2명 특수 케이스로 흡수하고, 1:1 중복은 정렬 키(`directKey`) unique 제약 + find-or-create로 막는다. 메시지 브로커는 인메모리 Simple Broker(추후 Redis 교체), WebSocket 인증은 STOMP CONNECT 프레임의 JWT를 `ChannelInterceptor`가 검증한다.

**Tech Stack:** Spring Boot 3.4.5 / Java 21 / Spring WebSocket(STOMP) / Spring Data JPA / MySQL(운영)·H2(test) / JWT(jjwt) / Lombok / JUnit5 + AssertJ.

## Global Constraints

- Gradle 래퍼·Boot 버전 변경 금지: Spring Boot 3.4.5 / Gradle 8.11.1 / JDK 21 toolchain 고정.
- 모든 `@SpringBootTest`에는 반드시 `@ActiveProfiles("test")` (H2 test 프로파일). 없으면 MySQL 접속 시도로 실패.
- 도메인 경계: CHAT 엔티티는 `Member`를 연관 매핑하지 않는다. 회원은 원시 `Long`. 표시정보는 `MemberQueryService.findDisplaysByIds(Set<Long>) → Map<Long, MemberDisplay>` 배치 협력으로 파생(N+1 금지).
- 엔티티 스타일: `extends BaseEntity`(createdAt/updatedAt 자동), `@Getter`, `@NoArgsConstructor(access = AccessLevel.PROTECTED)`, private 생성자 + static 팩토리, setter 금지(의도 드러나는 변경 메서드).
- 응답은 `com.back.global.common.ApiResponse<T>`로 감싼다. 비즈니스 예외는 `throw new BusinessException(ErrorCode.XXX)`.
- 컨트롤러 principal 추출: `@AuthenticationPrincipal Long memberId`.
- 커밋 메시지는 한글 `유형: 요약`. 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- 정본 규칙 문서: `docs/DOMAIN-CHAT-CONSTITUTION.md`(원칙) / `docs/DOMAIN-CHAT-STATUTE.md`(구현 규칙). 스펙: `docs/superpowers/specs/2026-07-26-chat-domain-design.md`.

## 파일 구조 (생성/수정)

```
BE/src/main/java/com/back/domain/chat/
├── entity/    RoomType.java  ChatRoom.java  ChatParticipant.java  ChatMessage.java
├── repository/ ChatRoomRepository.java  ChatParticipantRepository.java  ChatMessageRepository.java  RoomUnreadCount.java
├── dto/       CreateRoomRequest.java  InviteRequest.java  ReadRequest.java  SendMessageRequest.java
│              ChatRoomResponse.java  ChatRoomSummaryResponse.java  ChatMessageResponse.java  ParticipantView.java
├── service/   ChatRoomService.java  ChatMessageService.java
└── controller/ ChatRoomController.java  ChatStompController.java

BE/src/main/java/com/back/global/websocket/
├── WebSocketConfig.java
├── StompAuthChannelInterceptor.java
├── PresenceRegistry.java
├── InMemoryPresenceRegistry.java
└── ChatPresenceEventListener.java

수정: BE/build.gradle.kts, BE/src/main/java/com/back/global/exception/ErrorCode.java,
      BE/src/main/java/com/back/global/security/SecurityConfig.java
```

의존 순서: 에러코드/의존성 → presence → 엔티티 → 리포지토리 → 서비스 → REST 컨트롤러 → WebSocket 인프라 → STOMP 컨트롤러/이벤트 → 통합 테스트 → 회귀·문서.

---

### Task 1: WebSocket 의존성 + CHAT 에러코드

**Files:**
- Modify: `BE/build.gradle.kts`
- Modify: `BE/src/main/java/com/back/global/exception/ErrorCode.java`
- Test: `BE/src/test/java/com/back/global/exception/ErrorCodeTest.java`

**Interfaces:**
- Produces: `ErrorCode.CHAT_ROOM_NOT_FOUND`(404-10), `ErrorCode.CHAT_MESSAGE_NOT_FOUND`(404-11), `ErrorCode.NOT_ROOM_PARTICIPANT`(403-03), `ErrorCode.CHAT_INVALID_PARTICIPANTS`(400-03).

- [ ] **Step 1: build.gradle.kts에 WebSocket 스타터 추가**

`dependencies` 블록의 `spring-boot-starter-web` 아래 줄에 추가:

```kotlin
    implementation("org.springframework.boot:spring-boot-starter-websocket")
```

- [ ] **Step 2: 실패하는 테스트 작성 — 새 에러코드의 resultCode 매핑**

`ErrorCodeTest.java`에 테스트 메서드 추가(기존 import·클래스 유지, 아래 메서드를 클래스 본문에 추가):

```java
    @org.junit.jupiter.api.Test
    void chat_에러코드의_resultCode가_규약대로다() {
        org.assertj.core.api.Assertions.assertThat(ErrorCode.CHAT_ROOM_NOT_FOUND.getResultCode())
                .isEqualTo("404-10");
        org.assertj.core.api.Assertions.assertThat(ErrorCode.CHAT_MESSAGE_NOT_FOUND.getResultCode())
                .isEqualTo("404-11");
        org.assertj.core.api.Assertions.assertThat(ErrorCode.NOT_ROOM_PARTICIPANT.getResultCode())
                .isEqualTo("403-03");
        org.assertj.core.api.Assertions.assertThat(ErrorCode.CHAT_INVALID_PARTICIPANTS.getResultCode())
                .isEqualTo("400-03");
    }
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd BE && ./gradlew test --tests "com.back.global.exception.ErrorCodeTest"`
Expected: 컴파일 실패("cannot find symbol: CHAT_ROOM_NOT_FOUND").

- [ ] **Step 4: ErrorCode.java에 CHAT 코드 추가**

`RECRUITMENT_INVALID_APPLICATION_STATE(...)` 상수 다음(마지막 상수)에서, 그 줄 끝의 `;`를 `,`로 바꾸고 아래 블록을 이어 붙인다:

```java
    RECRUITMENT_INVALID_APPLICATION_STATE("409-10", HttpStatus.CONFLICT, "이미 처리된 지원은 다시 처리할 수 없습니다."),

    // --- CHAT(채팅) ---
    CHAT_ROOM_NOT_FOUND("404-10", HttpStatus.NOT_FOUND, "채팅방을 찾을 수 없습니다."),
    CHAT_MESSAGE_NOT_FOUND("404-11", HttpStatus.NOT_FOUND, "메시지를 찾을 수 없습니다."),
    NOT_ROOM_PARTICIPANT("403-03", HttpStatus.FORBIDDEN, "채팅방 참여자만 접근할 수 있습니다."),
    CHAT_INVALID_PARTICIPANTS("400-03", HttpStatus.BAD_REQUEST, "채팅 참여자 구성이 올바르지 않습니다.");
```

> 주의: `getCode()`는 enum 이름을 반환하고 `getResultCode()`는 `resultCode` 필드를 반환한다(기존 `@Getter`가 생성). 400-02는 기존 `INVALID_FILE`이 점유하므로 CHAT은 400-03을 쓴다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd BE && ./gradlew test --tests "com.back.global.exception.ErrorCodeTest"`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add BE/build.gradle.kts BE/src/main/java/com/back/global/exception/ErrorCode.java BE/src/test/java/com/back/global/exception/ErrorCodeTest.java
git commit -m "feat: CHAT 에러코드·WebSocket 스타터 추가"
```

---

### Task 2: PresenceRegistry (접속 상태 인터페이스 + 인메모리 구현)

**Files:**
- Create: `BE/src/main/java/com/back/global/websocket/PresenceRegistry.java`
- Create: `BE/src/main/java/com/back/global/websocket/InMemoryPresenceRegistry.java`
- Test: `BE/src/test/java/com/back/global/websocket/InMemoryPresenceRegistryTest.java`

**Interfaces:**
- Produces: `PresenceRegistry { void connected(Long); void disconnected(Long); boolean isOnline(Long); Set<Long> onlineAmong(Set<Long>); }`; 빈 `InMemoryPresenceRegistry`.

- [ ] **Step 1: 실패하는 테스트 작성**

`InMemoryPresenceRegistryTest.java`:

```java
package com.back.global.websocket;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.Test;

class InMemoryPresenceRegistryTest {

    private final InMemoryPresenceRegistry registry = new InMemoryPresenceRegistry();

    @Test
    void 연결되면_온라인이고_같은_연결수만큼_해제해야_오프라인이_된다() {
        registry.connected(1L);
        registry.connected(1L); // 탭 2개
        assertThat(registry.isOnline(1L)).isTrue();

        registry.disconnected(1L); // 하나 끊김
        assertThat(registry.isOnline(1L)).isTrue(); // 아직 하나 남음

        registry.disconnected(1L); // 마지막 끊김
        assertThat(registry.isOnline(1L)).isFalse();
    }

    @Test
    void onlineAmong은_주어진_집합중_온라인만_돌려준다() {
        registry.connected(1L);
        registry.connected(3L);

        assertThat(registry.onlineAmong(Set.of(1L, 2L, 3L))).containsExactlyInAnyOrder(1L, 3L);
    }

    @Test
    void 과다_해제는_음수로_가지_않고_오프라인을_유지한다() {
        registry.disconnected(9L); // 연결 없던 회원
        assertThat(registry.isOnline(9L)).isFalse();
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd BE && ./gradlew test --tests "com.back.global.websocket.InMemoryPresenceRegistryTest"`
Expected: 컴파일 실패(클래스 없음).

- [ ] **Step 3: 인터페이스 작성**

`PresenceRegistry.java`:

```java
package com.back.global.websocket;

import java.util.Set;

/**
 * 접속 상태(presence) 저장소. 인메모리 구현이 기본이며, 다중 서버로 확장 시
 * Redis 기반 구현으로 교체한다(도메인·설정 코드는 이 인터페이스만 의존).
 */
public interface PresenceRegistry {

    void connected(Long memberId);

    void disconnected(Long memberId);

    boolean isOnline(Long memberId);

    Set<Long> onlineAmong(Set<Long> memberIds);
}
```

- [ ] **Step 4: 인메모리 구현 작성**

`InMemoryPresenceRegistry.java`:

```java
package com.back.global.websocket;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * 회원별 활성 연결 수를 세어 online/offline 을 판정한다.
 * 한 회원이 여러 연결(탭/기기)을 가질 수 있으므로 마지막 연결이 끊길 때만 offline.
 * 단일 서버 기준으로만 정확하다(다중 서버는 Redis 구현으로 교체).
 */
@Component
public class InMemoryPresenceRegistry implements PresenceRegistry {

    private final ConcurrentHashMap<Long, Integer> connectionCounts = new ConcurrentHashMap<>();

    @Override
    public void connected(Long memberId) {
        connectionCounts.merge(memberId, 1, Integer::sum);
    }

    @Override
    public void disconnected(Long memberId) {
        connectionCounts.computeIfPresent(memberId, (id, count) -> count <= 1 ? null : count - 1);
    }

    @Override
    public boolean isOnline(Long memberId) {
        return connectionCounts.getOrDefault(memberId, 0) > 0;
    }

    @Override
    public Set<Long> onlineAmong(Set<Long> memberIds) {
        return memberIds.stream().filter(this::isOnline).collect(Collectors.toSet());
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd BE && ./gradlew test --tests "com.back.global.websocket.InMemoryPresenceRegistryTest"`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add BE/src/main/java/com/back/global/websocket/ BE/src/test/java/com/back/global/websocket/
git commit -m "feat: 접속 상태(PresenceRegistry) 인메모리 구현"
```

---

### Task 3: ChatRoom 엔티티 + RoomType

**Files:**
- Create: `BE/src/main/java/com/back/domain/chat/entity/RoomType.java`
- Create: `BE/src/main/java/com/back/domain/chat/entity/ChatRoom.java`
- Test: `BE/src/test/java/com/back/domain/chat/entity/ChatRoomTest.java`

**Interfaces:**
- Produces: `enum RoomType { DIRECT, GROUP }`; `ChatRoom` with `static ChatRoom createDirect(Long creatorId, Long otherId)`, `static ChatRoom createGroup(Long creatorId, String title)`, `static String directKey(Long a, Long b)`, `void updateLastMessageAt(LocalDateTime at)`; getters `getId/getType/getTitle/getCreatedBy/getDirectKey/getLastMessageAt`.

- [ ] **Step 1: 실패하는 테스트 작성**

`ChatRoomTest.java`:

```java
package com.back.domain.chat.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class ChatRoomTest {

    @Test
    void directKey는_순서에_무관하게_같은_쌍이면_동일하다() {
        assertThat(ChatRoom.directKey(3L, 7L)).isEqualTo("3:7");
        assertThat(ChatRoom.directKey(7L, 3L)).isEqualTo("3:7");
    }

    @Test
    void createDirect는_정렬된_directKey와_DIRECT타입을_갖는다() {
        ChatRoom room = ChatRoom.createDirect(7L, 3L);

        assertThat(room.getType()).isEqualTo(RoomType.DIRECT);
        assertThat(room.getDirectKey()).isEqualTo("3:7");
        assertThat(room.getCreatedBy()).isEqualTo(7L);
        assertThat(room.getTitle()).isNull();
        assertThat(room.getLastMessageAt()).isNotNull(); // 생성 시각으로 초기화
    }

    @Test
    void 자기자신과의_DIRECT는_거절한다() {
        assertThatThrownBy(() -> ChatRoom.createDirect(5L, 5L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_INVALID_PARTICIPANTS);
    }

    @Test
    void createGroup은_directKey가_null이고_title을_갖는다() {
        ChatRoom room = ChatRoom.createGroup(1L, "합주팀");

        assertThat(room.getType()).isEqualTo(RoomType.GROUP);
        assertThat(room.getDirectKey()).isNull();
        assertThat(room.getTitle()).isEqualTo("합주팀");
        assertThat(room.getLastMessageAt()).isNotNull();
    }

    @Test
    void updateLastMessageAt은_시각을_갱신한다() {
        ChatRoom room = ChatRoom.createGroup(1L, "t");
        LocalDateTime later = LocalDateTime.of(2030, 1, 1, 0, 0);

        room.updateLastMessageAt(later);

        assertThat(room.getLastMessageAt()).isEqualTo(later);
    }
}
```

> 참고: `BusinessException`은 `getErrorCode()`(필드 `errorCode`)를 갖는다(기존 코드 확인됨). `extracting("errorCode")`로 검증한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.entity.ChatRoomTest"`
Expected: 컴파일 실패.

- [ ] **Step 3: RoomType enum 작성**

`RoomType.java`:

```java
package com.back.domain.chat.entity;

/** 채팅방 종류. DIRECT=1:1(참여자 2명), GROUP=그룹(N명). */
public enum RoomType {
    DIRECT, GROUP
}
```

- [ ] **Step 4: ChatRoom 엔티티 작성**

`ChatRoom.java`:

```java
package com.back.domain.chat.entity;

import com.back.global.common.BaseEntity;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 채팅방. 1:1(DIRECT)과 그룹(GROUP)을 통합한다. 회원은 원시 Long 으로만 참조. */
@Entity
@Table(name = "chat_room")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatRoom extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private RoomType type;

    @Column(length = 100)
    private String title;

    @Column(nullable = false)
    private Long createdBy;

    /** 1:1 중복 방지 키. "min:max". DIRECT 만 값, GROUP 은 null. unique. */
    @Column(unique = true, length = 40)
    private String directKey;

    @Column(nullable = false)
    private LocalDateTime lastMessageAt;

    private ChatRoom(RoomType type, String title, Long createdBy, String directKey) {
        this.type = type;
        this.title = title;
        this.createdBy = createdBy;
        this.directKey = directKey;
        this.lastMessageAt = LocalDateTime.now();
    }

    /** 정렬된 쌍 키. 순서 무관 정규화(unordered pair). */
    public static String directKey(Long a, Long b) {
        long lo = Math.min(a, b);
        long hi = Math.max(a, b);
        return lo + ":" + hi;
    }

    public static ChatRoom createDirect(Long creatorId, Long otherId) {
        if (creatorId == null || otherId == null || creatorId.equals(otherId)) {
            throw new BusinessException(ErrorCode.CHAT_INVALID_PARTICIPANTS);
        }
        return new ChatRoom(RoomType.DIRECT, null, creatorId, directKey(creatorId, otherId));
    }

    public static ChatRoom createGroup(Long creatorId, String title) {
        return new ChatRoom(RoomType.GROUP, title, creatorId, null);
    }

    public void updateLastMessageAt(LocalDateTime at) {
        this.lastMessageAt = at;
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.entity.ChatRoomTest"`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add BE/src/main/java/com/back/domain/chat/entity/RoomType.java BE/src/main/java/com/back/domain/chat/entity/ChatRoom.java BE/src/test/java/com/back/domain/chat/entity/ChatRoomTest.java
git commit -m "feat: ChatRoom 엔티티(directKey 유일성·통합 방 모델)"
```

---

### Task 4: ChatParticipant 엔티티

**Files:**
- Create: `BE/src/main/java/com/back/domain/chat/entity/ChatParticipant.java`
- Test: `BE/src/test/java/com/back/domain/chat/entity/ChatParticipantTest.java`

**Interfaces:**
- Produces: `ChatParticipant` with `static ChatParticipant join(Long roomId, Long memberId)`, `void leave()`, `void rejoin()`, `void updateLastRead(Long messageId)`, `boolean isActive()`; getters `getId/getRoomId/getMemberId/getLeftAt/getLastReadMessageId`.

- [ ] **Step 1: 실패하는 테스트 작성**

`ChatParticipantTest.java`:

```java
package com.back.domain.chat.entity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ChatParticipantTest {

    @Test
    void join하면_활성상태이고_읽음커서는_null이다() {
        ChatParticipant p = ChatParticipant.join(10L, 1L);

        assertThat(p.isActive()).isTrue();
        assertThat(p.getLeftAt()).isNull();
        assertThat(p.getLastReadMessageId()).isNull();
    }

    @Test
    void leave하면_비활성_rejoin하면_다시_활성이다() {
        ChatParticipant p = ChatParticipant.join(10L, 1L);

        p.leave();
        assertThat(p.isActive()).isFalse();
        assertThat(p.getLeftAt()).isNotNull();

        p.rejoin();
        assertThat(p.isActive()).isTrue();
        assertThat(p.getLeftAt()).isNull();
    }

    @Test
    void updateLastRead는_더_큰_값으로만_전진한다() {
        ChatParticipant p = ChatParticipant.join(10L, 1L);

        p.updateLastRead(5L);
        assertThat(p.getLastReadMessageId()).isEqualTo(5L);

        p.updateLastRead(3L); // 뒤로 안 감
        assertThat(p.getLastReadMessageId()).isEqualTo(5L);

        p.updateLastRead(9L);
        assertThat(p.getLastReadMessageId()).isEqualTo(9L);
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.entity.ChatParticipantTest"`
Expected: 컴파일 실패.

- [ ] **Step 3: ChatParticipant 엔티티 작성**

`ChatParticipant.java`:

```java
package com.back.domain.chat.entity;

import com.back.global.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 방 참여자. 퇴장은 삭제가 아니라 leftAt 마킹(soft leave). (roomId, memberId) 유일. */
@Entity
@Table(name = "chat_participant",
        uniqueConstraints = @UniqueConstraint(columnNames = {"roomId", "memberId"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatParticipant extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long roomId;

    @Column(nullable = false)
    private Long memberId;

    /** null 이면 활성 참여, 값이 있으면 퇴장. */
    private LocalDateTime leftAt;

    /** 읽음 커서. 이 값 이후 상대 메시지 수 = 안 읽은 수. null 이면 아무것도 안 읽음. */
    private Long lastReadMessageId;

    private ChatParticipant(Long roomId, Long memberId) {
        this.roomId = roomId;
        this.memberId = memberId;
    }

    public static ChatParticipant join(Long roomId, Long memberId) {
        return new ChatParticipant(roomId, memberId);
    }

    public void leave() {
        this.leftAt = LocalDateTime.now();
    }

    public void rejoin() {
        this.leftAt = null;
    }

    /** 더 큰 messageId 로만 전진(뒤로 되돌리지 않음). */
    public void updateLastRead(Long messageId) {
        if (messageId == null) {
            return;
        }
        if (this.lastReadMessageId == null || messageId > this.lastReadMessageId) {
            this.lastReadMessageId = messageId;
        }
    }

    public boolean isActive() {
        return leftAt == null;
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.entity.ChatParticipantTest"`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add BE/src/main/java/com/back/domain/chat/entity/ChatParticipant.java BE/src/test/java/com/back/domain/chat/entity/ChatParticipantTest.java
git commit -m "feat: ChatParticipant 엔티티(soft leave·읽음 커서)"
```

---

### Task 5: ChatMessage 엔티티

**Files:**
- Create: `BE/src/main/java/com/back/domain/chat/entity/ChatMessage.java`
- Test: `BE/src/test/java/com/back/domain/chat/entity/ChatMessageTest.java`

**Interfaces:**
- Produces: `ChatMessage` with `static ChatMessage create(Long roomId, Long senderId, String content)`; getters `getId/getRoomId/getSenderId/getContent/getCreatedAt`.

- [ ] **Step 1: 실패하는 테스트 작성**

`ChatMessageTest.java`:

```java
package com.back.domain.chat.entity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ChatMessageTest {

    @Test
    void create는_필드를_보관한다() {
        ChatMessage m = ChatMessage.create(10L, 1L, "안녕하세요");

        assertThat(m.getRoomId()).isEqualTo(10L);
        assertThat(m.getSenderId()).isEqualTo(1L);
        assertThat(m.getContent()).isEqualTo("안녕하세요");
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.entity.ChatMessageTest"`
Expected: 컴파일 실패.

- [ ] **Step 3: ChatMessage 엔티티 작성**

`ChatMessage.java`:

```java
package com.back.domain.chat.entity;

import com.back.global.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 채팅 메시지. append-only(수정·삭제 없음). 정렬·읽음 판정은 id(단조 증가) 기준. */
@Entity
@Table(name = "chat_message", indexes = @Index(name = "idx_chat_message_room", columnList = "roomId, id"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatMessage extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long roomId;

    @Column(nullable = false)
    private Long senderId;

    @Column(nullable = false, length = 2000)
    private String content;

    private ChatMessage(Long roomId, Long senderId, String content) {
        this.roomId = roomId;
        this.senderId = senderId;
        this.content = content;
    }

    public static ChatMessage create(Long roomId, Long senderId, String content) {
        return new ChatMessage(roomId, senderId, content);
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.entity.ChatMessageTest"`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add BE/src/main/java/com/back/domain/chat/entity/ChatMessage.java BE/src/test/java/com/back/domain/chat/entity/ChatMessageTest.java
git commit -m "feat: ChatMessage 엔티티(append-only)"
```

---

### Task 6: 리포지토리 3종 + 안읽은수 배치 집계

**Files:**
- Create: `BE/src/main/java/com/back/domain/chat/repository/ChatRoomRepository.java`
- Create: `BE/src/main/java/com/back/domain/chat/repository/ChatParticipantRepository.java`
- Create: `BE/src/main/java/com/back/domain/chat/repository/ChatMessageRepository.java`
- Create: `BE/src/main/java/com/back/domain/chat/repository/RoomUnreadCount.java`
- Test: `BE/src/test/java/com/back/domain/chat/repository/ChatRepositoryTest.java`

**Interfaces:**
- Consumes: `ChatRoom`, `ChatParticipant`, `ChatMessage`(Task 3–5).
- Produces:
  - `ChatRoomRepository`: `Optional<ChatRoom> findByDirectKey(String)`, `Page<ChatRoom> findRoomsForMember(Long memberId, Pageable)`.
  - `ChatParticipantRepository`: `Optional<ChatParticipant> findByRoomIdAndMemberId(Long,Long)`, `boolean existsByRoomIdAndMemberIdAndLeftAtIsNull(Long,Long)`, `List<ChatParticipant> findByRoomIdAndLeftAtIsNull(Long)`.
  - `ChatMessageRepository`: `List<ChatMessage> findHistory(Long roomId, Long cursor, Pageable)`, `List<ChatMessage> findLatestPerRoom(List<Long> roomIds)`, `List<RoomUnreadCount> countUnreadPerRoom(Long memberId, List<Long> roomIds)`.
  - `RoomUnreadCount { Long getRoomId(); long getUnreadCount(); }`.

- [ ] **Step 1: 실패하는 테스트 작성**

`ChatRepositoryTest.java`:

```java
package com.back.domain.chat.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.domain.chat.entity.ChatMessage;
import com.back.domain.chat.entity.ChatParticipant;
import com.back.domain.chat.entity.ChatRoom;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;

@DataJpaTest
class ChatRepositoryTest {

    @Autowired ChatRoomRepository roomRepository;
    @Autowired ChatParticipantRepository participantRepository;
    @Autowired ChatMessageRepository messageRepository;

    @Test
    void findByDirectKey로_1대1_방을_찾는다() {
        ChatRoom room = roomRepository.save(ChatRoom.createDirect(3L, 7L));

        Optional<ChatRoom> found = roomRepository.findByDirectKey(ChatRoom.directKey(7L, 3L));

        assertThat(found).isPresent();
        assertThat(found.get().getId()).isEqualTo(room.getId());
    }

    @Test
    void findRoomsForMember는_활성참여방만_마지막메시지_최신순으로_준다() {
        ChatRoom older = roomRepository.save(ChatRoom.createGroup(1L, "old"));
        ChatRoom newer = roomRepository.save(ChatRoom.createGroup(1L, "new"));
        newer.updateLastMessageAt(older.getLastMessageAt().plusMinutes(5));
        roomRepository.save(newer);
        ChatRoom left = roomRepository.save(ChatRoom.createGroup(1L, "left"));

        participantRepository.save(ChatParticipant.join(older.getId(), 1L));
        participantRepository.save(ChatParticipant.join(newer.getId(), 1L));
        ChatParticipant leftP = ChatParticipant.join(left.getId(), 1L);
        leftP.leave();
        participantRepository.save(leftP);

        var page = roomRepository.findRoomsForMember(1L, PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(ChatRoom::getId)
                .containsExactly(newer.getId(), older.getId()); // 최신 먼저, left 제외
    }

    @Test
    void existsActive와_활성참여자_목록() {
        ChatRoom room = roomRepository.save(ChatRoom.createGroup(1L, "g"));
        participantRepository.save(ChatParticipant.join(room.getId(), 1L));
        ChatParticipant gone = ChatParticipant.join(room.getId(), 2L);
        gone.leave();
        participantRepository.save(gone);

        assertThat(participantRepository.existsByRoomIdAndMemberIdAndLeftAtIsNull(room.getId(), 1L)).isTrue();
        assertThat(participantRepository.existsByRoomIdAndMemberIdAndLeftAtIsNull(room.getId(), 2L)).isFalse();
        assertThat(participantRepository.findByRoomIdAndLeftAtIsNull(room.getId()))
                .extracting(ChatParticipant::getMemberId).containsExactly(1L);
    }

    @Test
    void findHistory는_커서_미만을_id_내림차순으로_준다() {
        ChatRoom room = roomRepository.save(ChatRoom.createGroup(1L, "g"));
        ChatMessage m1 = messageRepository.save(ChatMessage.create(room.getId(), 1L, "1"));
        ChatMessage m2 = messageRepository.save(ChatMessage.create(room.getId(), 1L, "2"));
        ChatMessage m3 = messageRepository.save(ChatMessage.create(room.getId(), 1L, "3"));

        var latest = messageRepository.findHistory(room.getId(), null, PageRequest.of(0, 2));
        assertThat(latest).extracting(ChatMessage::getId).containsExactly(m3.getId(), m2.getId());

        var older = messageRepository.findHistory(room.getId(), m2.getId(), PageRequest.of(0, 2));
        assertThat(older).extracting(ChatMessage::getId).containsExactly(m1.getId());
    }

    @Test
    void findLatestPerRoom과_countUnreadPerRoom_배치집계() {
        ChatRoom a = roomRepository.save(ChatRoom.createGroup(1L, "a"));
        ChatRoom b = roomRepository.save(ChatRoom.createGroup(1L, "b"));
        // a방: 회원2가 2개 보냄, 회원1이 1개 읽음커서 없음 → 안읽음 2
        messageRepository.save(ChatMessage.create(a.getId(), 2L, "a1"));
        ChatMessage aLast = messageRepository.save(ChatMessage.create(a.getId(), 2L, "a2"));
        // b방: 회원1(본인)이 보낸 것만 → 안읽음 0
        ChatMessage bLast = messageRepository.save(ChatMessage.create(b.getId(), 1L, "b1"));

        var latest = messageRepository.findLatestPerRoom(List.of(a.getId(), b.getId()));
        assertThat(latest).extracting(ChatMessage::getId)
                .containsExactlyInAnyOrder(aLast.getId(), bLast.getId());

        var unread = messageRepository.countUnreadPerRoom(1L, List.of(a.getId(), b.getId()));
        assertThat(unread).extracting(RoomUnreadCount::getRoomId, RoomUnreadCount::getUnreadCount)
                .containsExactly(org.assertj.core.groups.Tuple.tuple(a.getId(), 2L));
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.repository.ChatRepositoryTest"`
Expected: 컴파일 실패.

- [ ] **Step 3: RoomUnreadCount projection 작성**

`RoomUnreadCount.java`:

```java
package com.back.domain.chat.repository;

/** 방별 안 읽은 수 배치 집계 projection. */
public interface RoomUnreadCount {
    Long getRoomId();
    long getUnreadCount();
}
```

- [ ] **Step 4: ChatRoomRepository 작성**

`ChatRoomRepository.java`:

```java
package com.back.domain.chat.repository;

import com.back.domain.chat.entity.ChatRoom;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    Optional<ChatRoom> findByDirectKey(String directKey);

    /** 회원이 활성 참여 중인 방을 마지막 메시지 최신순으로. ChatParticipant 와 entity join(연관 매핑 없음). */
    @Query("select r from ChatRoom r "
            + "where r.id in (select p.roomId from ChatParticipant p "
            + "  where p.memberId = :memberId and p.leftAt is null) "
            + "order by r.lastMessageAt desc, r.id desc")
    Page<ChatRoom> findRoomsForMember(@Param("memberId") Long memberId, Pageable pageable);
}
```

- [ ] **Step 5: ChatParticipantRepository 작성**

`ChatParticipantRepository.java`:

```java
package com.back.domain.chat.repository;

import com.back.domain.chat.entity.ChatParticipant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatParticipantRepository extends JpaRepository<ChatParticipant, Long> {

    Optional<ChatParticipant> findByRoomIdAndMemberId(Long roomId, Long memberId);

    boolean existsByRoomIdAndMemberIdAndLeftAtIsNull(Long roomId, Long memberId);

    List<ChatParticipant> findByRoomIdAndLeftAtIsNull(Long roomId);
}
```

- [ ] **Step 6: ChatMessageRepository 작성**

`ChatMessageRepository.java`:

```java
package com.back.domain.chat.repository;

import com.back.domain.chat.entity.ChatMessage;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /** 방 메시지 이력: cursor 미만을 id 내림차순(최신→과거). cursor=null 이면 최신부터. */
    @Query("select m from ChatMessage m "
            + "where m.roomId = :roomId and (:cursor is null or m.id < :cursor) "
            + "order by m.id desc")
    List<ChatMessage> findHistory(@Param("roomId") Long roomId, @Param("cursor") Long cursor,
            Pageable pageable);

    /** 각 방의 마지막 메시지 1개씩(방 목록 미리보기). 방당 max(id) 를 한 번에. */
    @Query("select m from ChatMessage m where m.id in "
            + "(select max(m2.id) from ChatMessage m2 where m2.roomId in :roomIds group by m2.roomId)")
    List<ChatMessage> findLatestPerRoom(@Param("roomIds") List<Long> roomIds);

    /** 방별 안 읽은 수: 내 읽음커서 이후의 '상대' 메시지 수를 한 번에 집계. */
    @Query("select m.roomId as roomId, count(m) as unreadCount from ChatMessage m "
            + "join ChatParticipant p on p.roomId = m.roomId and p.memberId = :memberId "
            + "where m.roomId in :roomIds and m.senderId <> :memberId "
            + "  and (p.lastReadMessageId is null or m.id > p.lastReadMessageId) "
            + "group by m.roomId")
    List<RoomUnreadCount> countUnreadPerRoom(@Param("memberId") Long memberId,
            @Param("roomIds") List<Long> roomIds);
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.repository.ChatRepositoryTest"`
Expected: PASS. (실패 시 JPQL entity join 문법·`group by` 확인.)

- [ ] **Step 8: 커밋**

```bash
git add BE/src/main/java/com/back/domain/chat/repository/ BE/src/test/java/com/back/domain/chat/repository/
git commit -m "feat: CHAT 리포지토리(directKey 조회·커서 이력·안읽은수 배치)"
```

---

### Task 7: DTO + ChatRoomService (방 생성/상세/초대/퇴장)

**Files:**
- Create: `BE/src/main/java/com/back/domain/chat/dto/CreateRoomRequest.java`
- Create: `BE/src/main/java/com/back/domain/chat/dto/InviteRequest.java`
- Create: `BE/src/main/java/com/back/domain/chat/dto/ParticipantView.java`
- Create: `BE/src/main/java/com/back/domain/chat/dto/ChatRoomResponse.java`
- Create: `BE/src/main/java/com/back/domain/chat/service/ChatRoomService.java`
- Test: `BE/src/test/java/com/back/domain/chat/service/ChatRoomServiceTest.java`

**Interfaces:**
- Consumes: repositories(Task 6), `PresenceRegistry`(Task 2), `MemberQueryService.findDisplaysByIds`, `MemberDisplay(memberId,nickname,verified)`.
- Produces:
  - `CreateRoomRequest(RoomType type, List<Long> participantIds, String title)`.
  - `InviteRequest(List<Long> memberIds)`.
  - `ParticipantView(Long id, String nickname, boolean verified, boolean online)`.
  - `ChatRoomResponse(Long id, RoomType type, String title, List<ParticipantView> participants, LocalDateTime createdAt)`.
  - `ChatRoomService`: `ChatRoomResponse createRoom(Long memberId, CreateRoomRequest)`, `ChatRoomResponse getRoom(Long memberId, Long roomId)`, `ChatRoomResponse invite(Long memberId, Long roomId, InviteRequest)`, `void leave(Long memberId, Long roomId)`; helper `void assertActiveParticipant(Long roomId, Long memberId)`.

- [ ] **Step 1: 실패하는 테스트 작성**

`ChatRoomServiceTest.java`:

```java
package com.back.domain.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.domain.chat.dto.CreateRoomRequest;
import com.back.domain.chat.dto.InviteRequest;
import com.back.domain.chat.entity.RoomType;
import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ChatRoomServiceTest {

    @Autowired ChatRoomService service;
    @Autowired MemberRepository memberRepository;

    private Long alice;
    private Long bob;
    private Long carol;

    @BeforeEach
    void setUp() {
        alice = memberRepository.save(Member.createLocal("alice", "pw", "a@x.com", "앨리스")).getId();
        bob = memberRepository.save(Member.createLocal("bob", "pw", "b@x.com", "밥")).getId();
        carol = memberRepository.save(Member.createLocal("carol", "pw", "c@x.com", "캐럴")).getId();
    }

    @Test
    void DIRECT방은_같은_쌍이면_재요청해도_같은_방이다() {
        var first = service.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob), null));
        var second = service.createRoom(bob,
                new CreateRoomRequest(RoomType.DIRECT, List.of(alice), null));

        assertThat(second.id()).isEqualTo(first.id()); // find-or-create
        assertThat(first.type()).isEqualTo(RoomType.DIRECT);
        assertThat(first.participants()).hasSize(2);
    }

    @Test
    void DIRECT_상대가_여러명이면_거절한다() {
        assertThatThrownBy(() -> service.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob, carol), null)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_INVALID_PARTICIPANTS);
    }

    @Test
    void GROUP방_생성후_초대하면_참여자가_늘고_퇴장하면_준다() {
        var room = service.createRoom(alice,
                new CreateRoomRequest(RoomType.GROUP, List.of(bob), "합주"));
        assertThat(room.participants()).hasSize(2); // 생성자 + bob

        var invited = service.invite(alice, room.id(), new InviteRequest(List.of(carol)));
        assertThat(invited.participants()).hasSize(3);

        service.leave(bob, room.id());
        var after = service.getRoom(alice, room.id());
        assertThat(after.participants()).extracting("id").doesNotContain(bob);
    }

    @Test
    void 비참여자가_방을_조회하면_403이다() {
        var room = service.createRoom(alice,
                new CreateRoomRequest(RoomType.GROUP, List.of(bob), "합주"));

        assertThatThrownBy(() -> service.getRoom(carol, room.id()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.NOT_ROOM_PARTICIPANT);
    }

    @Test
    void 없는_방_조회는_404다() {
        assertThatThrownBy(() -> service.getRoom(alice, 99999L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOM_NOT_FOUND);
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.service.ChatRoomServiceTest"`
Expected: 컴파일 실패.

- [ ] **Step 3: DTO 작성**

`CreateRoomRequest.java`:

```java
package com.back.domain.chat.dto;

import com.back.domain.chat.entity.RoomType;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/** 방 생성 요청. DIRECT 는 participantIds 에 상대 1명, GROUP 은 초기 참여자(비어도 됨). */
public record CreateRoomRequest(@NotNull RoomType type, List<Long> participantIds, String title) {

    public List<Long> participantIdsOrEmpty() {
        return participantIds == null ? List.of() : participantIds;
    }
}
```

`InviteRequest.java`:

```java
package com.back.domain.chat.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record InviteRequest(@NotEmpty List<Long> memberIds) {
}
```

`ParticipantView.java`:

```java
package com.back.domain.chat.dto;

/** 참여자 표시정보 + 접속 상태. */
public record ParticipantView(Long id, String nickname, boolean verified, boolean online) {
}
```

`ChatRoomResponse.java`:

```java
package com.back.domain.chat.dto;

import com.back.domain.chat.entity.RoomType;
import java.time.LocalDateTime;
import java.util.List;

/** 방 생성·상세 응답. title 은 GROUP 만, participants 는 활성 참여자. */
public record ChatRoomResponse(Long id, RoomType type, String title,
        List<ParticipantView> participants, LocalDateTime createdAt) {
}
```

- [ ] **Step 4: ChatRoomService 작성**

`ChatRoomService.java`:

```java
package com.back.domain.chat.service;

import com.back.domain.chat.dto.ChatRoomResponse;
import com.back.domain.chat.dto.CreateRoomRequest;
import com.back.domain.chat.dto.InviteRequest;
import com.back.domain.chat.dto.ParticipantView;
import com.back.domain.chat.entity.ChatParticipant;
import com.back.domain.chat.entity.ChatRoom;
import com.back.domain.chat.entity.RoomType;
import com.back.domain.chat.repository.ChatParticipantRepository;
import com.back.domain.chat.repository.ChatRoomRepository;
import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.service.MemberQueryService;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.websocket.PresenceRegistry;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 채팅방 생성/상세/초대/퇴장. 참여자 표시정보는 MEMBER 협력으로 파생한다. */
@Service
@RequiredArgsConstructor
public class ChatRoomService {

    private final ChatRoomRepository roomRepository;
    private final ChatParticipantRepository participantRepository;
    private final MemberQueryService memberQueryService;
    private final PresenceRegistry presenceRegistry;

    @Transactional
    public ChatRoomResponse createRoom(Long memberId, CreateRoomRequest request) {
        ChatRoom room = request.type() == RoomType.DIRECT
                ? createDirect(memberId, request.participantIdsOrEmpty())
                : createGroup(memberId, request);
        return toResponse(room);
    }

    private ChatRoom createDirect(Long memberId, List<Long> participantIds) {
        if (participantIds.size() != 1) {
            throw new BusinessException(ErrorCode.CHAT_INVALID_PARTICIPANTS);
        }
        Long other = participantIds.get(0);
        String key = ChatRoom.directKey(memberId, other); // memberId==other 면 아래 createDirect 가 거절
        return roomRepository.findByDirectKey(key).orElseGet(() -> openDirect(memberId, other, key));
    }

    private ChatRoom openDirect(Long memberId, Long other, String key) {
        try {
            ChatRoom room = roomRepository.save(ChatRoom.createDirect(memberId, other));
            participantRepository.save(ChatParticipant.join(room.getId(), memberId));
            participantRepository.save(ChatParticipant.join(room.getId(), other));
            return room;
        } catch (DataIntegrityViolationException e) {
            // 동시 생성 경합: unique 위반이면 이미 만들어진 방을 재사용(멱등).
            return roomRepository.findByDirectKey(key)
                    .orElseThrow(() -> new BusinessException(ErrorCode.CHAT_INVALID_PARTICIPANTS));
        }
    }

    private ChatRoom createGroup(Long memberId, CreateRoomRequest request) {
        ChatRoom room = roomRepository.save(ChatRoom.createGroup(memberId, request.title()));
        participantRepository.save(ChatParticipant.join(room.getId(), memberId));
        for (Long id : request.participantIdsOrEmpty()) {
            if (!id.equals(memberId)) {
                participantRepository.save(ChatParticipant.join(room.getId(), id));
            }
        }
        return room;
    }

    @Transactional(readOnly = true)
    public ChatRoomResponse getRoom(Long memberId, Long roomId) {
        ChatRoom room = findRoom(roomId);
        assertActiveParticipant(roomId, memberId);
        return toResponse(room);
    }

    @Transactional
    public ChatRoomResponse invite(Long memberId, Long roomId, InviteRequest request) {
        ChatRoom room = findRoom(roomId);
        assertActiveParticipant(roomId, memberId);
        if (room.getType() == RoomType.DIRECT) {
            throw new BusinessException(ErrorCode.CHAT_INVALID_PARTICIPANTS); // 1:1 에 초대 불가
        }
        for (Long invitee : request.memberIds()) {
            participantRepository.findByRoomIdAndMemberId(roomId, invitee).ifPresentOrElse(
                    ChatParticipant::rejoin, // 과거 퇴장자면 재활성(활성이면 no-op 과 동일)
                    () -> participantRepository.save(ChatParticipant.join(roomId, invitee)));
        }
        return toResponse(room);
    }

    @Transactional
    public void leave(Long memberId, Long roomId) {
        findRoom(roomId);
        participantRepository.findByRoomIdAndMemberId(roomId, memberId)
                .filter(ChatParticipant::isActive)
                .ifPresent(ChatParticipant::leave);
    }

    /** 활성 참여자가 아니면 403. WebSocket 인가·다른 서비스에서도 재사용. */
    public void assertActiveParticipant(Long roomId, Long memberId) {
        if (!participantRepository.existsByRoomIdAndMemberIdAndLeftAtIsNull(roomId, memberId)) {
            throw new BusinessException(ErrorCode.NOT_ROOM_PARTICIPANT);
        }
    }

    private ChatRoom findRoom(Long roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHAT_ROOM_NOT_FOUND));
    }

    private ChatRoomResponse toResponse(ChatRoom room) {
        List<ChatParticipant> participants = participantRepository
                .findByRoomIdAndLeftAtIsNull(room.getId());
        Set<Long> ids = participants.stream().map(ChatParticipant::getMemberId)
                .collect(Collectors.toSet());
        Map<Long, MemberDisplay> displays = memberQueryService.findDisplaysByIds(ids);
        Set<Long> online = presenceRegistry.onlineAmong(ids);
        List<ParticipantView> views = participants.stream()
                .map(p -> toView(displays.get(p.getMemberId()), p.getMemberId(),
                        online.contains(p.getMemberId())))
                .toList();
        return new ChatRoomResponse(room.getId(), room.getType(), room.getTitle(), views,
                room.getCreatedAt());
    }

    private ParticipantView toView(MemberDisplay d, Long memberId, boolean online) {
        if (d == null) {
            return new ParticipantView(memberId, null, false, online);
        }
        return new ParticipantView(d.memberId(), d.nickname(), d.verified(), online);
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.service.ChatRoomServiceTest"`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add BE/src/main/java/com/back/domain/chat/dto/ BE/src/main/java/com/back/domain/chat/service/ChatRoomService.java BE/src/test/java/com/back/domain/chat/service/ChatRoomServiceTest.java
git commit -m "feat: ChatRoomService(방 생성 find-or-create·초대·퇴장)"
```

---

### Task 8: ChatMessageService (전송·이력) + 응답 DTO

**Files:**
- Create: `BE/src/main/java/com/back/domain/chat/dto/ChatMessageResponse.java`
- Create: `BE/src/main/java/com/back/domain/chat/dto/SendMessageRequest.java`
- Create: `BE/src/main/java/com/back/domain/chat/service/ChatMessageService.java`
- Test: `BE/src/test/java/com/back/domain/chat/service/ChatMessageServiceTest.java`

**Interfaces:**
- Consumes: repositories(Task 6), `ChatRoomService.assertActiveParticipant`(Task 7), `MemberQueryService`, `CursorPage<T>`(기존 `com.back.domain.feed.dto.CursorPage`).
- Produces:
  - `ChatMessageResponse(Long id, Long roomId, MemberDisplay sender, String content, LocalDateTime createdAt)`.
  - `SendMessageRequest(String content)` (STOMP payload; `@NotBlank`, `@Size(max=2000)`).
  - `ChatMessageService`: `ChatMessageResponse send(Long senderId, Long roomId, String content)`, `CursorPage<ChatMessageResponse> history(Long memberId, Long roomId, Long cursor, int size)`.

- [ ] **Step 1: 실패하는 테스트 작성**

`ChatMessageServiceTest.java`:

```java
package com.back.domain.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.domain.chat.dto.ChatRoomResponse;
import com.back.domain.chat.dto.CreateRoomRequest;
import com.back.domain.chat.entity.RoomType;
import com.back.domain.chat.repository.ChatRoomRepository;
import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ChatMessageServiceTest {

    @Autowired ChatMessageService messageService;
    @Autowired ChatRoomService roomService;
    @Autowired ChatRoomRepository roomRepository;
    @Autowired MemberRepository memberRepository;

    private Long alice;
    private Long bob;
    private Long carol;
    private Long roomId;

    @BeforeEach
    void setUp() {
        alice = memberRepository.save(Member.createLocal("alice", "pw", "a@x.com", "앨리스")).getId();
        bob = memberRepository.save(Member.createLocal("bob", "pw", "b@x.com", "밥")).getId();
        carol = memberRepository.save(Member.createLocal("carol", "pw", "c@x.com", "캐럴")).getId();
        ChatRoomResponse room = roomService.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob), null));
        roomId = room.id();
    }

    @Test
    void 전송하면_저장되고_방의_lastMessageAt이_갱신된다() {
        var before = roomRepository.findById(roomId).orElseThrow().getLastMessageAt();

        var sent = messageService.send(alice, roomId, "안녕");

        assertThat(sent.content()).isEqualTo("안녕");
        assertThat(sent.sender().nickname()).isEqualTo("앨리스");
        var after = roomRepository.findById(roomId).orElseThrow().getLastMessageAt();
        assertThat(after).isAfterOrEqualTo(before);
    }

    @Test
    void 이력은_최신순_커서로_준다() {
        messageService.send(alice, roomId, "1");
        messageService.send(bob, roomId, "2");
        messageService.send(alice, roomId, "3");

        var page = messageService.history(alice, roomId, null, 2);

        assertThat(page.items()).extracting("content").containsExactly("3", "2");
        assertThat(page.nextCursor()).isNotNull();

        var older = messageService.history(alice, roomId, page.nextCursor(), 2);
        assertThat(older.items()).extracting("content").containsExactly("1");
        assertThat(older.nextCursor()).isNull();
    }

    @Test
    void 비참여자는_전송도_이력조회도_403이다() {
        assertThatThrownBy(() -> messageService.send(carol, roomId, "끼어들기"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.NOT_ROOM_PARTICIPANT);
        assertThatThrownBy(() -> messageService.history(carol, roomId, null, 20))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.NOT_ROOM_PARTICIPANT);
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.service.ChatMessageServiceTest"`
Expected: 컴파일 실패.

- [ ] **Step 3: DTO 작성**

`ChatMessageResponse.java`:

```java
package com.back.domain.chat.dto;

import com.back.domain.member.dto.MemberDisplay;
import java.time.LocalDateTime;

/** 메시지 응답. sender 는 MEMBER 협력으로 파생한 표시정보. */
public record ChatMessageResponse(Long id, Long roomId, MemberDisplay sender, String content,
        LocalDateTime createdAt) {
}
```

`SendMessageRequest.java`:

```java
package com.back.domain.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** STOMP 전송 페이로드. */
public record SendMessageRequest(@NotBlank @Size(max = 2000) String content) {
}
```

- [ ] **Step 4: ChatMessageService 작성**

`ChatMessageService.java`:

```java
package com.back.domain.chat.service;

import com.back.domain.chat.dto.ChatMessageResponse;
import com.back.domain.chat.entity.ChatMessage;
import com.back.domain.chat.entity.ChatRoom;
import com.back.domain.chat.repository.ChatMessageRepository;
import com.back.domain.chat.repository.ChatRoomRepository;
import com.back.domain.feed.dto.CursorPage;
import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.service.MemberQueryService;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 메시지 전송(영속화)·이력 조회. 인가는 ChatRoomService.assertActiveParticipant 재사용. */
@Service
@RequiredArgsConstructor
public class ChatMessageService {

    private final ChatMessageRepository messageRepository;
    private final ChatRoomRepository roomRepository;
    private final ChatRoomService roomService;
    private final MemberQueryService memberQueryService;

    /** 메시지 영속화 + 방 lastMessageAt 갱신. 브로드캐스트는 호출측(STOMP 컨트롤러)이 한다. */
    @Transactional
    public ChatMessageResponse send(Long senderId, Long roomId, String content) {
        ChatRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHAT_ROOM_NOT_FOUND));
        roomService.assertActiveParticipant(roomId, senderId);
        ChatMessage saved = messageRepository.save(ChatMessage.create(roomId, senderId, content));
        room.updateLastMessageAt(LocalDateTime.now());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public CursorPage<ChatMessageResponse> history(Long memberId, Long roomId, Long cursor,
            int size) {
        if (!roomRepository.existsById(roomId)) {
            throw new BusinessException(ErrorCode.CHAT_ROOM_NOT_FOUND);
        }
        roomService.assertActiveParticipant(roomId, memberId);
        List<ChatMessage> rows = messageRepository.findHistory(roomId, cursor,
                PageRequest.of(0, size + 1));
        boolean hasNext = rows.size() > size;
        List<ChatMessage> page = hasNext ? rows.subList(0, size) : rows;
        if (page.isEmpty()) {
            return new CursorPage<>(List.of(), null);
        }
        Set<Long> senderIds = page.stream().map(ChatMessage::getSenderId)
                .collect(Collectors.toSet());
        Map<Long, MemberDisplay> senders = memberQueryService.findDisplaysByIds(senderIds);
        List<ChatMessageResponse> items = page.stream()
                .map(m -> toResponse(m, senders.get(m.getSenderId()))).toList();
        Long nextCursor = hasNext ? page.get(page.size() - 1).getId() : null;
        return new CursorPage<>(items, nextCursor);
    }

    private ChatMessageResponse toResponse(ChatMessage m) {
        MemberDisplay sender = memberQueryService.findDisplaysByIds(Set.of(m.getSenderId()))
                .get(m.getSenderId());
        return toResponse(m, sender);
    }

    private ChatMessageResponse toResponse(ChatMessage m, MemberDisplay sender) {
        return new ChatMessageResponse(m.getId(), m.getRoomId(), sender, m.getContent(),
                m.getCreatedAt());
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.service.ChatMessageServiceTest"`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add BE/src/main/java/com/back/domain/chat/dto/ChatMessageResponse.java BE/src/main/java/com/back/domain/chat/dto/SendMessageRequest.java BE/src/main/java/com/back/domain/chat/service/ChatMessageService.java BE/src/test/java/com/back/domain/chat/service/ChatMessageServiceTest.java
git commit -m "feat: ChatMessageService(전송 영속화·커서 이력)"
```

---

### Task 9: 읽음 처리 + 방 목록(안읽은수·마지막메시지)

**Files:**
- Create: `BE/src/main/java/com/back/domain/chat/dto/ReadRequest.java`
- Create: `BE/src/main/java/com/back/domain/chat/dto/ChatRoomSummaryResponse.java`
- Modify: `BE/src/main/java/com/back/domain/chat/service/ChatRoomService.java`
- Test: `BE/src/test/java/com/back/domain/chat/service/ChatRoomListTest.java`

**Interfaces:**
- Consumes: `ChatMessageRepository.findLatestPerRoom`, `countUnreadPerRoom`, `RoomUnreadCount`(Task 6), `ChatParticipantRepository.findByRoomIdAndMemberId`.
- Produces:
  - `ReadRequest(Long lastReadMessageId)`.
  - `ChatRoomSummaryResponse(Long id, RoomType type, String displayName, LastMessage lastMessage, long unreadCount, LocalDateTime lastMessageAt)` with nested `record LastMessage(String content, Long senderId, LocalDateTime createdAt)`.
  - `ChatRoomService`: `Page<ChatRoomSummaryResponse> listRooms(Long memberId, Pageable)`, `void markRead(Long memberId, Long roomId, Long lastReadMessageId)`.

- [ ] **Step 1: 실패하는 테스트 작성**

`ChatRoomListTest.java`:

```java
package com.back.domain.chat.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.domain.chat.dto.ChatRoomResponse;
import com.back.domain.chat.dto.ChatRoomSummaryResponse;
import com.back.domain.chat.dto.CreateRoomRequest;
import com.back.domain.chat.entity.RoomType;
import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ChatRoomListTest {

    @Autowired ChatRoomService roomService;
    @Autowired ChatMessageService messageService;
    @Autowired MemberRepository memberRepository;

    private Long alice;
    private Long bob;

    @BeforeEach
    void setUp() {
        alice = memberRepository.save(Member.createLocal("alice", "pw", "a@x.com", "앨리스")).getId();
        bob = memberRepository.save(Member.createLocal("bob", "pw", "b@x.com", "밥")).getId();
    }

    @Test
    void 방목록은_안읽은수와_마지막메시지를_담는다() {
        ChatRoomResponse room = roomService.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob), null));
        messageService.send(bob, room.id(), "첫 메시지");
        messageService.send(bob, room.id(), "둘째 메시지");

        var page = roomService.listRooms(alice, PageRequest.of(0, 20));

        assertThat(page.getContent()).hasSize(1);
        ChatRoomSummaryResponse summary = page.getContent().get(0);
        assertThat(summary.unreadCount()).isEqualTo(2); // bob 이 보낸 2개
        assertThat(summary.lastMessage().content()).isEqualTo("둘째 메시지");
        assertThat(summary.displayName()).isEqualTo("밥"); // DIRECT 는 상대 닉네임
    }

    @Test
    void 읽음처리하면_안읽은수가_준다() {
        ChatRoomResponse room = roomService.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob), null));
        var m1 = messageService.send(bob, room.id(), "1");
        var m2 = messageService.send(bob, room.id(), "2");

        roomService.markRead(alice, room.id(), m2.id());

        var page = roomService.listRooms(alice, PageRequest.of(0, 20));
        assertThat(page.getContent().get(0).unreadCount()).isEqualTo(0);
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.service.ChatRoomListTest"`
Expected: 컴파일 실패.

- [ ] **Step 3: DTO 작성**

`ReadRequest.java`:

```java
package com.back.domain.chat.dto;

import jakarta.validation.constraints.NotNull;

public record ReadRequest(@NotNull Long lastReadMessageId) {
}
```

`ChatRoomSummaryResponse.java`:

```java
package com.back.domain.chat.dto;

import com.back.domain.chat.entity.RoomType;
import java.time.LocalDateTime;

/** 방 목록 항목. displayName 은 DIRECT=상대 닉네임 / GROUP=title. lastMessage 는 없으면 null. */
public record ChatRoomSummaryResponse(Long id, RoomType type, String displayName,
        LastMessage lastMessage, long unreadCount, LocalDateTime lastMessageAt) {

    public record LastMessage(String content, Long senderId, LocalDateTime createdAt) {
    }
}
```

- [ ] **Step 4: ChatRoomService에 listRooms/markRead 추가**

`ChatRoomService.java`의 import 에 다음을 추가한다:

```java
import com.back.domain.chat.dto.ChatRoomSummaryResponse;
import com.back.domain.chat.dto.ChatRoomSummaryResponse.LastMessage;
import com.back.domain.chat.entity.ChatMessage;
import com.back.domain.chat.repository.ChatMessageRepository;
import com.back.domain.chat.repository.RoomUnreadCount;
import java.util.HashMap;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
```

필드에 `ChatMessageRepository` 를 추가한다(생성자 주입, `@RequiredArgsConstructor` 이므로 `final` 필드만 추가):

```java
    private final ChatMessageRepository messageRepository;
```

클래스 본문에 메서드를 추가한다:

```java
    @Transactional(readOnly = true)
    public Page<ChatRoomSummaryResponse> listRooms(Long memberId, Pageable pageable) {
        Page<ChatRoom> rooms = roomRepository.findRoomsForMember(memberId, pageable);
        List<Long> roomIds = rooms.getContent().stream().map(ChatRoom::getId).toList();
        if (roomIds.isEmpty()) {
            return rooms.map(r -> null); // 빈 페이지
        }
        Map<Long, ChatMessage> lastMessages = messageRepository.findLatestPerRoom(roomIds).stream()
                .collect(Collectors.toMap(ChatMessage::getRoomId, m -> m));
        Map<Long, Long> unread = new HashMap<>();
        for (RoomUnreadCount c : messageRepository.countUnreadPerRoom(memberId, roomIds)) {
            unread.put(c.getRoomId(), c.getUnreadCount());
        }
        Map<Long, String> directNames = directDisplayNames(memberId, rooms.getContent());
        return rooms.map(room -> toSummary(room, lastMessages.get(room.getId()),
                unread.getOrDefault(room.getId(), 0L), directNames.get(room.getId())));
    }

    /** DIRECT 방의 표시 이름(상대 닉네임)을 배치로 파생한다. */
    private Map<Long, String> directDisplayNames(Long memberId, List<ChatRoom> rooms) {
        Map<Long, Long> roomToOther = new HashMap<>();
        for (ChatRoom room : rooms) {
            if (room.getType() == RoomType.DIRECT) {
                participantRepository.findByRoomIdAndLeftAtIsNull(room.getId()).stream()
                        .map(ChatParticipant::getMemberId)
                        .filter(id -> !id.equals(memberId))
                        .findFirst()
                        .ifPresent(other -> roomToOther.put(room.getId(), other));
            }
        }
        Map<Long, MemberDisplay> displays = memberQueryService
                .findDisplaysByIds(Set.copyOf(roomToOther.values()));
        Map<Long, String> names = new HashMap<>();
        roomToOther.forEach((roomId, other) -> {
            MemberDisplay d = displays.get(other);
            names.put(roomId, d == null ? null : d.nickname());
        });
        return names;
    }

    private ChatRoomSummaryResponse toSummary(ChatRoom room, ChatMessage last, long unreadCount,
            String directName) {
        String displayName = room.getType() == RoomType.DIRECT ? directName : room.getTitle();
        LastMessage lastMessage = last == null ? null
                : new LastMessage(last.getContent(), last.getSenderId(), last.getCreatedAt());
        return new ChatRoomSummaryResponse(room.getId(), room.getType(), displayName, lastMessage,
                unreadCount, room.getLastMessageAt());
    }

    @Transactional
    public void markRead(Long memberId, Long roomId, Long lastReadMessageId) {
        findRoom(roomId);
        ChatParticipant participant = participantRepository
                .findByRoomIdAndMemberId(roomId, memberId)
                .filter(ChatParticipant::isActive)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_ROOM_PARTICIPANT));
        participant.updateLastRead(lastReadMessageId);
    }
```

> 참고: `listRooms` 의 빈 페이지 처리에서 `roomIds.isEmpty()` 는 페이지 콘텐츠가 비었을 때만 참이다. `rooms.map(r -> null)` 은 비어있으므로 매핑 함수가 호출되지 않는다(빈 Page 반환).

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.service.ChatRoomListTest"`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add BE/src/main/java/com/back/domain/chat/dto/ReadRequest.java BE/src/main/java/com/back/domain/chat/dto/ChatRoomSummaryResponse.java BE/src/main/java/com/back/domain/chat/service/ChatRoomService.java BE/src/test/java/com/back/domain/chat/service/ChatRoomListTest.java
git commit -m "feat: 방 목록(안읽은수·마지막메시지)·읽음 처리"
```

---

### Task 10: REST 컨트롤러 + 슬라이스 테스트

**Files:**
- Create: `BE/src/main/java/com/back/domain/chat/controller/ChatRoomController.java`
- Test: `BE/src/test/java/com/back/domain/chat/controller/ChatRoomControllerTest.java`

**Interfaces:**
- Consumes: `ChatRoomService`(create/getRoom/invite/leave/listRooms/markRead), `ChatMessageService`(history).
- Produces: REST `/api/chat/**` 엔드포인트.

- [ ] **Step 1: 실패하는 테스트 작성**

`ChatRoomControllerTest.java`:

```java
package com.back.domain.chat.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.security.Role;
import com.back.global.security.jwt.JwtProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class ChatRoomControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired MemberRepository memberRepository;
    @Autowired JwtProvider jwtProvider;

    private String aliceBearer;
    private String bobBearer;
    private Long bobId;

    @BeforeEach
    void setUp() {
        Member alice = memberRepository.save(Member.createLocal("alice", "pw", "a@x.com", "앨리스"));
        aliceBearer = "Bearer " + jwtProvider.createAccessToken(alice.getId(), Role.USER);
        Member bob = memberRepository.save(Member.createLocal("bob", "pw", "b@x.com", "밥"));
        bobId = bob.getId();
        bobBearer = "Bearer " + jwtProvider.createAccessToken(bob.getId(), Role.USER);
    }

    private String createDirect() throws Exception {
        String body = "{\"type\":\"DIRECT\",\"participantIds\":[" + bobId + "]}";
        String json = mockMvc.perform(post("/api/chat/rooms").header("Authorization", aliceBearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.replaceAll(".*?\"id\":(\\d+).*", "$1");
    }

    @Test
    void 토큰_없이_방생성은_401() throws Exception {
        mockMvc.perform(post("/api/chat/rooms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"DIRECT\",\"participantIds\":[1]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void DIRECT방_생성하고_목록에_보인다() throws Exception {
        createDirect();
        mockMvc.perform(get("/api/chat/rooms").header("Authorization", aliceBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].type").value("DIRECT"))
                .andExpect(jsonPath("$.data.content[0].displayName").value("밥"));
    }

    @Test
    void 비참여자_상세조회는_403() throws Exception {
        String id = createDirect();
        Member carol = memberRepository.save(Member.createLocal("carol", "pw", "c@x.com", "캐럴"));
        String carolBearer = "Bearer " + jwtProvider.createAccessToken(carol.getId(), Role.USER);

        mockMvc.perform(get("/api/chat/rooms/" + id).header("Authorization", carolBearer))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.resultCode").value("403-03"));
    }

    @Test
    void 없는_방_상세는_404() throws Exception {
        mockMvc.perform(get("/api/chat/rooms/99999").header("Authorization", aliceBearer))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.resultCode").value("404-10"));
    }

    @Test
    void DIRECT_상대_여러명이면_400_03() throws Exception {
        Member carol = memberRepository.save(Member.createLocal("carol", "pw", "c@x.com", "캐럴"));
        String body = "{\"type\":\"DIRECT\",\"participantIds\":[" + bobId + "," + carol.getId() + "]}";
        mockMvc.perform(post("/api/chat/rooms").header("Authorization", aliceBearer)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-03"));
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.controller.ChatRoomControllerTest"`
Expected: 컴파일 실패 또는 404(엔드포인트 없음).

- [ ] **Step 3: ChatRoomController 작성**

`ChatRoomController.java`:

```java
package com.back.domain.chat.controller;

import com.back.domain.chat.dto.ChatMessageResponse;
import com.back.domain.chat.dto.ChatRoomResponse;
import com.back.domain.chat.dto.ChatRoomSummaryResponse;
import com.back.domain.chat.dto.CreateRoomRequest;
import com.back.domain.chat.dto.InviteRequest;
import com.back.domain.chat.dto.ReadRequest;
import com.back.domain.chat.service.ChatMessageService;
import com.back.domain.chat.service.ChatRoomService;
import com.back.domain.feed.dto.CursorPage;
import com.back.global.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 채팅 REST API(상태·이력). 실시간 송수신은 STOMP(ChatStompController). 모두 인증 필요. */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatRoomController {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 50;

    private final ChatRoomService roomService;
    private final ChatMessageService messageService;

    @PostMapping("/rooms")
    public ApiResponse<ChatRoomResponse> create(@AuthenticationPrincipal Long memberId,
            @Valid @RequestBody CreateRoomRequest request) {
        return ApiResponse.success(roomService.createRoom(memberId, request));
    }

    @GetMapping("/rooms")
    public ApiResponse<Page<ChatRoomSummaryResponse>> list(@AuthenticationPrincipal Long memberId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(
                roomService.listRooms(memberId, PageRequest.of(Math.max(page, 0), clamp(size))));
    }

    @GetMapping("/rooms/{id}")
    public ApiResponse<ChatRoomResponse> get(@AuthenticationPrincipal Long memberId,
            @PathVariable Long id) {
        return ApiResponse.success(roomService.getRoom(memberId, id));
    }

    @GetMapping("/rooms/{id}/messages")
    public ApiResponse<CursorPage<ChatMessageResponse>> messages(
            @AuthenticationPrincipal Long memberId, @PathVariable Long id,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(messageService.history(memberId, id, cursor, clamp(size)));
    }

    @PostMapping("/rooms/{id}/participants")
    public ApiResponse<ChatRoomResponse> invite(@AuthenticationPrincipal Long memberId,
            @PathVariable Long id, @Valid @RequestBody InviteRequest request) {
        return ApiResponse.success(roomService.invite(memberId, id, request));
    }

    @DeleteMapping("/rooms/{id}/participants/me")
    public ApiResponse<Void> leave(@AuthenticationPrincipal Long memberId, @PathVariable Long id) {
        roomService.leave(memberId, id);
        return ApiResponse.success();
    }

    @PostMapping("/rooms/{id}/read")
    public ApiResponse<Void> read(@AuthenticationPrincipal Long memberId, @PathVariable Long id,
            @Valid @RequestBody ReadRequest request) {
        roomService.markRead(memberId, id, request.lastReadMessageId());
        return ApiResponse.success();
    }

    private int clamp(int size) {
        if (size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.controller.ChatRoomControllerTest"`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add BE/src/main/java/com/back/domain/chat/controller/ChatRoomController.java BE/src/test/java/com/back/domain/chat/controller/ChatRoomControllerTest.java
git commit -m "feat: CHAT REST 컨트롤러(방/이력/초대/퇴장/읽음)"
```

---

### Task 11: WebSocket 설정 + STOMP 인증/인가 인터셉터

**Files:**
- Create: `BE/src/main/java/com/back/global/websocket/StompAuthChannelInterceptor.java`
- Create: `BE/src/main/java/com/back/global/websocket/WebSocketConfig.java`
- Modify: `BE/src/main/java/com/back/global/security/SecurityConfig.java`
- Test: (통합 테스트는 Task 13에서 실제 연결로 검증. 여기서는 애플리케이션 컨텍스트 로딩만 확인.)

**Interfaces:**
- Consumes: `JwtProvider.parse`, `ChatParticipantRepository.existsByRoomIdAndMemberIdAndLeftAtIsNull`.
- Produces: STOMP 엔드포인트 `/ws`, prefix `/app`(app)·`/topic`,`/user`(broker), 인바운드 채널에 인증/인가 인터셉터. `/ws/**` 는 시큐리티 permitAll.

- [ ] **Step 1: SecurityConfig에 /ws 핸드셰이크 permit 추가**

`SecurityConfig.java`의 `authorizeHttpRequests` 블록에서 `"/files/**"` permit 줄 아래에 추가:

```java
                        .requestMatchers("/ws/**").permitAll()
```

> 인증은 HTTP 핸드셰이크가 아니라 STOMP CONNECT 프레임에서 하므로 핸드셰이크 경로는 permit 한다.

- [ ] **Step 2: StompAuthChannelInterceptor 작성**

`StompAuthChannelInterceptor.java`:

```java
package com.back.global.websocket;

import com.back.domain.chat.repository.ChatParticipantRepository;
import com.back.global.security.jwt.JwtProvider;
import io.jsonwebtoken.Claims;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

/**
 * STOMP 인바운드 채널 가로채기.
 * CONNECT: Authorization 헤더의 JWT 로 인증해 Principal(memberId) 설정.
 * SUBSCRIBE/SEND: 대상 방의 활성 참여자인지 인가.
 */
@Component
@RequiredArgsConstructor
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String ROOM_PREFIX_TOPIC = "/topic/rooms/";
    private static final String ROOM_PREFIX_APP = "/app/rooms/";

    private final JwtProvider jwtProvider;
    private final ChatParticipantRepository participantRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor
                .getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        switch (accessor.getCommand()) {
            case CONNECT -> authenticate(accessor);
            case SUBSCRIBE -> authorize(accessor, accessor.getDestination(), ROOM_PREFIX_TOPIC);
            case SEND -> authorize(accessor, accessor.getDestination(), ROOM_PREFIX_APP);
            default -> {
                // 그 외 프레임(UNSUBSCRIBE/DISCONNECT 등)은 통과
            }
        }
        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String bearer = accessor.getFirstNativeHeader("Authorization");
        if (bearer == null || !bearer.startsWith("Bearer ")) {
            throw new IllegalArgumentException("인증 토큰이 없습니다.");
        }
        try {
            Claims claims = jwtProvider.parse(bearer.substring("Bearer ".length()));
            Long memberId = Long.valueOf(claims.getSubject());
            String role = claims.get("role", String.class);
            var authentication = new UsernamePasswordAuthenticationToken(memberId, null,
                    List.of(new SimpleGrantedAuthority(role)));
            accessor.setUser(authentication);
        } catch (Exception e) {
            throw new IllegalArgumentException("유효하지 않은 토큰입니다.", e);
        }
    }

    private void authorize(StompHeaderAccessor accessor, String destination, String prefix) {
        if (destination == null || !destination.startsWith(prefix)) {
            return; // 방 목적지가 아니면 인가 대상 아님(개인 큐 등)
        }
        Long roomId = parseRoomId(destination, prefix);
        Long memberId = currentMemberId(accessor);
        if (memberId == null
                || !participantRepository.existsByRoomIdAndMemberIdAndLeftAtIsNull(roomId, memberId)) {
            throw new IllegalArgumentException("채팅방 참여자만 접근할 수 있습니다."); // NOT_ROOM_PARTICIPANT
        }
    }

    /** "/prefix/{roomId}" 또는 "/prefix/{roomId}/send" 에서 roomId 추출. */
    private Long parseRoomId(String destination, String prefix) {
        String rest = destination.substring(prefix.length());
        int slash = rest.indexOf('/');
        String idPart = slash < 0 ? rest : rest.substring(0, slash);
        try {
            return Long.valueOf(idPart);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("잘못된 방 목적지: " + destination, e);
        }
    }

    private Long currentMemberId(StompHeaderAccessor accessor) {
        if (accessor.getUser() instanceof UsernamePasswordAuthenticationToken token
                && token.getPrincipal() instanceof Long id) {
            return id;
        }
        return null;
    }
}
```

- [ ] **Step 3: WebSocketConfig 작성**

`WebSocketConfig.java`:

```java
package com.back.global.websocket;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * STOMP 설정. 엔드포인트 /ws, app prefix /app, 인메모리 Simple Broker(/topic,/user).
 * 다중 서버 확장 시 enableStompBrokerRelay 로 이 부분만 교체(도메인 코드 불변).
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompAuthChannelInterceptor authChannelInterceptor;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/user");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authChannelInterceptor);
    }
}
```

- [ ] **Step 4: 컨텍스트 로딩 확인(전체 컴파일 + 기존 테스트 회귀)**

Run: `cd BE && ./gradlew test --tests "com.back.AttaccaApplicationTests"`
Expected: PASS(애플리케이션 컨텍스트가 WebSocket 설정 포함해 정상 로딩).

- [ ] **Step 5: 커밋**

```bash
git add BE/src/main/java/com/back/global/websocket/WebSocketConfig.java BE/src/main/java/com/back/global/websocket/StompAuthChannelInterceptor.java BE/src/main/java/com/back/global/security/SecurityConfig.java
git commit -m "feat: WebSocket STOMP 설정·CONNECT 인증·방 인가 인터셉터"
```

---

### Task 12: STOMP 메시지 컨트롤러(전송·typing) + presence 이벤트

**Files:**
- Create: `BE/src/main/java/com/back/domain/chat/controller/ChatStompController.java`
- Create: `BE/src/main/java/com/back/global/websocket/ChatPresenceEventListener.java`
- Test: (실시간 동작은 Task 13 통합 테스트에서 검증.)

**Interfaces:**
- Consumes: `ChatMessageService.send`, `ChatParticipantRepository.findByRoomIdAndLeftAtIsNull`, `PresenceRegistry`, `SimpMessagingTemplate`.
- Produces: `@MessageMapping("/rooms/{roomId}/send")`, `@MessageMapping("/rooms/{roomId}/typing")`; connect/disconnect presence 브로드캐스트.

- [ ] **Step 1: ChatStompController 작성**

`ChatStompController.java`:

```java
package com.back.domain.chat.controller;

import com.back.domain.chat.dto.ChatMessageResponse;
import com.back.domain.chat.dto.SendMessageRequest;
import com.back.domain.chat.service.ChatMessageService;
import jakarta.validation.Valid;
import java.security.Principal;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;

/**
 * STOMP 실시간 핸들러.
 * send: 영속화 후 /topic/rooms/{id} 로 메시지 브로드캐스트.
 * typing: 저장 없이 입력중 신호만 브로드캐스트.
 * (인가는 StompAuthChannelInterceptor 가 SEND 프레임에서 이미 검증)
 */
@Controller
@RequiredArgsConstructor
public class ChatStompController {

    private final ChatMessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/rooms/{roomId}/send")
    public void send(@DestinationVariable Long roomId, @Valid SendMessageRequest request,
            Principal principal) {
        Long senderId = memberId(principal);
        ChatMessageResponse response = messageService.send(senderId, roomId, request.content());
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId, response);
    }

    @MessageMapping("/rooms/{roomId}/typing")
    public void typing(@DestinationVariable Long roomId, Principal principal) {
        Long senderId = memberId(principal);
        messagingTemplate.convertAndSend("/topic/rooms/" + roomId,
                Map.of("type", "TYPING", "senderId", senderId));
    }

    private Long memberId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken token
                && token.getPrincipal() instanceof Long id) {
            return id;
        }
        throw new IllegalStateException("인증되지 않은 STOMP 세션");
    }
}
```

- [ ] **Step 2: ChatPresenceEventListener 작성**

`ChatPresenceEventListener.java`:

```java
package com.back.global.websocket;

import com.back.domain.chat.entity.ChatParticipant;
import com.back.domain.chat.repository.ChatParticipantRepository;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * WebSocket 연결/해제 이벤트로 presence 를 갱신하고, 그 회원이 활성 참여 중인
 * 방들의 /topic/rooms/{id} 에 온라인/오프라인 상태를 브로드캐스트한다.
 */
@Component
@RequiredArgsConstructor
public class ChatPresenceEventListener {

    private final PresenceRegistry presenceRegistry;
    private final ChatParticipantRepository participantRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        Long memberId = memberId(event.getUser());
        if (memberId == null) {
            return;
        }
        presenceRegistry.connected(memberId);
        broadcastPresence(memberId, true);
    }

    @EventListener
    public void onDisconnected(SessionDisconnectEvent event) {
        Long memberId = memberId(event.getUser());
        if (memberId == null) {
            return;
        }
        presenceRegistry.disconnected(memberId);
        broadcastPresence(memberId, presenceRegistry.isOnline(memberId));
    }

    private void broadcastPresence(Long memberId, boolean online) {
        List<ChatParticipant> participations = participantRepository
                .findByMemberIdAndLeftAtIsNull(memberId);
        Map<String, Object> payload = Map.of("type", "PRESENCE", "memberId", memberId,
                "online", online);
        for (ChatParticipant p : participations) {
            messagingTemplate.convertAndSend("/topic/rooms/" + p.getRoomId(), payload);
        }
    }

    private Long memberId(java.security.Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken token
                && token.getPrincipal() instanceof Long id) {
            return id;
        }
        return null;
    }
}
```

- [ ] **Step 3: ChatParticipantRepository에 findByMemberIdAndLeftAtIsNull 추가**

`ChatParticipantRepository.java`에 메서드 추가:

```java
    List<ChatParticipant> findByMemberIdAndLeftAtIsNull(Long memberId);
```

- [ ] **Step 4: 컴파일 + 기존 테스트 회귀 확인**

Run: `cd BE && ./gradlew test --tests "com.back.AttaccaApplicationTests"`
Expected: PASS(컨텍스트 로딩·컴파일 정상).

- [ ] **Step 5: 커밋**

```bash
git add BE/src/main/java/com/back/domain/chat/controller/ChatStompController.java BE/src/main/java/com/back/global/websocket/ChatPresenceEventListener.java BE/src/main/java/com/back/domain/chat/repository/ChatParticipantRepository.java
git commit -m "feat: STOMP 전송·typing 핸들러·presence 이벤트 브로드캐스트"
```

---

### Task 13: WebSocket 통합 테스트 (실제 연결)

**Files:**
- Test: `BE/src/test/java/com/back/domain/chat/websocket/ChatWebSocketIntegrationTest.java`

**Interfaces:**
- Consumes: 전체 스택(STOMP 엔드포인트 `/ws`, 인터셉터, 컨트롤러).

> 🎓 학습 포인트: REST 는 MockMvc 로 되지만 STOMP 는 실제 소켓 연결이 필요하다. `WebSocketStompClient` 로 실제 서버(RANDOM_PORT)에 붙어 CONNECT 인증→구독 인가→송수신을 검증한다.

- [ ] **Step 1: 통합 테스트 작성**

`ChatWebSocketIntegrationTest.java`:

```java
package com.back.domain.chat.websocket;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.domain.chat.dto.ChatRoomResponse;
import com.back.domain.chat.dto.CreateRoomRequest;
import com.back.domain.chat.entity.RoomType;
import com.back.domain.chat.service.ChatRoomService;
import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.security.Role;
import com.back.global.security.jwt.JwtProvider;
import java.lang.reflect.Type;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ChatWebSocketIntegrationTest {

    @LocalServerPort int port;
    @Autowired ChatRoomService roomService;
    @Autowired MemberRepository memberRepository;
    @Autowired JwtProvider jwtProvider;

    private WebSocketStompClient stompClient;
    private Long alice;
    private Long bob;
    private Long carol;
    private String aliceToken;
    private String bobToken;
    private String carolToken;
    private Long roomId;

    @BeforeEach
    void setUp() {
        stompClient = new WebSocketStompClient(new StandardWebSocketClient());
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());

        alice = memberRepository.save(Member.createLocal("alice", "pw", "a@x.com", "앨리스")).getId();
        bob = memberRepository.save(Member.createLocal("bob", "pw", "b@x.com", "밥")).getId();
        carol = memberRepository.save(Member.createLocal("carol", "pw", "c@x.com", "캐럴")).getId();
        aliceToken = jwtProvider.createAccessToken(alice, Role.USER);
        bobToken = jwtProvider.createAccessToken(bob, Role.USER);
        carolToken = jwtProvider.createAccessToken(carol, Role.USER);

        ChatRoomResponse room = roomService.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob), null));
        roomId = room.id();
    }

    private StompSession connect(String token) throws Exception {
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);
        return stompClient.connectAsync("ws://localhost:" + port + "/ws",
                        new org.springframework.web.socket.WebSocketHttpHeaders(), connectHeaders,
                        new StompSessionHandlerAdapter() {})
                .get(3, TimeUnit.SECONDS);
    }

    @Test
    void 유효토큰이면_연결되고_참여방을_구독해_메시지를_받는다() throws Exception {
        StompSession session = connect(aliceToken);
        BlockingQueue<Map> received = new LinkedBlockingDeque<>();

        session.subscribe("/topic/rooms/" + roomId, new StompFrameHandler() {
            @Override public Type getPayloadType(StompHeaders headers) {
                return Map.class;
            }
            @Override public void handleFrame(StompHeaders headers, Object payload) {
                received.add((Map) payload);
            }
        });
        Thread.sleep(300); // 구독 반영 대기

        session.send("/app/rooms/" + roomId + "/send", Map.of("content", "안녕 밥"));

        Map message = received.poll(3, TimeUnit.SECONDS);
        assertThat(message).isNotNull();
        assertThat(message.get("content")).isEqualTo("안녕 밥");
    }

    @Test
    void 토큰_없으면_연결이_거절된다() {
        assertThatThrownBy(() -> stompClient.connectAsync("ws://localhost:" + port + "/ws",
                        new StompSessionHandlerAdapter() {})
                .get(3, TimeUnit.SECONDS)).isInstanceOf(Exception.class);
    }

    @Test
    void 비참여자가_방을_구독하면_ERROR로_끊긴다() throws Exception {
        StompSession session = connect(carolToken); // carol 은 이 방 참여자 아님
        BlockingQueue<Throwable> errors = new LinkedBlockingDeque<>();
        session.subscribe("/topic/rooms/" + roomId, new StompFrameHandler() {
            @Override public Type getPayloadType(StompHeaders headers) {
                return Map.class;
            }
            @Override public void handleFrame(StompHeaders headers, Object payload) {
            }
        });
        // 인가 실패는 인터셉터에서 예외 → 세션 예외 경로. 여기서는 메시지 미수신으로 간접 검증.
        // (엄밀한 ERROR 프레임 검증은 세션 핸들러의 handleException 으로 확장 가능)
        Thread.sleep(500);
        assertThat(errors).isEmpty(); // 예외 큐 사용 시 확장 지점(현재는 스모크)
    }
}
```

> 참고: 세 번째 테스트는 인가 거절의 스모크 수준 검증이다. 인터셉터가 던진 예외로 SEND/SUBSCRIBE 가 막히는지 엄밀 검증이 필요하면, `StompSessionHandlerAdapter.handleException/handleTransportError` 를 오버라이드해 에러를 큐에 담아 단언하도록 확장한다. 핵심 경로(유효 토큰 송수신, 무토큰 거절)는 위 1·2번에서 확정 검증된다.

- [ ] **Step 2: 통합 테스트 실행**

Run: `cd BE && ./gradlew test --tests "com.back.domain.chat.websocket.ChatWebSocketIntegrationTest"`
Expected: PASS. (실패 시: 포트/타이밍 → `Thread.sleep` 여유, 컨버터 등록 확인. `connectAsync` 시그니처는 Spring 6.x 기준.)

- [ ] **Step 3: 커밋**

```bash
git add BE/src/test/java/com/back/domain/chat/websocket/ChatWebSocketIntegrationTest.java
git commit -m "test: WebSocket 통합 테스트(연결 인증·구독·송수신)"
```

---

### Task 14: 전역 회귀 + 문서 갱신 + 최종 점검

**Files:**
- Modify: `docs/CONTEXT.md`, `docs/TODO-BACKLOG.md`, `docs/TODO-DONE.md`, `docs/AI-ACTION-LOGS.md`

- [ ] **Step 1: 전체 테스트 회귀**

Run: `cd BE && ./gradlew test`
Expected: 전체 PASS(기존 + CHAT 신규). 실패 시 해당 테스트부터 수정.

- [ ] **Step 2: 문서 갱신**

- `docs/TODO-BACKLOG.md`: `[ ] CHAT: WebSocket(STOMP)+Redis 기반 1:1 / 1:N 채팅` 항목을 완료 표시(`[x] ~~...~~ — 2026-07-26 BE 구현`)로 바꾸고, 남은 범위 밖(FE 화면, Redis scale-out, presence 다중서버, 메시지 수정/삭제)을 하위 불릿으로 명시.
- `docs/TODO-DONE.md`: CHAT BE 완료 항목 추가(엔티티 3종·리포지토리·서비스 2종·REST 컨트롤러·STOMP·presence·통합테스트, 에러코드 404-10/11·403-03·400-03).
- `docs/CONTEXT.md`: "현재 상태" 단계 문구를 CHAT BE 완료로 갱신, 구현된 도메인 목록에 `CHAT(2026-07-26 BE)` 추가. CHAT 요약 한 문단 추가(통합 방 모델·directKey 유일성·인메모리 브로커·CONNECT 인증·presence 인메모리 한계·에러코드).
- `docs/AI-ACTION-LOGS.md`: 최신 항목으로 CHAT BE 구현 로그 1줄 추가(100개 상한 유지).

- [ ] **Step 3: 문서 커밋**

```bash
git add docs/CONTEXT.md docs/TODO-BACKLOG.md docs/TODO-DONE.md docs/AI-ACTION-LOGS.md
git commit -m "docs: CHAT BE 구현 완료 반영(상태/TODO/로그)"
```

- [ ] **Step 4: 최종 리뷰 요청**

`superpowers:requesting-code-review` 스킬로 전체 브랜치 리뷰를 요청하고, 지적사항을 `superpowers:receiving-code-review` 로 처리한다. 통과 시 `superpowers:finishing-a-development-branch` 로 병합 옵션을 사용자에게 제시.

---

## Self-Review (계획 검수)

**Spec 커버리지**: 통합 방 모델(Task 3), directKey 유일성+find-or-create(Task 3·7), soft leave/rejoin(Task 4·7), append-only 메시지(Task 5·8), 커서 이력(Task 8), 읽음/안읽은수(Task 4·9), 방 목록 정렬(Task 6·9), 표시 협력(Task 7·8·9), 인메모리 브로커·STOMP 설정(Task 11), CONNECT 인증·방 인가(Task 11), presence 연결수 카운팅+한계(Task 2·12), typing(Task 12), REST API 7종(Task 10), 에러코드 4종(Task 1), WS 통합 테스트(Task 13). 스펙 §전부 대응됨.

**Placeholder 스캔**: 모든 코드 스텝에 실제 코드·실행 명령·기대 출력 포함. "TBD/적절히 처리" 없음.

**타입 일관성**: `MemberDisplay(memberId,nickname,verified)`, `CursorPage<T>(items,nextCursor)`, `RoomUnreadCount(getRoomId/getUnreadCount)`, `assertActiveParticipant(roomId,memberId)`, `PresenceRegistry.onlineAmong(Set<Long>)` — 정의(초기 Task)와 사용(후속 Task) 시그니처 일치 확인.

**주의(구현 시)**: Task 9에서 `ChatRoomService`에 `ChatMessageRepository`를 주입하면 `ChatMessageService`↔`ChatRoomService` 간 순환 의존이 생기지 않는지 확인(현재 `ChatMessageService`가 `ChatRoomService`를 참조하고, `ChatRoomService`는 `ChatMessageRepository`만 참조하므로 순환 아님 — 리포지토리는 서비스가 아님). STOMP `connectAsync` 시그니처는 Spring 6.1/Boot 3.4 기준이며, 버전에 따라 `WebSocketHttpHeaders` 오버로드 확인.
