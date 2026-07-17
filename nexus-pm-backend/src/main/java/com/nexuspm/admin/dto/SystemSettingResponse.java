package com.nexuspm.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class SystemSettingResponse {

    private UUID id;
    private String settingKey;
    private String settingValue;
    private Instant updatedAt;
}

