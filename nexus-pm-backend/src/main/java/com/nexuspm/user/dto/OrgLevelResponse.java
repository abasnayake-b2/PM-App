package com.nexuspm.user.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class OrgLevelResponse {

    private UUID id;
    private String code;
    private String name;
    private Integer levelOrder;
    private String reportsToCode;
}
