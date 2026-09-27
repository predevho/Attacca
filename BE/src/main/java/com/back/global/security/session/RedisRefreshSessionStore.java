package com.back.global.security.session;

import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import com.back.global.security.jwt.JwtProperties;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/** Redis 기반 refresh 세션 저장소. 원문 세션 ID가 아닌 SHA-256 값만 키에 사용한다. */
@Component
@ConditionalOnProperty(name = "app.auth.token-store", havingValue = "redis", matchIfMissing = true)
public class RedisRefreshSessionStore implements RefreshSessionStore {

    private static final String MEMBER_PREFIX = "auth:refresh:member:";
    private static final DefaultRedisScript<Long> CREATE = script(
            "redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]); "
                    + "redis.call('SADD', KEYS[2], KEYS[1]); "
                    + "redis.call('PEXPIRE', KEYS[2], ARGV[2]); return 1;");
    private static final DefaultRedisScript<Long> REVOKE = script(
            "local memberId = redis.call('GET', KEYS[1]); "
                    + "if not memberId then return 0 end; "
                    + "redis.call('DEL', KEYS[1]); redis.call('SREM', KEYS[2], KEYS[1]); "
                    + "if redis.call('SCARD', KEYS[2]) == 0 then redis.call('DEL', KEYS[2]) end; return 1;");
    private static final DefaultRedisScript<Long> REVOKE_ALL = script(
            "local keys = redis.call('SMEMBERS', KEYS[1]); "
                    + "for _, key in ipairs(keys) do redis.call('DEL', key); end; "
                    + "return redis.call('DEL', KEYS[1]);");

    private final StringRedisTemplate redis;
    private final Duration ttl;

    public RedisRefreshSessionStore(StringRedisTemplate redis, JwtProperties jwtProperties) {
        this.redis = redis;
        this.ttl = Duration.ofMillis(jwtProperties.refreshTokenExpiry());
    }

    @Override
    public String create(Long memberId) {
        String raw = createRawSessionId();
        run(() -> redis.execute(CREATE, List.of(sessionKey(raw), memberKey(memberId)), memberId.toString(),
                Long.toString(ttl.toMillis())));
        return raw;
    }

    @Override
    public Optional<Long> findMemberId(String rawSessionId) {
        return Optional.ofNullable(run(() -> redis.opsForValue().get(sessionKey(rawSessionId))))
                .map(Long::valueOf);
    }

    @Override
    public boolean revoke(String rawSessionId) {
        String key = sessionKey(rawSessionId);
        String memberId = run(() -> redis.opsForValue().get(key));
        if (memberId == null) {
            return false;
        }
        return Long.valueOf(1L).equals(run(() -> redis.execute(REVOKE, List.of(key, memberKey(Long.valueOf(memberId))))));
    }

    @Override
    public void revokeAll(Long memberId) {
        run(() -> redis.execute(REVOKE_ALL, List.of(memberKey(memberId))));
    }

    private static DefaultRedisScript<Long> script(String source) {
        DefaultRedisScript<Long> script = new DefaultRedisScript<>();
        script.setScriptText(source);
        script.setResultType(Long.class);
        return script;
    }

    private static String createRawSessionId() {
        byte[] bytes = new byte[32];
        new java.security.SecureRandom().nextBytes(bytes);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sessionKey(String rawSessionId) {
        return "auth:refresh:" + InMemoryRefreshSessionStore.sha256(rawSessionId);
    }

    private static String memberKey(Long memberId) {
        return MEMBER_PREFIX + memberId;
    }

    private <T> T run(java.util.function.Supplier<T> action) {
        try {
            return action.get();
        } catch (DataAccessException e) {
            throw new BusinessException(ErrorCode.TOKEN_STORE_UNAVAILABLE, e);
        }
    }
}
