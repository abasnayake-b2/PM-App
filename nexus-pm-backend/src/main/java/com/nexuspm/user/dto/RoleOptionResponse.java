package com.nexuspm.user.dto;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class RoleOptionResponse {
    UUID id;
    String name;
    String code;
}
