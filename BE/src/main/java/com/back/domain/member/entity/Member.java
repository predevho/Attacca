package com.back.domain.member.entity;

import com.back.global.common.BaseEntity;
import com.back.global.security.Role;
import jakarta.persistence.Column;
import java.time.LocalDateTime;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 회원 엔티티. 자체 로그인(loginId+password)과 소셜 로그인이 하나의 회원으로 수렴한다.
 * loginId/password 는 소셜 전용 회원에서는 null 이며, email/nickname 은 전원 필수.
 */
@Entity
@Table(name = "member")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Member extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 자체 로그인 아이디. 소셜 전용 회원은 null. */
    @Column(unique = true)
    private String loginId;

    /** 해시된 비밀번호. 소셜 전용 회원은 null. 평문 저장 금지. */
    private String password;

    /** 인증메일 발송·연락용 + 소셜 자동연결 매칭 키. 전원 필수. */
    @Column(nullable = false, unique = true)
    private String email;

    /** 웹 내 활동 표시명. */
    @Column(nullable = false, unique = true)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    /** 탈퇴 시각. 채워지면 로그인·재발급이 막힌다. (DOMAIN-MEMBER-STATUTE §3.5) */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    private Member(String loginId, String password, String email, String nickname, Role role) {
        this.loginId = loginId;
        this.password = password;
        this.email = email;
        this.nickname = nickname;
        this.role = role;
    }

    /** 자체 가입 회원 생성. encodedPassword = 이미 해시된 비밀번호. */
    public static Member createLocal(String loginId, String encodedPassword, String email, String nickname) {
        return new Member(loginId, encodedPassword, email, nickname, Role.USER);
    }

    /** 소셜 전용 회원 생성. loginId/password 없음. */
    public static Member createSocial(String email, String nickname) {
        return new Member(null, null, email, nickname, Role.USER);
    }

    /**
     * 어드민으로 올린다. (DOMAIN-MEMBER-STATUTE §4.1)
     *
     * <p>내리는 짝은 일부러 두지 않았다. 부트스트랩은 올리기만 하고,
     * 회수는 사람이 판단해서 할 일이다.
     */
    public void promoteToAdmin() {
        this.role = Role.ADMIN;
    }

    /**
     * 탈퇴 처리. 개인 식별 정보를 지우거나 알아볼 수 없게 바꾼다. 되돌릴 수 없다.
     *
     * <p>email/nickname 은 유니크 제약이 있어 비울 수 없으므로 익명 값으로 바꾼다.
     * 이메일 도메인 {@code .invalid} 는 RFC 2606이 이 용도로 예약한 것이라
     * 실수로도 발송되지 않는다.
     *
     * <p>행 자체는 남긴다 — 이 회원이 쓴 글의 작성자 참조가 끊기면 남의 글타래가 무너진다.
     */
    public void withdraw() {
        this.loginId = null;
        this.password = null;
        this.email = "deleted-" + this.id + "@attacca.invalid";
        this.nickname = "탈퇴한회원" + this.id;
        this.deletedAt = LocalDateTime.now();
    }

    public boolean isWithdrawn() {
        return deletedAt != null;
    }
}
