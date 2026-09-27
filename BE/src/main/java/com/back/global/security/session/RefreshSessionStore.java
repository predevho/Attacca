package com.back.global.security.session;

import java.util.Optional;

/**
 * 브라우저의 불투명 refresh 세션을 서버에서 관리한다.
 *
 * <p>원문 세션 ID는 저장하지 않으며, 저장소 장애는 인증을 통과시키지 않는다.
 */
public interface RefreshSessionStore {

    String create(Long memberId);

    Optional<Long> findMemberId(String rawSessionId);

    boolean revoke(String rawSessionId);

    void revokeAll(Long memberId);
}
