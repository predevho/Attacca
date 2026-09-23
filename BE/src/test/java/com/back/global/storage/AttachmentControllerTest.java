package com.back.global.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class AttachmentControllerTest {

    @Test
    void 인증된_사용자는_임시_첨부를_업로드할_수_있다() {
        FileService fileService = mock(FileService.class);
        MockMultipartFile file = new MockMultipartFile("file", "score.pdf", "application/pdf",
                new byte[] {0x25, 0x50, 0x44, 0x46, 0x2D});
        when(fileService.uploadTemporary(file, 7L))
                .thenReturn(new StoredFile(41L, "attachments/2026/09/22/uuid.pdf", "https://cdn/uuid.pdf"));
        AttachmentController controller = new AttachmentController(fileService);

        var response = controller.uploadTemporary(7L, file);

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getData().attachmentId()).isEqualTo(41L);
        assertThat(response.getData().url()).isEqualTo("https://cdn/uuid.pdf");
    }
}
