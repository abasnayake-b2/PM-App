package com.nexuspm.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class NotificationTemplateResponse {

    private UUID id;
    private String code;
    private String subject;
    private String bodyTemplate;
}
