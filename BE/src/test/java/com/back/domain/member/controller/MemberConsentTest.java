package com.back.domain.member.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.back.domain.member.entity.ConsentType;
import com.back.domain.member.entity.MemberConsent;
import com.back.domain.member.repository.MemberConsentRepository;
import com.back.domain.member.repository.MemberRepository;
import com.back.domain.member.service.ConsentPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 가입 동의 (DOMAIN-MEMBER-STATUTE §3.4).
 *
 * <p>핵심은 체크박스가 아니라 <b>기록</b>이다. 동의했다고 주장할 수 있어야 하므로
 * 회원이 생겼다면 동의 이력도 반드시 함께 있어야 한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class MemberConsentTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private MemberConsentRepository consentRepository;

    private String signup(boolean terms, boolean privacy) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("loginId", "consenter");
        body.put("password", "goodpassword");
        body.put("email", "consent@attacca.com");
        body.put("nickname", "동의자");
        body.put("agreedTerms", terms);
        body.put("agreedPrivacy", privacy);
        return objectMapper.writeValueAsString(body);
    }

    @Test
    @DisplayName("둘 다 동의하면 가입되고 이력이 남는다")
    void recordsHistoryOnSignup() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON).content(signup(true, true)))
                .andExpect(status().isOk());

        Long memberId = memberRepository.findByLoginId("consenter").orElseThrow().getId();
        List<MemberConsent> history = consentRepository.findByMemberIdOrderByAgreedAtDesc(memberId);

        assertThat(history).hasSize(2);
        assertThat(history).extracting(MemberConsent::getType)
                .containsExactlyInAnyOrder(ConsentType.TERMS, ConsentType.PRIVACY);
        assertThat(history).allSatisfy(c -> {
            assertThat(c.getVersion()).isEqualTo(ConsentPolicy.CURRENT_VERSION);
            assertThat(c.getAgreedAt()).isNotNull();
        });
    }

    @Test
    @DisplayName("약관에 동의하지 않으면 가입되지 않는다")
    void rejectsWithoutTerms() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON).content(signup(false, true)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-04"));

        assertThat(memberRepository.findByLoginId("consenter")).isEmpty();
    }

    @Test
    @DisplayName("개인정보 수집·이용에 동의하지 않으면 가입되지 않는다")
    void rejectsWithoutPrivacy() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON).content(signup(true, false)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-04"));
    }

    @Test
    @DisplayName("동의를 아예 보내지 않아도 가입되지 않는다")
    void rejectsWhenFieldsMissing() throws Exception {
        // 필드가 없으면 boolean 기본값 false 다. "빠뜨리면 통과"가 되지 않아야 한다.
        String body = objectMapper.writeValueAsString(Map.of(
                "loginId", "nofield", "password", "goodpassword",
                "email", "nofield@attacca.com", "nickname", "무필드"));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.resultCode").value("400-04"));
    }

    @Test
    @DisplayName("회원이 생겼는데 동의 이력이 없는 상태는 만들지 않는다")
    void noMemberWithoutConsent() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON).content(signup(true, true)))
                .andExpect(status().isOk());

        // 가입과 기록이 같은 트랜잭션이므로, 회원 수만큼 동의 묶음이 있어야 한다.
        memberRepository.findAll().stream()
                .filter(m -> "consenter".equals(m.getLoginId()))
                .forEach(m -> assertThat(consentRepository.findByMemberIdOrderByAgreedAtDesc(m.getId()))
                        .hasSize(ConsentPolicy.REQUIRED.size()));
    }
}
