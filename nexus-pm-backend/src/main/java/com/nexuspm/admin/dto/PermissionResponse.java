package com.nexuspm.admin.dto;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class PermissionResponse {
    UUID id;
    String code;
    String name;
    String module;
    String action;
}
