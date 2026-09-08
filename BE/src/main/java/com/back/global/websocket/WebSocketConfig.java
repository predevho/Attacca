package com.back.global.websocket;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
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

    /**
     * WS 핸드셰이크를 허용할 origin. 쉼표로 여러 개.
     *
     * <p>기본값은 로컬 개발 주소뿐이다. 예전에는 `*`였는데, 채팅은 REST와 달리 브라우저가
     * BE에 직접 연결하므로(BFF를 거치지 않는다) 이 값이 실제 접근 통제 역할을 한다.
     * 운영에서는 반드시 FE origin으로 좁힌다 — {@code WS_ALLOWED_ORIGINS=https://example.com}.
     */
    @Value("${app.ws.allowed-origins:http://localhost:3000,http://localhost:3001}")
    private String[] allowedOrigins;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns(allowedOrigins);
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
