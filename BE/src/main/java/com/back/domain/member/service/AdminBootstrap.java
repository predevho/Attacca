package com.back.domain.member.service;

import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.security.Role;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 기동 시 지정한 회원을 ADMIN으로 올린다. (DOMAIN-MEMBER-STATUTE §4.1)
 *
 * <p>이 기능이 없어서 배포된 서비스는 DB를 직접 고치지 않으면 <b>영영 공지를 못 올리고
 * 인증 연주자를 승인할 수 없었다.</b> 첫 어드민을 만들 방법이 코드에 없었다.
 *
 * <p>지키는 것 셋:
 * <ul>
 *   <li><b>올리기만 한다.</b> 목록에서 빠져도 강등하지 않는다 — 설정 한 줄로 운영자가
 *       조용히 사라지면 그게 더 위험하다.</li>
 *   <li><b>계정을 만들지 않는다.</b> 없는 loginId는 경고만 남긴다. 어드민 하나 때문에
 *       서비스 전체가 안 뜨는 것이 더 나쁘다.</li>
 *   <li><b>모든 승격을 로그로 남긴다.</b> 권한이 조용히 올라가는 일이 없어야 한다.</li>
 * </ul>
 *
 * <p>승격 후에는 다시 로그인해야 한다 — access 토큰(30분)에 role이 박혀 있다.
 */
@Component
@Slf4j
public class AdminBootstrap implements ApplicationRunner {

    private final MemberRepository memberRepository;
    private final List<String> loginIds;

    public AdminBootstrap(MemberRepository memberRepository,
            @Value("${app.admin.bootstrap-login-ids:}") List<String> loginIds) {
        this.memberRepository = memberRepository;
        this.loginIds = loginIds;
    }

    /**
     * ⚠️ `@Transactional` 이 여기 붙어 있어야 한다. 안쪽 메서드에 붙이고 여기서 부르면
     * **자기 호출이라 프록시를 거치지 않아 트랜잭션이 열리지 않고**, 더티 체킹으로
     * 올린 role 이 flush 되지 않는다(조용히 아무 일도 안 일어난다).
     */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        promoteAll();
    }

    /** 테스트에서 직접 부를 수 있도록 인자 없는 형태를 따로 둔다. */
    public void promoteAll() {
        // 환경변수는 사람이 손으로 적는다. "a, ,b" 같은 값이 들어온다.
        List<String> targets = loginIds.stream()
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .toList();
        if (targets.isEmpty()) {
            return;
        }

        for (String loginId : targets) {
            memberRepository.findByLoginId(loginId).ifPresentOrElse(
                    this::promoteIfNeeded,
                    () -> log.warn("어드민 부트스트랩: loginId '{}' 회원이 없어 건너뛴다. "
                            + "가입한 뒤 다시 띄우면 올라간다.", loginId));
        }
    }

    private void promoteIfNeeded(Member member) {
        if (member.getRole() == Role.ADMIN) {
            return;
        }
        member.promoteToAdmin();
        log.warn("어드민 부트스트랩: '{}'(id={}) 를 ADMIN 으로 올렸다. "
                + "본인은 다시 로그인해야 반영된다.", member.getLoginId(), member.getId());
    }
}
