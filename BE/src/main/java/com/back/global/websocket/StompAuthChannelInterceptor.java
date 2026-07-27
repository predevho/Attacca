package com.back.global.websocket;

import com.back.domain.chat.repository.ChatParticipantRepository;
import com.back.global.security.jwt.JwtProvider;
import io.jsonwebtoken.Claims;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
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
            case SEND -> authorizeSend(accessor);
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

    /**
     * 클라이언트 SEND 는 애플리케이션 목적지(/app/**)로만 허용한다.
     * /topic, /user 등 브로커 목적지로의 SEND 는 SimpleBroker 가 구독자에게 그대로 릴레이하여
     * @MessageMapping 핸들러(참여자 검증·영속화)를 우회할 수 있으므로 차단한다.
     */
    private void authorizeSend(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith("/app/")) {
            throw new IllegalArgumentException("허용되지 않은 전송 대상입니다.");
        }
        authorize(accessor, destination, ROOM_PREFIX_APP);
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
