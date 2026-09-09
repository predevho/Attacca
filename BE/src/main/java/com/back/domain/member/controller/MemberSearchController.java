package com.back.domain.member.controller;

import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.service.MemberQueryService;
import com.back.global.common.ApiResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 닉네임으로 회원 찾기. CHAT이 1:1 대화 상대를 고르는 데 쓴다. (STATUTE §3.2.1)
 *
 * <p>회원 목록을 여는 경로라 <b>인증이 필요</b>하며(공개 경로 아래 두지 않는다),
 * 응답은 {@link MemberDisplay}(닉네임·인증뱃지)뿐이다 — 이메일·로그인 id는 싣지 않는다.
 */
@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberSearchController {

    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 20;

    private final MemberQueryService memberQueryService;

    @GetMapping("/search")
    public ApiResponse<List<MemberDisplay>> search(@AuthenticationPrincipal Long memberId,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "" + DEFAULT_SIZE) int size) {
        return ApiResponse.success(
                memberQueryService.searchDisplaysByNickname(q, memberId, clamp(size)));
    }

    /** 페이징을 주지 않으므로 상한만 둔다. 더 보려면 더 정확히 입력하게 한다. */
    private int clamp(int size) {
        return Math.max(1, Math.min(size, MAX_SIZE));
    }
}
