package com.back.domain.chat.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.back.domain.chat.dto.ChatRoomResponse;
import com.back.domain.chat.dto.ChatRoomSummaryResponse;
import com.back.domain.chat.dto.CreateRoomRequest;
import com.back.domain.chat.entity.RoomType;
import com.back.domain.member.entity.Member;
import com.back.domain.member.repository.MemberRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ChatRoomListTest {

    @Autowired ChatRoomService roomService;
    @Autowired ChatMessageService messageService;
    @Autowired MemberRepository memberRepository;

    private Long alice;
    private Long bob;

    @BeforeEach
    void setUp() {
        alice = memberRepository.save(Member.createLocal("alice", "pw", "a@x.com", "앨리스")).getId();
        bob = memberRepository.save(Member.createLocal("bob", "pw", "b@x.com", "밥")).getId();
    }

    @Test
    void 방목록은_안읽은수와_마지막메시지를_담는다() {
        ChatRoomResponse room = roomService.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob), null));
        messageService.send(bob, room.id(), "첫 메시지");
        messageService.send(bob, room.id(), "둘째 메시지");

        var page = roomService.listRooms(alice, PageRequest.of(0, 20));

        assertThat(page.getContent()).hasSize(1);
        ChatRoomSummaryResponse summary = page.getContent().get(0);
        assertThat(summary.unreadCount()).isEqualTo(2); // bob 이 보낸 2개
        assertThat(summary.lastMessage().content()).isEqualTo("둘째 메시지");
        assertThat(summary.displayName()).isEqualTo("밥"); // DIRECT 는 상대 닉네임
    }

    @Test
    void 읽음처리하면_안읽은수가_준다() {
        ChatRoomResponse room = roomService.createRoom(alice,
                new CreateRoomRequest(RoomType.DIRECT, List.of(bob), null));
        var m1 = messageService.send(bob, room.id(), "1");
        var m2 = messageService.send(bob, room.id(), "2");

        roomService.markRead(alice, room.id(), m2.id());

        var page = roomService.listRooms(alice, PageRequest.of(0, 20));
        assertThat(page.getContent().get(0).unreadCount()).isEqualTo(0);
    }
}
