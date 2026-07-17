package com.nexuspm.user.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class DepartmentResponse {

    private UUID id;
    private String name;
}
