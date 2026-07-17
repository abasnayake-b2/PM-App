package com.nexuspm.admin.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.UUID;

@Value
@Builder
public class RoleAccessResponse {
    UUID id;
    String name;
    String code;
    boolean systemRole;
    boolean permissionsEditable;
    boolean deletable;
    List<String> permissionCodes;
}
