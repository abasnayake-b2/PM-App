package com.nexuspm.issue.field.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpdateIssueFieldDefinitionRequest {

    private String label;
    private Integer maxLength;
    private Boolean required;
    private Boolean active;
    private Integer displayOrder;
    private List<String> options;
    private String helpText;
    private String sectionCode;
}
