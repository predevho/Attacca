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
