package com.back.domain.member.dto;

/**
 * 비인증 경로에 노출하는 회원 표시정보. 닉네임과 인증 뱃지뿐이고 <b>회원 id를 담지 않는다.</b>
 *
 * <p>{@link MemberDisplay}를 공개 응답에 그대로 쓰면 안 되는 이유가 여기 있다 —
 * 그 레코드는 {@code @JsonProperty("id")}로 회원 id를 직렬화한다. 공개 경로에서 회원 식별자는
 * 나가지 않는다는 것이 고정 규칙이라(DOMAIN-NOTICE-STATUTE §6), 공개용 투영을 따로 둔다.
 *
 * <p>표시정보 자체를 노출할지는 도메인이 판단한다. 공연·게시글은 주최자/작성자가 콘텐츠의 일부라
 * 노출하고, 공지는 개인 명의가 아니라 운영 주체의 발언이므로 아예 담지 않는다.
 */
public record PublicMemberDisplay(String nickname, boolean verified) {

    /** 내부 표시정보에서 공개 가능한 필드만 추린다. 조회 대상이 없으면 null. */
    public static PublicMemberDisplay from(MemberDisplay display) {
        return display == null
                ? null
                : new PublicMemberDisplay(display.nickname(), display.verified());
    }
}
