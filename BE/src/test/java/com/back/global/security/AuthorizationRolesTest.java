package com.back.global.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

class AuthorizationRolesTest {

    @Test
    void 관리자_권한이_있으면_관리자로_판별한다() {
        var authentication = new UsernamePasswordAuthenticationToken(1L, null,
                java.util.List.of(new SimpleGrantedAuthority(Role.ADMIN.authority())));

        assertThat(AuthorizationRoles.isAdmin(authentication)).isTrue();
    }

    @Test
    void 일반_회원은_관리자가_아니다() {
        var authentication = new UsernamePasswordAuthenticationToken(1L, null,
                java.util.List.of(new SimpleGrantedAuthority(Role.USER.authority())));

        assertThat(AuthorizationRoles.isAdmin(authentication)).isFalse();
    }
}
