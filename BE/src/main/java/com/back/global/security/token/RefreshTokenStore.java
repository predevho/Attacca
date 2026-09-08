package com.back.global.security.token;

/**
 * 유효한 refresh 토큰의 화이트리스트. 여기 없는 refresh는 거부된다.
 *
 * <p>인터페이스로 둔 이유는 두 가지다. 테스트가 Redis 없이 인메모리 구현으로 돌 수 있고,
 * 나중에 저장소를 바꿔도 인증 로직이 그대로 남는다.
 *
 * <p>구현은 <b>fail-closed</b>여야 한다. 저장소에 못 붙으면 "통과"가 아니라 예외를 던진다 —
 * 철회를 도입하는 목적이 무효화가 실제로 먹히게 하는 것인데, 장애 시 통과시키면
 * 저장소를 죽이는 것만으로 철회를 무력화할 수 있다.
 */
public interface RefreshTokenStore {

    /** 발급된 refresh를 유효 목록에 넣는다. */
    void save(Long memberId, String jti);

    /** 유효 목록에 있는가. 없으면 철회됐거나 이미 한 번 쓰인 것이다. */
    boolean exists(Long memberId, String jti);

    /** 하나만 무효화한다(로그아웃, 로테이션의 옛 토큰). */
    void remove(Long memberId, String jti);

    /** 그 회원의 모든 기기를 무효화한다(재사용 감지). */
    void removeAll(Long memberId);
}
