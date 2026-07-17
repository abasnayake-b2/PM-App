package com.nexuspm.issue.field.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateIssueFieldDefinitionRequest {

    private String fieldKey;

    @NotBlank
    private String label;

    @NotBlank
    private String dataType;

    private Integer maxLength;
    private Boolean required;
    private Boolean active;
    private String sectionCode;
    private Integer displayOrder;
    private List<String> options;
    private String helpText;
}
