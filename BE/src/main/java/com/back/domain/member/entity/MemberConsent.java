package com.back.domain.member.entity;

import com.back.global.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 동의 이력. 누가·언제·어느 버전에 동의했는가. (DOMAIN-MEMBER-STATUTE §3.4)
 *
 * <p><b>최신 1건이 아니라 이력 전부를 남긴다.</b> 약관이 바뀌어 다시 동의를 받으면
 * 행이 하나 더 쌓인다. 덮어쓰면 "그때 무엇에 동의했는가"에 답할 수 없다.
 *
 * <p><b>회원 연관을 걸지 않고 id 원시값을 들고 있다.</b> 탈퇴해도 동의 사실은 남아야
 * 하는데, 연관을 걸면 회원을 지울 때 같이 지우고 싶은 유혹이 생긴다. 이 표에는
 * 개인 식별 정보가 없으므로(회원 id와 동의 사실뿐) 남겨도 된다.
 */
@Entity
@Table(name = "member_consent")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MemberConsent extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ConsentType type;

    /** 동의한 문서의 버전. 예: {@code 2026-09-09} */
    @Column(nullable = false, length = 20)
    private String version;

    @Column(name = "agreed_at", nullable = false)
    private LocalDateTime agreedAt;

    private MemberConsent(Long memberId, ConsentType type, String version, LocalDateTime agreedAt) {
        this.memberId = memberId;
        this.type = type;
        this.version = version;
        this.agreedAt = agreedAt;
    }

    public static MemberConsent of(Long memberId, ConsentType type, String version) {
        return new MemberConsent(memberId, type, version, LocalDateTime.now());
    }
}
