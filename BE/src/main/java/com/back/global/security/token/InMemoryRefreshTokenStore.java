package com.back.global.security.token;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Redis 없이 도는 화이트리스트. {@code app.auth.token-store=memory} 일 때만 등록되며
 * 테스트와 Redis 없는 로컬 실행용이다.
 *
 * <p><b>운영에 쓰면 안 된다.</b> 프로세스 메모리라 재시작하면 전원 로그아웃되고,
 * 서버가 둘 이상이면 서로 다른 목록을 보게 된다.
 */
@Component
@ConditionalOnProperty(name = "app.auth.token-store", havingValue = "memory")
public class InMemoryRefreshTokenStore implements RefreshTokenStore {

    private final Map<Long, Set<String>> store = new ConcurrentHashMap<>();

    @Override
    public void save(Long memberId, String jti) {
        store.computeIfAbsent(memberId, id -> ConcurrentHashMap.newKeySet()).add(jti);
    }

    @Override
    public boolean exists(Long memberId, String jti) {
        return store.getOrDefault(memberId, Set.of()).contains(jti);
    }

    @Override
    public void remove(Long memberId, String jti) {
        Set<String> jtis = store.get(memberId);
        if (jtis != null) {
            jtis.remove(jti);
        }
    }

    @Override
    public void removeAll(Long memberId) {
        store.remove(memberId);
    }
}
