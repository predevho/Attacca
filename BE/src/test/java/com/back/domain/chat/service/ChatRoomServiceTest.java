package com.back.domain.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.domain.chat.dto.CreateRoomRequest;
import com.back.domain.chat.dto.InviteRequest;
import com.back.domain.chat.entity.RoomType;
import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import com.back.global.exception.BusinessException;
import com.back.global.exception.ErrorCode;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ChatRoomServiceTest {

    @Autowired ChatRoomService service;
    @Autowired MemberRepository memberRepository;

    private Long alice;
    private Long bob;
    private Long carol;

    @BeforeEach
    void setUp() {
        alice = memberRepository.save(Member.createLocal("alice", "pw", "a@x.com", "앨리스")).getId();
        bob = memberRepository.save(Member.createLocal("bob", "pw", "b@x.com", "밥")).getId();
        carol = memberRepository.save(Member.createLocal("carol", "pw", "c@x.com", "캐럴")).getId();
    }

    @Test
    void DIRECT방은_같은_쌍이면_재요청해도_같은_방이다() {
        var first = service.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob), null));
        var second = service.createRoom(bob,
                new CreateRoomRequest(RoomType.DIRECT, List.of(alice), null));

        assertThat(second.id()).isEqualTo(first.id()); // find-or-create
        assertThat(first.type()).isEqualTo(RoomType.DIRECT);
        assertThat(first.participants()).hasSize(2);
    }

    @Test
    void DIRECT_상대가_여러명이면_거절한다() {
        assertThatThrownBy(() -> service.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob, carol), null)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_INVALID_PARTICIPANTS);
    }

    @Test
    void GROUP방_생성후_초대하면_참여자가_늘고_퇴장하면_준다() {
        var room = service.createRoom(alice,
                new CreateRoomRequest(RoomType.GROUP, List.of(bob), "합주"));
        assertThat(room.participants()).hasSize(2); // 생성자 + bob

        var invited = service.invite(alice, room.id(), new InviteRequest(List.of(carol)));
        assertThat(invited.participants()).hasSize(3);

        service.leave(bob, room.id());
        var after = service.getRoom(alice, room.id());
        assertThat(after.participants()).extracting("id").doesNotContain(bob);
    }

    @Test
    void 비참여자가_방을_조회하면_403이다() {
        var room = service.createRoom(alice,
                new CreateRoomRequest(RoomType.GROUP, List.of(bob), "합주"));

        assertThatThrownBy(() -> service.getRoom(carol, room.id()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.NOT_ROOM_PARTICIPANT);
    }

    @Test
    void 없는_방_조회는_404다() {
        assertThatThrownBy(() -> service.getRoom(alice, 99999L))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOM_NOT_FOUND);
    }

    @Test
    void DIRECT방에_초대하면_거절한다() {
        var room = service.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob), null));

        assertThatThrownBy(() -> service.invite(alice, room.id(), new InviteRequest(List.of(carol))))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_INVALID_PARTICIPANTS);
    }

    @Test
    void 퇴장자를_다시_초대하면_중복없이_재합류한다() {
        var room = service.createRoom(alice,
                new CreateRoomRequest(RoomType.GROUP, List.of(bob), "합주"));
        int beforeLeaveCount = room.participants().size(); // alice + bob

        service.leave(bob, room.id());
        var afterLeave = service.getRoom(alice, room.id());
        assertThat(afterLeave.participants()).extracting("id").doesNotContain(bob);

        var invited = service.invite(alice, room.id(), new InviteRequest(List.of(bob)));
        assertThat(invited.participants()).extracting("id").contains(bob);
        assertThat(invited.participants()).hasSize(beforeLeaveCount); // 중복 행 없이 원래 인원수로 복귀
    }
}
