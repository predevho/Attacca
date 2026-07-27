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
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.InterceptableChannel;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

/**
 * STOMP 실제 소켓 통합 테스트.
 * REST 는 MockMvc 로 충분하지만 STOMP 는 실제 연결이 필요하다:
 * WebSocketStompClient 로 RANDOM_PORT 서버에 붙어 CONNECT 인증 -> 구독/발행 인가 -> 송수신을 검증한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ChatWebSocketIntegrationTest {

    @LocalServerPort int port;
    @Autowired ChatRoomService roomService;
    @Autowired MemberRepository memberRepository;
    @Autowired JwtProvider jwtProvider;
    @Autowired @Qualifier("clientInboundChannel") MessageChannel clientInboundChannel;

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

        // @SpringBootTest(RANDOM_PORT) 전체 통합 테스트는 실제 WebSocket 스레드에서 DB 를 커밋하므로
        // 테스트 트랜잭션 롤백(@Transactional)을 쓸 수 없다(스레드 간 트랜잭션 미공유로 참여자 조회 실패).
        // 대신 매 테스트마다 loginId/email/nickname 이 겹치지 않도록 고유 접미사를 붙인다.
        String suffix = java.util.UUID.randomUUID().toString().substring(0, 8);
        alice = memberRepository.save(Member.createLocal("alice" + suffix, "pw", "a" + suffix + "@x.com", "앨리스" + suffix)).getId();
        bob = memberRepository.save(Member.createLocal("bob" + suffix, "pw", "b" + suffix + "@x.com", "밥" + suffix)).getId();
        carol = memberRepository.save(Member.createLocal("carol" + suffix, "pw", "c" + suffix + "@x.com", "캐럴" + suffix)).getId();
        aliceToken = jwtProvider.createAccessToken(alice, Role.USER);
        bobToken = jwtProvider.createAccessToken(bob, Role.USER);
        carolToken = jwtProvider.createAccessToken(carol, Role.USER);

        ChatRoomResponse room = roomService.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob), null));
        roomId = room.id();
    }

    private StompSession connect(String token) throws Exception {
        return connectWithHandler(token, new StompSessionHandlerAdapter() {});
    }

    private StompSession connectWithHandler(String token, StompSessionHandlerAdapter handler) throws Exception {
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);
        return stompClient.connectAsync("ws://localhost:" + port + "/ws",
                        new WebSocketHttpHeaders(), connectHeaders, handler)
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
        // ExecutionException 은 서버가 CONNECT 를 실제로 능동 거부했다는 뜻이다.
        // TimeoutException 이면 서버가 아무 응답 없이 그냥 멈춰버린 것(행)이므로 이 케이스는 반드시 배제한다.
        assertThatThrownBy(() -> stompClient.connectAsync("ws://localhost:" + port + "/ws",
                        new StompSessionHandlerAdapter() {})
                .get(3, TimeUnit.SECONDS))
                .isInstanceOf(ExecutionException.class)
                .isNotInstanceOf(TimeoutException.class);
    }

    /**
     * 비참여자(carol)가 참여자만 접근 가능한 방을 구독하면 StompAuthChannelInterceptor 가
     * preSend 에서 예외를 던지고, 서버는 STOMP ERROR 프레임을 보낸 뒤 연결을 끊는다.
     *
     * Spring 의 DefaultStompSession 은 ERROR 프레임을 "구독별 핸들러"가 아니라
     * connect() 시 넘긴 세션 레벨 StompSessionHandler.handleFrame(...) 으로 전달한다
     * (구독 프레임 핸들러는 MESSAGE 프레임 전용). 따라서 이 테스트는 구독 핸들러가 아니라
     * connect 에 넘기는 세션 핸들러의 handleFrame/handleException/handleTransportError 를
     * 오버라이드해 예외 큐에 담아 "실제로 거부되었는지"를 직접 단언한다.
     */
    @Test
    void 비참여자가_방을_구독하면_ERROR로_끊긴다() throws Exception {
        // STOMP ERROR 프레임은 (Spring 6.2 기준, 검증 완료) 클라이언트에 "message" 헤더로
        // AbstractMessageChannel 이 감싼 일반 문구("Failed to send message to ...")만 실어 보내고
        // 바디는 비워 보낸다 — 원본 IllegalArgumentException("채팅방 참여자만 접근할 수 있습니다.")의
        // 메시지는 와이어로 전달되지 않는다(NestedRuntimeException 이 getMessage() 를 오버라이드하지
        // 않으므로 cause 텍스트가 합성되지 않음). 따라서 "정말 참여자 인가 실패인지"는 와이어가 아니라
        // 서버 쪽 clientInboundChannel 에 임시 ChannelInterceptor 를 index 0(=StompAuthChannelInterceptor
        // 보다 앞)에 꽂아 afterSendCompletion 으로 원본 예외를 직접 캡처해 검증한다.
        // 이 인터셉터는 이 테스트 안에서만 추가/제거되며 production 코드는 건드리지 않는다.
        BlockingQueue<Throwable> errors = new LinkedBlockingDeque<>();
        BlockingQueue<Throwable> serverSideAuthFailures = new LinkedBlockingDeque<>();
        ChannelInterceptor authFailureCapture = new ChannelInterceptor() {
            @Override
            public void afterSendCompletion(Message<?> message, MessageChannel channel, boolean sent,
                    Exception ex) {
                if (ex != null) {
                    serverSideAuthFailures.add(ex);
                }
            }
        };
        InterceptableChannel interceptableChannel = (InterceptableChannel) clientInboundChannel;
        interceptableChannel.addInterceptor(0, authFailureCapture);

        StompSessionHandlerAdapter errorCapturingHandler = new StompSessionHandlerAdapter() {
            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                // 세션 레벨 핸들러로 오는 프레임은 이 시나리오에서 서버발 STOMP ERROR 뿐이다.
                // Spring 의 StompSubProtocolHandler.sendErrorMessage 는 예외 메시지를 프레임
                // 바디가 아니라 "message" 네이티브 헤더(accessor.setMessage(ex.getMessage()))에
                // 담고 바디는 빈 값으로 보내므로, 인가 실패 문구는 payload 가 아니라 헤더에서 읽어야 한다.
                String body = (payload instanceof byte[] bytes)
                        ? new String(bytes, StandardCharsets.UTF_8)
                        : String.valueOf(payload);
                String messageHeader = headers.getFirst("message");
                errors.add(new IllegalStateException(
                        "STOMP ERROR 수신: message=" + messageHeader + ", body=" + body));
            }

            @Override
            public void handleException(StompSession session, StompCommand command, StompHeaders headers,
                    byte[] payload, Throwable exception) {
                errors.add(exception);
            }

            @Override
            public void handleTransportError(StompSession session, Throwable exception) {
                errors.add(exception);
            }
        };

        try {
            StompSession carolSession = connectWithHandler(carolToken, errorCapturingHandler); // carol 은 이 방 참여자 아님
            carolSession.subscribe("/topic/rooms/" + roomId, new StompFrameHandler() {
                @Override public Type getPayloadType(StompHeaders headers) {
                    return Map.class;
                }
                @Override public void handleFrame(StompHeaders headers, Object payload) {
                    // 정상적으로는 도달하지 않아야 한다(구독 자체가 거부됨).
                }
            });

            Throwable error = errors.poll(3, TimeUnit.SECONDS);
            assertThat(error)
                    .as("비참여자의 구독 시도는 인터셉터가 거부해 ERROR 프레임/예외로 이어져야 한다")
                    .isNotNull();

            // 단순히 "무언가" 실패한 게 아니라 StompAuthChannelInterceptor.authorize 가 던지는
            // "채팅방 참여자만 접근할 수 있습니다." 인가 실패인지까지 확인한다.
            // 위에서 확인했듯 와이어로 온 error 자체는 일반화된 문구뿐이라 이 문자열을 담고 있지
            // 않으므로, authFailureCapture 인터셉터가 서버에서 직접 캡처한 원본 예외로 검증한다.
            Throwable serverSideError = serverSideAuthFailures.poll(3, TimeUnit.SECONDS);
            assertThat(serverSideError)
                    .as("서버 clientInboundChannel 에서 인가 실패 예외가 실제로 발생해야 한다")
                    .isNotNull();
            assertThat(allMessagesInCauseChain(serverSideError))
                    .as("서버에서 캡처한 예외(또는 cause 체인)는 '참여자' 인가 실패 메시지를 포함해야 한다")
                    .contains("참여자");
        } finally {
            // 다른 테스트/공유 스프링 컨텍스트에 영향이 남지 않도록 반드시 제거한다.
            interceptableChannel.removeInterceptor(authFailureCapture);
        }

        // carol 이 거부된 뒤에도 실제 참여자(alice/bob) 경로는 정상 동작함을 재확인한다.
        // (test 3 이 우연히 통과하는 vacuous 단언이 아님을 보장하기 위한 대조군)
        // alice 를 bob 의 구독보다 먼저 연결해 둔다: CONNECT 시 ChatPresenceEventListener 가
        // 같은 방에 PRESENCE 브로드캐스트를 보내는데, 구독 이후에 새로 연결하면 그 프레임이
        // 실제 채팅 메시지보다 먼저 도착해 큐를 오염시킬 수 있기 때문이다.
        StompSession aliceSession = connect(aliceToken);
        StompSession bobSession = connect(bobToken);
        BlockingQueue<Map> received = new LinkedBlockingDeque<>();
        bobSession.subscribe("/topic/rooms/" + roomId, new StompFrameHandler() {
            @Override public Type getPayloadType(StompHeaders headers) {
                return Map.class;
            }
            @Override public void handleFrame(StompHeaders headers, Object payload) {
                // PRESENCE 브로드캐스트(온라인/오프라인 알림) 등 채팅 메시지가 아닌 프레임은 무시한다.
                if (payload instanceof Map<?, ?> map && map.containsKey("content")) {
                    received.add((Map) map);
                }
            }
        });
        Thread.sleep(300); // 구독 반영 대기

        aliceSession.send("/app/rooms/" + roomId + "/send", Map.of("content", "여전히 정상 동작"));

        Map message = received.poll(3, TimeUnit.SECONDS);
        assertThat(message).isNotNull();
        assertThat(message.get("content")).isEqualTo("여전히 정상 동작");
    }

    /**
     * 참여자(alice)라도 클라이언트가 브로커 목적지(/topic/rooms/{id})로 직접 SEND 하면
     * StompAuthChannelInterceptor.authorizeSend 가 "/app/" 접두사가 아니라는 이유로 거부해야 한다.
     * 이 경로가 막혀 있지 않으면 SimpleBroker 가 SEND 를 구독자에게 그대로 릴레이해
     * @MessageMapping 핸들러(참여자 검증·영속화)를 완전히 우회하게 된다 — 이번 수정의 핵심 시나리오.
     *
     * 검증 방식은 test 3(비참여자 구독 거부)과 동일하게, 와이어로 오는 STOMP ERROR 는 일반화된
     * 문구뿐이므로 서버 clientInboundChannel 에 임시 인터셉터를 꽂아 원본 예외를 직접 캡처한다.
     */
    @Test
    void 참여자여도_브로커목적지로_직접SEND하면_거부된다() throws Exception {
        BlockingQueue<Throwable> errors = new LinkedBlockingDeque<>();
        BlockingQueue<Throwable> serverSideFailures = new LinkedBlockingDeque<>();
        ChannelInterceptor sendFailureCapture = new ChannelInterceptor() {
            @Override
            public void afterSendCompletion(Message<?> message, MessageChannel channel, boolean sent,
                    Exception ex) {
                if (ex != null) {
                    serverSideFailures.add(ex);
                }
            }
        };
        InterceptableChannel interceptableChannel = (InterceptableChannel) clientInboundChannel;
        interceptableChannel.addInterceptor(0, sendFailureCapture);

        StompSessionHandlerAdapter errorCapturingHandler = new StompSessionHandlerAdapter() {
            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                String body = (payload instanceof byte[] bytes)
                        ? new String(bytes, StandardCharsets.UTF_8)
                        : String.valueOf(payload);
                String messageHeader = headers.getFirst("message");
                errors.add(new IllegalStateException(
                        "STOMP ERROR 수신: message=" + messageHeader + ", body=" + body));
            }

            @Override
            public void handleException(StompSession session, StompCommand command, StompHeaders headers,
                    byte[] payload, Throwable exception) {
                errors.add(exception);
            }

            @Override
            public void handleTransportError(StompSession session, Throwable exception) {
                errors.add(exception);
            }
        };

        try {
            // alice 는 이 방의 정당한 참여자이지만, 브로커 목적지(/topic/...)로 직접 SEND 하는 것 자체가 금지된다.
            StompSession aliceSession = connectWithHandler(aliceToken, errorCapturingHandler);
            aliceSession.send("/topic/rooms/" + roomId, Map.of("content", "위조 메시지"));

            Throwable error = errors.poll(3, TimeUnit.SECONDS);
            assertThat(error)
                    .as("브로커 목적지로의 직접 SEND 는 인터셉터가 거부해 ERROR 프레임/예외로 이어져야 한다")
                    .isNotNull();

            Throwable serverSideError = serverSideFailures.poll(3, TimeUnit.SECONDS);
            assertThat(serverSideError)
                    .as("서버 clientInboundChannel 에서 SEND 거부 예외가 실제로 발생해야 한다")
                    .isNotNull();
            assertThat(allMessagesInCauseChain(serverSideError))
                    .as("서버에서 캡처한 예외(또는 cause 체인)는 '허용되지 않은 전송 대상' 문구를 포함해야 한다")
                    .contains("허용되지 않은 전송 대상");
        } finally {
            interceptableChannel.removeInterceptor(sendFailureCapture);
        }

        // 브로커 목적지 SEND 가 거부된 뒤에도 정상적인 /app/ 경로 SEND 는 여전히 동작함을 재확인한다
        // (인터셉터가 과도하게 막아버려 test 1 이 우연히 통과하는 게 아님을 보장하는 대조군).
        StompSession aliceSession2 = connect(aliceToken);
        StompSession bobSession = connect(bobToken);
        BlockingQueue<Map> received = new LinkedBlockingDeque<>();
        bobSession.subscribe("/topic/rooms/" + roomId, new StompFrameHandler() {
            @Override public Type getPayloadType(StompHeaders headers) {
                return Map.class;
            }
            @Override public void handleFrame(StompHeaders headers, Object payload) {
                if (payload instanceof Map<?, ?> map && map.containsKey("content")) {
                    received.add((Map) map);
                }
            }
        });
        Thread.sleep(300); // 구독 반영 대기

        aliceSession2.send("/app/rooms/" + roomId + "/send", Map.of("content", "정상 경로는 여전히 동작"));

        Map message = received.poll(3, TimeUnit.SECONDS);
        assertThat(message).isNotNull();
        assertThat(message.get("content")).isEqualTo("정상 경로는 여전히 동작");
    }

    /**
     * throwable 자신의 메시지부터 시작해 getCause() 체인을 끝까지 따라가며
     * 모든 메시지를 하나의 문자열로 이어붙인다.
     * STOMP ERROR 는 handleFrame(바디 문자열을 담은 IllegalStateException)로 오거나
     * handleException/handleTransportError(원본 예외 혹은 그 cause)로 올 수 있어
     * 메시지가 어느 depth 에 있는지 특정할 수 없으므로, 체인 전체를 대상으로 검사한다.
     */
    private static String allMessagesInCauseChain(Throwable throwable) {
        StringBuilder combined = new StringBuilder();
        Throwable current = throwable;
        while (current != null) {
            if (current.getMessage() != null) {
                combined.append(current.getMessage()).append(" | ");
            }
            Throwable cause = current.getCause();
            current = (cause == current) ? null : cause; // 자기참조 cause 로 인한 무한루프 방지
        }
        return combined.toString();
    }
}
