package com.nexuspm.admin.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class IssueStatusRequest {

    @NotBlank
    private String name;

    private int sequence;
    private boolean terminal;
    private String colour;
}
