package com.back.domain.member.service;

import com.back.domain.member.entity.ConsentType;
import java.util.List;

/**
 * 동의 문서의 현재 버전. (DOMAIN-MEMBER-STATUTE §3.4)
 *
 * <p>문서를 고치면 이 값을 올린다. 그러면 이후 가입자는 새 버전에 동의한 것으로
 * 기록되고, 기존 회원의 이력은 그대로 남아 "그때 무엇에 동의했는가"가 보존된다.
 *
 * <p>FE의 약관·개인정보처리방침 페이지 상단 버전과 같아야 한다.
 */
public final class ConsentPolicy {

    /** 약관·개인정보처리방침 문서 버전. FE `lib/legal/policy.ts` 와 맞춘다. */
    public static final String CURRENT_VERSION = "2026-09-09";

    /** 가입 시 반드시 받아야 하는 동의. */
    public static final List<ConsentType> REQUIRED = List.of(ConsentType.TERMS, ConsentType.PRIVACY);

    private ConsentPolicy() {
    }
}
