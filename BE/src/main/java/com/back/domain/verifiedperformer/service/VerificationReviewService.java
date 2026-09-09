package com.back.domain.verifiedperformer.service;

import com.back.domain.member.dto.MemberDisplay;
import com.back.domain.member.service.MemberQueryService;
import com.back.domain.verifiedperformer.dto.ApplicationResponse;
import com.back.domain.verifiedperformer.entity.VerificationStatus;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 어드민 심사 화면이 필요로 하는 읽기 조합. 신청 목록에 신청자 표시정보를 붙인다.
 *
 * <p><b>왜 별도 서비스인가</b> — {@code MemberQueryService}는 인증 뱃지를 채우려고
 * {@code VerifiedPerformerService}를 이미 주입받는다. 그래서 반대 방향을 더하면
 * <b>순환 참조</b>가 되어 앱이 기동하지 않는다. 컨트롤러에서 두 서비스를 합치는 방법도 있으나
 * "도메인 간 협력은 서비스 계층을 통해서만"(ARCHITECTURE-STATUTE §63)에 어긋난다.
 * 그래서 두 서비스를 아래로 두는 조합 전용 서비스를 둔다.
 */
@Service
@RequiredArgsConstructor
public class VerificationReviewService {

    private final VerifiedPerformerService verifiedPerformerService;
    private final MemberQueryService memberQueryService;

    /** 상태별 신청 목록 + 신청자 표시정보(배치 조회라 N+1 없음). */
    @Transactional(readOnly = true)
    public Page<ApplicationResponse> getApplications(VerificationStatus status, Pageable pageable) {
        Page<ApplicationResponse> page = verifiedPerformerService.getApplications(status, pageable);
        Set<Long> memberIds = page.getContent().stream()
                .map(ApplicationResponse::memberId).collect(Collectors.toSet());
        Map<Long, MemberDisplay> displays = memberQueryService.findDisplaysByIds(memberIds);
        // 탈퇴 등으로 표시정보가 없으면 null 그대로 둔다 — 화면이 회원 번호로 되돌아간다.
        return page.map(a -> a.withApplicant(displays.get(a.memberId())));
    }
}
