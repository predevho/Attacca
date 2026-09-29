UPDATE chat_message
SET created_at = DATE_ADD(created_at, INTERVAL 9 HOUR),
    updated_at = DATE_ADD(updated_at, INTERVAL 9 HOUR);

UPDATE chat_room
SET created_at = DATE_ADD(created_at, INTERVAL 9 HOUR),
    updated_at = DATE_ADD(updated_at, INTERVAL 9 HOUR),
    last_message_at = DATE_ADD(last_message_at, INTERVAL 9 HOUR);

UPDATE chat_participant
SET created_at = DATE_ADD(created_at, INTERVAL 9 HOUR),
    updated_at = DATE_ADD(updated_at, INTERVAL 9 HOUR),
    left_at = DATE_ADD(left_at, INTERVAL 9 HOUR);
