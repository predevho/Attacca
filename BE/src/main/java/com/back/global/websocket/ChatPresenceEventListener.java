package com.back.global.websocket;

import com.back.domain.chat.entity.ChatParticipant;
import com.back.domain.chat.repository.ChatParticipantRepository;
import java.security.Principal;
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

    private Long memberId(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken token
                && token.getPrincipal() instanceof Long id) {
            return id;
        }
        return null;
    }
}
