package com.nexuspm.issue;

import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.project.entity.Project;
import com.nexuspm.shared.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class IssueKeyAllocator {

    private final RdIssueRepository issueRepository;

    /**
     * Assigns {@code displayKey}, {@code rdNumber}, and optional {@code childNumber}.
     * Call before first {@code save} of a new issue.
     *
     * <pre>
     * Root:  SABI-GBL-RD-1
     * Task:  SABI-GBL-RD-1-TS-2   (always under RD number, not nested under Story)
     * Story: SABI-GBL-RD-1-ST-1
     * </pre>
     */
    public void assign(RdIssue issue, Project project, RdIssue parentIssue, String workflowCode) {
        if (project.getName() == null || project.getName().isBlank()) {
            throw new BusinessException(
                    "VALIDATION",
                    "Project needs a name (e.g. SABI-GBL) to generate issue keys",
                    400);
        }

        String prefix = IssueDisplayKeys.projectKeyPrefix(project);

        if (parentIssue == null) {
            int nextRd = issueRepository.findMaxRdNumberByProjectId(project.getId()) + 1;
            issue.setRdNumber(nextRd);
            issue.setChildNumber(null);
            issue.setDisplayKey(IssueDisplayKeys.rdKey(prefix, nextRd));
            return;
        }

        if (parentIssue.getRdNumber() == null) {
            throw new BusinessException(
                    "VALIDATION",
                    "Parent item is missing an RD number — re-save or re-backfill parent first",
                    400);
        }

        int rdNumber = parentIssue.getRdNumber();
        String rdKey = IssueDisplayKeys.rdKey(prefix, rdNumber);
        int nextChild = issueRepository.findMaxChildNumberByProjectRdAndWorkflow(
                        project.getId(), rdNumber, workflowCode)
                + 1;
        issue.setRdNumber(rdNumber);
        issue.setChildNumber(nextChild);
        issue.setDisplayKey(IssueDisplayKeys.childKey(rdKey, workflowCode, nextChild));
    }
}
