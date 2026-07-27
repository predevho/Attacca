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
