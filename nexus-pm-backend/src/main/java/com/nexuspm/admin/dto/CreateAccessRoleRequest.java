package com.nexuspm.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateAccessRoleRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String code;

    private List<String> permissionCodes;
}
