package com.back.domain.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.back.domain.chat.dto.ChatRoomResponse;
import com.back.domain.chat.dto.CreateRoomRequest;
import com.back.domain.chat.entity.RoomType;
import com.back.domain.chat.repository.ChatRoomRepository;
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
class ChatMessageServiceTest {

    @Autowired ChatMessageService messageService;
    @Autowired ChatRoomService roomService;
    @Autowired ChatRoomRepository roomRepository;
    @Autowired MemberRepository memberRepository;

    private Long alice;
    private Long bob;
    private Long carol;
    private Long roomId;

    @BeforeEach
    void setUp() {
        alice = memberRepository.save(Member.createLocal("alice", "pw", "a@x.com", "앨리스")).getId();
        bob = memberRepository.save(Member.createLocal("bob", "pw", "b@x.com", "밥")).getId();
        carol = memberRepository.save(Member.createLocal("carol", "pw", "c@x.com", "캐럴")).getId();
        ChatRoomResponse room = roomService.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob), null));
        roomId = room.id();
    }

    @Test
    void 전송하면_저장되고_방의_lastMessageAt이_갱신된다() throws Exception {
        var sent = messageService.send(alice, roomId, "안녕");

        assertThat(sent.content()).isEqualTo("안녕");
        assertThat(sent.sender().nickname()).isEqualTo("앨리스");
        var first = roomRepository.findById(roomId).orElseThrow().getLastMessageAt();

        Thread.sleep(10);
        messageService.send(alice, roomId, "또 안녕");
        var second = roomRepository.findById(roomId).orElseThrow().getLastMessageAt();

        assertThat(second).isAfter(first);
    }

    @Test
    void 존재하지_않는_방에_전송하면_방없음_404이다() {
        assertThatThrownBy(() -> messageService.send(alice, 999999L, "x"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOM_NOT_FOUND);
    }

    @Test
    void 이력은_최신순_커서로_준다() {
        messageService.send(alice, roomId, "1");
        messageService.send(bob, roomId, "2");
        messageService.send(alice, roomId, "3");

        var page = messageService.history(alice, roomId, null, 2);

        assertThat(page.items()).extracting("content").containsExactly("3", "2");
        assertThat(page.nextCursor()).isNotNull();

        var older = messageService.history(alice, roomId, page.nextCursor(), 2);
        assertThat(older.items()).extracting("content").containsExactly("1");
        assertThat(older.nextCursor()).isNull();
    }

    @Test
    void 비참여자는_전송도_이력조회도_403이다() {
        assertThatThrownBy(() -> messageService.send(carol, roomId, "끼어들기"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.NOT_ROOM_PARTICIPANT);
        assertThatThrownBy(() -> messageService.history(carol, roomId, null, 20))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.NOT_ROOM_PARTICIPANT);
    }
}
