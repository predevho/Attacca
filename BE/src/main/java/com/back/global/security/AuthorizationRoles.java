package com.back.global.security;

import org.springframework.security.core.Authentication;

/** 현재 인증의 역할을 조회하는 공통 규칙. */
public final class AuthorizationRoles {

    private AuthorizationRoles() {
    }

    public static boolean isAdmin(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals(Role.ADMIN.authority()));
    }
}
