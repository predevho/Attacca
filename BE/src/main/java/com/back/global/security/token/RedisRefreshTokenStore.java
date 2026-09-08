package com.back.global.security.token;

import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Redis Set 기반 화이트리스트. 키는 {@code rt:{memberId}}, 멤버는 refresh의 jti.
 *
 * <p>Set 하나로 다중 기기가 자연히 지원되고(기기마다 jti가 하나씩), 전 기기 무효화가 DEL 한 번이다.
 * 멤버별 TTL은 Redis Set이 지원하지 않지만, 만료된 jti는 refresh JWT 자체의 exp 검증에서
 * 먼저 걸리므로 문제가 되지 않는다. 남은 찌꺼기는 키 전체 TTL로 정리된다.
 */
@Component
@ConditionalOnProperty(name = "app.auth.token-store", havingValue = "redis", matchIfMissing = true)
public class RedisRefreshTokenStore implements RefreshTokenStore {

    private static final String KEY_PREFIX = "rt:";

    private final StringRedisTemplate redis;
    private final Duration ttl;

    public RedisRefreshTokenStore(StringRedisTemplate redis,
            com.back.global.security.jwt.JwtProperties jwtProperties) {
        this.redis = redis;
        this.ttl = Duration.ofMillis(jwtProperties.refreshTokenExpiry());
    }

    private String key(Long memberId) {
        return KEY_PREFIX + memberId;
    }

    @Override
    public void save(Long memberId, String jti) {
        run(() -> {
            redis.opsForSet().add(key(memberId), jti);
            // 새 토큰이 들어올 때마다 키 수명을 갱신한다. 활동 중인 계정이 갑자기 잘리지 않게.
            redis.expire(key(memberId), ttl);
            return null;
        });
    }

    @Override
    public boolean exists(Long memberId, String jti) {
        return Boolean.TRUE.equals(run(() -> redis.opsForSet().isMember(key(memberId), jti)));
    }

    @Override
    public void remove(Long memberId, String jti) {
        run(() -> redis.opsForSet().remove(key(memberId), jti));
    }

    @Override
    public void removeAll(Long memberId) {
        run(() -> redis.delete(key(memberId)));
    }

    /**
     * Redis 장애를 통과시키지 않는다(fail-closed).
     * 여기서 예외를 삼키면 저장소를 죽이는 것만으로 철회가 무력화된다.
     */
    private <T> T run(java.util.function.Supplier<T> action) {
        try {
            return action.get();
        } catch (DataAccessException e) {
            throw new BusinessException(ErrorCode.TOKEN_STORE_UNAVAILABLE, e);
        }
    }
}
