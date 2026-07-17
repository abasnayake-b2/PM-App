package com.nexuspm.issue.field;

import com.nexuspm.issue.field.dto.IssueFieldDefinitionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/issue-fields")
@RequiredArgsConstructor
public class IssueFieldController {

    private final IssueFieldDefinitionService definitionService;

    @GetMapping
    @PreAuthorize("@perm.can('ISSUES_VIEW')")
    public List<IssueFieldDefinitionResponse> listActiveFields() {
        return definitionService.listActive();
    }
}
