package com.nexuspm.lookup;

import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.entity.Priority;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/lookup")
@RequiredArgsConstructor
public class LookupController {

    private final LookupService lookupService;

    @GetMapping("/priorities")
    @PreAuthorize("isAuthenticated()")
    public List<Priority> listPriorities() {
        return lookupService.listPriorities();
    }

    @GetMapping("/issue-types")
    @PreAuthorize("isAuthenticated()")
    public List<IssueType> listIssueTypes() {
        return lookupService.listIssueTypes();
    }

    @GetMapping("/statuses")
    @PreAuthorize("isAuthenticated()")
    public List<IssueStatus> listStatuses() {
        return lookupService.listStatuses();
    }
}
