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
