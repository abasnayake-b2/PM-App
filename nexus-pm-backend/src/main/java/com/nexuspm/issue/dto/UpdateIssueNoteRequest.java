package com.nexuspm.issue.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateIssueNoteRequest {

    private LocalDate date;

    @Size(max = 4000)
    private String note;
}
