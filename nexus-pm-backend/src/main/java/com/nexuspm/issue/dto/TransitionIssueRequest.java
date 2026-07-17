package com.nexuspm.issue.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class TransitionIssueRequest {

    @NotNull
    private UUID statusId;
}
