package com.back.global.security.session;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** 테스트 전용 in-memory refresh 세션 저장소. */
@Component
@ConditionalOnProperty(name = "app.auth.token-store", havingValue = "memory")
public class InMemoryRefreshSessionStore implements RefreshSessionStore {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String SESSION_PREFIX = "auth:refresh:";

    private final Map<String, SessionRecord> sessions = new ConcurrentHashMap<>();
    private final Map<Long, Set<String>> memberSessions = new ConcurrentHashMap<>();
    private final Duration ttl;

    @Autowired
    public InMemoryRefreshSessionStore(com.back.global.security.jwt.JwtProperties jwtProperties) {
        this(Duration.ofMillis(jwtProperties.refreshTokenExpiry()));
    }

    public InMemoryRefreshSessionStore(Duration ttl) {
        this.ttl = ttl;
    }

    @Override
    public String create(Long memberId) {
        String raw = newRawSessionId();
        String key = sessionKey(raw);
        sessions.put(key, new SessionRecord(memberId, Instant.now().plus(ttl)));
        memberSessions.computeIfAbsent(memberId, ignored -> ConcurrentHashMap.newKeySet()).add(key);
        return raw;
    }

    @Override
    public Optional<Long> findMemberId(String rawSessionId) {
        String key = sessionKey(rawSessionId);
        SessionRecord record = sessions.get(key);
        if (record == null || record.expiresAt().isBefore(Instant.now())) {
            revokeByKey(key, record == null ? null : record.memberId());
            return Optional.empty();
        }
        return Optional.of(record.memberId());
    }

    @Override
    public boolean revoke(String rawSessionId) {
        String key = sessionKey(rawSessionId);
        SessionRecord record = sessions.get(key);
        if (record == null) {
            return false;
        }
        revokeByKey(key, record.memberId());
        return true;
    }

    @Override
    public void revokeAll(Long memberId) {
        Set<String> keys = memberSessions.remove(memberId);
        if (keys != null) {
            keys.forEach(sessions::remove);
        }
    }

    Set<String> debugKeys() {
        return sessions.keySet();
    }

    Duration remainingTtl(String rawSessionId) {
        SessionRecord record = sessions.get(sessionKey(rawSessionId));
        return record == null ? Duration.ZERO : Duration.between(Instant.now(), record.expiresAt());
    }

    static String sessionKey(String rawSessionId) {
        return SESSION_PREFIX + sha256(rawSessionId);
    }

    private static String newRawSessionId() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm is unavailable", e);
        }
    }

    private void revokeByKey(String key, Long memberId) {
        sessions.remove(key);
        if (memberId == null) {
            return;
        }
        memberSessions.computeIfPresent(memberId, (ignored, keys) -> {
            keys.remove(key);
            return keys.isEmpty() ? null : keys;
        });
    }

    private record SessionRecord(Long memberId, Instant expiresAt) {
    }
}
