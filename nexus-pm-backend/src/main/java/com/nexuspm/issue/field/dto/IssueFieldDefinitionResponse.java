package com.nexuspm.issue.field.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class IssueFieldDefinitionResponse {

    private UUID id;
    private String fieldKey;
    private String label;
    private String dataType;
    private Integer maxLength;
    private boolean required;
    private boolean active;
    private boolean systemField;
    private String sectionCode;
    private int displayOrder;
    private List<String> options;
    private String helpText;
}
