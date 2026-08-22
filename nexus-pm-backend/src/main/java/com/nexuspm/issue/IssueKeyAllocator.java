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

    /**
     * New root RD from Excel: {@code <Project Name>-RD-<CR #>}, or the next project
     * sequence when CR # is missing / not numeric.
     */
    public void assignRootFromExcel(RdIssue issue, Project project, Integer excelRdNumber) {
        if (excelRdNumber != null) {
            applyRootRdNumber(issue, project, excelRdNumber);
            return;
        }
        assign(issue, project, null, "CHANGE");
    }

    /**
     * Sets (or retargets) a root RD key to {@code <Project Name>-RD-<rdNumber>}
     * and rewrites child keys that shared the previous RD number.
     */
    public void applyRootRdNumber(RdIssue issue, Project project, int rdNumber) {
        if (project.getName() == null || project.getName().isBlank()) {
            throw new BusinessException(
                    "VALIDATION",
                    "Project needs a name (e.g. SABI-GBL) to generate issue keys",
                    400);
        }
        String prefix = IssueDisplayKeys.projectKeyPrefix(project);
        String key = IssueDisplayKeys.rdKey(prefix, rdNumber);
        issueRepository.findByDisplayKeyIgnoreCase(key).ifPresent(other -> {
            if (issue.getId() == null || !other.getId().equals(issue.getId())) {
                throw new BusinessException(
                        "IMPORT_FAILED",
                        "CR No / ID " + key + " already exists",
                        400);
            }
        });

        Integer previousRd = issue.getRdNumber();
        boolean sameKey = key.equalsIgnoreCase(issue.getDisplayKey())
                && previousRd != null
                && previousRd == rdNumber;
        issue.setRdNumber(rdNumber);
        issue.setChildNumber(null);
        issue.setDisplayKey(key);
        if (!sameKey && previousRd != null && previousRd != rdNumber && issue.getId() != null) {
            rekeyDescendants(project, previousRd, rdNumber);
        }
    }

    private void rekeyDescendants(Project project, int previousRd, int newRd) {
        String rdKey = IssueDisplayKeys.rdKey(IssueDisplayKeys.projectKeyPrefix(project), newRd);
        for (RdIssue child : issueRepository.findDescendantsByProjectAndRdNumber(project.getId(), previousRd)) {
            String workflow = child.getIssueType() != null ? child.getIssueType().getWorkflowCode() : null;
            child.setRdNumber(newRd);
            if (child.getChildNumber() != null) {
                child.setDisplayKey(IssueDisplayKeys.childKey(rdKey, workflow, child.getChildNumber()));
            }
            issueRepository.save(child);
        }
    }
}
