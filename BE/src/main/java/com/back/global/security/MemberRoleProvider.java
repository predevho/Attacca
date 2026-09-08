package com.back.global.security;

/**
 * 회원의 현재 권한을 읽어오는 포트.
 *
 * <p>토큰 재발급은 refresh에 담긴 role을 믿지 않고 <b>지금의 role</b>을 다시 읽어야 한다.
 * 그러지 않으면 ADMIN에서 강등된 회원이 refresh 만료(14일)까지 계속 ADMIN access를 받는다.
 *
 * <p>인터페이스를 {@code global.security}에 두고 구현을 MEMBER 도메인에 두는 이유는
 * 의존 방향 때문이다 — {@code global}이 {@code domain}을 직접 참조하지 않는다
 * (ARCHITECTURE-CONSTITUTION §5).
 */
public interface MemberRoleProvider {

    /** 회원의 현재 권한. 회원이 없으면 {@code MEMBER_NOT_FOUND}. */
    Role findRole(Long memberId);
}
