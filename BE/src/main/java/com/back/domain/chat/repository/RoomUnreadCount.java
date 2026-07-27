package com.back.domain.chat.repository;

/** 방별 안 읽은 수 배치 집계 projection. */
public interface RoomUnreadCount {
    Long getRoomId();
    long getUnreadCount();
}
