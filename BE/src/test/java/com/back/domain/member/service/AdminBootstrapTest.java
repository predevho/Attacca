package com.back.domain.member.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.security.Role;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

/**
 * 어드민 부트스트랩 (DOMAIN-MEMBER-STATUTE §4.1).
 *
 * <p>이 기능이 없어서 배포된 서비스는 DB를 직접 고치지 않으면 영영 공지를 못 올리고
 * 인증 연주자를 승인할 수 없었다.
 */
@DataJpaTest
class AdminBootstrapTest {

    @Autowired
    private MemberRepository memberRepository;

    private AdminBootstrap bootstrap(String... loginIds) {
        return new AdminBootstrap(memberRepository, List.of(loginIds));
    }

    private Member save(String loginId, Role role) {
        Member member = Member.createLocal(loginId, "hash", loginId + "@attacca.test", loginId);
        if (role == Role.ADMIN) {
            member.promoteToAdmin();
        }
        return memberRepository.save(member);
    }

    private Role roleOf(String loginId) {
        return memberRepository.findByLoginId(loginId).orElseThrow().getRole();
    }

    @Test
    @DisplayName("목록에 있는 회원을 ADMIN으로 올린다")
    void promotesListed() {
        save("owner", Role.USER);

        bootstrap("owner").promoteAll();

        assertThat(roleOf("owner")).isEqualTo(Role.ADMIN);
    }

    @Test
    @DisplayName("여러 명을 한 번에 올린다")
    void promotesSeveral() {
        save("first", Role.USER);
        save("second", Role.USER);

        bootstrap("first", "second").promoteAll();

        assertThat(roleOf("first")).isEqualTo(Role.ADMIN);
        assertThat(roleOf("second")).isEqualTo(Role.ADMIN);
    }

    @Test
    @DisplayName("목록에 없는 회원은 건드리지 않는다")
    void leavesOthersAlone() {
        save("owner", Role.USER);
        save("bystander", Role.USER);

        bootstrap("owner").promoteAll();

        assertThat(roleOf("bystander")).isEqualTo(Role.USER);
    }

    @Test
    @DisplayName("목록에서 빠져도 강등하지 않는다")
    void neverDemotes() {
        // 설정 한 줄로 운영자가 조용히 사라지면 그게 더 위험하다. 회수는 사람이 판단한다.
        save("former", Role.ADMIN);

        bootstrap("someoneelse").promoteAll();

        assertThat(roleOf("former")).isEqualTo(Role.ADMIN);
    }

    @Test
    @DisplayName("없는 loginId 때문에 기동이 막히지 않는다")
    void missingLoginIdDoesNotFail() {
        // 어드민 하나 때문에 서비스 전체가 안 뜨는 것이 더 나쁘다.
        // 가입한 뒤 다시 띄우면 올라간다.
        save("owner", Role.USER);

        assertThatCode(() -> bootstrap("owner", "notyetsignedup").promoteAll())
                .doesNotThrowAnyException();

        assertThat(roleOf("owner")).isEqualTo(Role.ADMIN);
        assertThat(memberRepository.findByLoginId("notyetsignedup")).isEmpty();
    }

    @Test
    @DisplayName("계정을 만들지 않는다")
    void neverCreatesAccounts() {
        long before = memberRepository.count();

        bootstrap("ghost").promoteAll();

        assertThat(memberRepository.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("목록이 비면 아무것도 하지 않는다")
    void doesNothingWhenEmpty() {
        save("owner", Role.USER);

        bootstrap().promoteAll();

        assertThat(roleOf("owner")).isEqualTo(Role.USER);
    }

    @Test
    @DisplayName("이미 ADMIN이면 그대로 둔다 — 여러 번 떠도 안전하다")
    void idempotent() {
        save("owner", Role.ADMIN);

        bootstrap("owner").promoteAll();
        bootstrap("owner").promoteAll();

        assertThat(roleOf("owner")).isEqualTo(Role.ADMIN);
    }

    @Test
    @DisplayName("앞뒤 공백과 빈 항목을 흘려보낸다")
    void toleratesSloppyInput() {
        // 환경변수는 사람이 손으로 적는다. "a, ,b" 같은 값이 들어온다.
        save("owner", Role.USER);

        bootstrap(" owner ", "", "  ").promoteAll();

        assertThat(roleOf("owner")).isEqualTo(Role.ADMIN);
    }
}
