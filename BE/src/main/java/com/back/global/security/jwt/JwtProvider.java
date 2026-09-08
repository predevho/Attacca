package com.back.global.security.jwt;

import com.back.global.security.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

/**
 * JWT 발급·파싱·인증 변환. HS256, self-issued.
 * 무상태 재발급을 위해 refresh 에도 role claim 을 담는다.
 */
@Component
public class JwtProvider {

    private final SecretKey key;
    private final long accessTokenExpiry;
    private final long refreshTokenExpiry;

    public JwtProvider(JwtProperties properties) {
        this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpiry = properties.accessTokenExpiry();
        this.refreshTokenExpiry = properties.refreshTokenExpiry();
    }

    public String createAccessToken(Long userId, Role role) {
        return createToken(userId, role, "access", accessTokenExpiry, null);
    }

    /**
     * refresh 발급. {@code jti}는 이 토큰의 고유 식별자이며 서버 화이트리스트의 키가 된다
     * (DOMAIN-COMMON-STATUTE §4.1). 호출자가 만들어 넘기고, 같은 값을 저장소에 넣어야 한다.
     */
    public String createRefreshToken(Long userId, Role role, String jti) {
        return createToken(userId, role, "refresh", refreshTokenExpiry, jti);
    }

    /** 새 jti를 만든다. 발급과 저장이 같은 값을 쓰도록 여기서 한 곳에 모아 둔다. */
    public String newJti() {
        return UUID.randomUUID().toString();
    }

    /** refresh의 jti. 없으면 null(로테이션 도입 전에 발급된 옛 토큰). */
    public String getJti(Claims claims) {
        return claims.getId();
    }

    private String createToken(Long userId, Role role, String type, long expiryMillis, String jti) {
        Date now = new Date();
        var builder = Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("role", role.authority())
                .claim("type", type)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiryMillis));
        if (jti != null) {
            builder.id(jti);
        }
        return builder.signWith(key).compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Authentication getAuthentication(Claims claims) {
        Long userId = Long.valueOf(claims.getSubject());
        String role = claims.get("role", String.class);
        List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority(role));
        return new UsernamePasswordAuthenticationToken(userId, null, authorities);
    }
}
