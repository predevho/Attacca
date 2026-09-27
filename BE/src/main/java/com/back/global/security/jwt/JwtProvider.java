package com.back.global.security.jwt;

import com.back.global.security.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import javax.crypto.SecretKey;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

/**
 * access JWT 발급·파싱·인증 변환. HS256, self-issued.
 */
@Component
public class JwtProvider {

    private static final long ONBOARDING_TICKET_EXPIRY = 10 * 60 * 1000L;

    private final SecretKey key;
    private final long accessTokenExpiry;

    public JwtProvider(JwtProperties properties) {
        this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpiry = properties.accessTokenExpiry();
    }

    public String createAccessToken(Long userId, Role role) {
        return createToken(userId, role, "access", accessTokenExpiry);
    }

    public String createOnboardingTicket(Long userId, Role role) {
        return createToken(userId, role, "onboarding", ONBOARDING_TICKET_EXPIRY);
    }

    private String createToken(Long userId, Role role, String type, long expiryMillis) {
        Date now = new Date();
        var builder = Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("role", role.authority())
                .claim("type", type)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiryMillis));
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
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(userId, null, authorities);
        authentication.setDetails(claims.get("type", String.class));
        return authentication;
    }
}
