package com.back.domain.member.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.security.Role;
import com.back.global.security.jwt.JwtProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 닉네임으로 회원을 찾는다. CHAT이 1:1 대화 상대를 고르는 데 쓴다.
 * (DOMAIN-MEMBER-STATUTE §3.2.1)
 *
 * <p>회원 목록을 여는 일이라 "누가 볼 수 있는지"와 "무엇이 나가는지"를 함께 단언한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@ActiveProfiles("test")
class MemberSearchControllerTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private MemberRepository memberRepository;
    @Autowired
    private JwtProvider jwtProvider;

    private String bearer;
    private Long meId;

    @BeforeEach
    void setUp() {
        Member me = memberRepository.save(
                Member.createLocal("searcher", "pw", "searcher@attacca.com", "찾는사람"));
        meId = me.getId();
        bearer = "Bearer " + jwtProvider.createAccessToken(meId, Role.USER);

        memberRepository.save(Member.createLocal("hayoon", "pw", "hayoon@attacca.com", "정하윤"));
        memberRepository.save(Member.createLocal("hayoon2", "pw", "hayoon2@attacca.com", "김하윤"));
        memberRepository.save(Member.createLocal("other", "pw", "other@attacca.com", "박첼로"));
    }

    @Test
    void 닉네임_일부로_찾는다() throws Exception {
        mockMvc.perform(get("/api/members/search").param("q", "하윤").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    void 접두가_아니라_가운데_일치도_찾는다() throws Exception {
        // 접두 일치만 하면 "정하윤"을 "하윤"으로 못 찾는다.
        mockMvc.perform(get("/api/members/search").param("q", "하윤").header("Authorization", bearer))
                .andExpect(jsonPath("$.data[?(@.nickname == '정하윤')]").exists());
    }

    @Test
    void 응답은_표시정보만_담는다() throws Exception {
        String body = mockMvc.perform(
                        get("/api/members/search").param("q", "하윤").header("Authorization", bearer))
                .andExpect(jsonPath("$.data[0].nickname").exists())
                .andExpect(jsonPath("$.data[0].verified").exists())
                .andReturn().getResponse().getContentAsString();

        // 이메일·로그인 id 같은 식별·연락 정보가 새면 안 된다.
        org.assertj.core.api.Assertions.assertThat(body)
                .doesNotContain("attacca.com").doesNotContain("hayoon");
    }

    @Test
    void 본인은_결과에서_빠진다() throws Exception {
        mockMvc.perform(get("/api/members/search").param("q", "찾는").header("Authorization", bearer))
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void 탈퇴_회원은_빠진다() throws Exception {
        Member gone = memberRepository.save(
                Member.createLocal("gone", "pw", "gone@attacca.com", "떠난하윤"));
        gone.withdraw();
        memberRepository.saveAndFlush(gone);

        mockMvc.perform(get("/api/members/search").param("q", "하윤").header("Authorization", bearer))
                .andExpect(jsonPath("$.data[?(@.nickname == '떠난하윤')]").doesNotExist());
    }

    @Test
    void 두_글자_미만은_빈_목록이다() throws Exception {
        // 한 글자로 전체 회원을 훑는 것을 막는다. 타이핑 중이 정상이라 400이 아니라 빈 목록.
        mockMvc.perform(get("/api/members/search").param("q", "하").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void 공백만_주면_빈_목록이다() throws Exception {
        mockMvc.perform(get("/api/members/search").param("q", "   ").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    @Test
    void 비로그인은_접근할_수_없다() throws Exception {
        mockMvc.perform(get("/api/members/search").param("q", "하윤"))
                .andExpect(status().isUnauthorized());
    }
}
