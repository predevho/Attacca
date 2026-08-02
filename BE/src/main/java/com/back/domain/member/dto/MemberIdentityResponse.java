package com.back.domain.member.dto;

import com.back.global.security.Role;

/**
 * 현재 사용자 신원 응답. 프로필(악기/소개)과 분리된 공용 신원 소스다.
 * FE가 작성자 판정(수정/삭제 버튼 노출)과 어드민 판정에 사용한다.
 * {@code verified}는 VERIFIED-PERFORMER 도메인이 제공하는 파생 뱃지다.
 */
public record MemberIdentityResponse(Long id, String nickname, Role role, boolean verified) {
}
