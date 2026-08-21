package com.nexuspm.issue.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateIssueNoteRequest {

    private LocalDate date;

    @NotBlank
    @Size(max = 4000)
    private String note;
}
