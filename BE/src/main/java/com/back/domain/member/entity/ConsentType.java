package com.back.domain.member.entity;

/**
 * 동의 종류. 둘 다 필수다 — 선택 동의(마케팅 등)는 두지 않는다.
 * 보내는 것이 없으므로 받을 이유가 없다. (DOMAIN-MEMBER-STATUTE §3.4)
 */
public enum ConsentType {
    /** 이용약관 */
    TERMS,
    /** 개인정보 수집·이용 */
    PRIVACY
}
