package com.back.domain.verifiedperformer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 인증 연주자 신청 요청. {@code statement}는 필수, 증빙 링크는 최대 10개.
 * {@code evidenceUrls}가 null 이면 빈 목록으로 간주한다.
 */
public record ApplyRequest(
        @NotBlank(message = "지원 사유를 입력해 주세요.")
        @Size(max = 1000, message = "지원 사유는 1000자를 넘을 수 없습니다.") String statement,
        // 증빙 링크도 어드민 화면에서 <a href>로 그려진다. FE에만 가드가 있었는데
        // 저장 자체를 막지 않으면 다른 소비처가 생길 때 같은 구멍이 다시 열린다.
        @Size(max = 10, message = "증빙 링크는 최대 10개까지 첨부할 수 있습니다.")
        List<@Pattern(regexp = "^\\s*(https?://\\S+)?\\s*$",
                message = "증빙 링크는 http:// 또는 https:// 형식이어야 합니다.") String> evidenceUrls) {

    /** null 방어. 증빙 링크가 없으면 빈 목록으로 정규화한다. */
    public List<String> evidenceUrlsOrEmpty() {
        return evidenceUrls == null ? List.of() : evidenceUrls;
    }
}
