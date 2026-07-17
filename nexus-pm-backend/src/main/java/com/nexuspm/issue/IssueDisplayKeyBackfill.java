package com.nexuspm.issue;

import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.repository.RdIssueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Assigns / realigns display keys from project <em>name</em>
 * (e.g. SABI-GBL-RD-1), not product code.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IssueDisplayKeyBackfill implements ApplicationRunner {

    private final RdIssueRepository issueRepository;
    private final IssueKeyAllocator issueKeyAllocator;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        backfillMissing();
        realignPrefixesToProjectName();
    }

    private void backfillMissing() {
        long missing = issueRepository.countByDisplayKeyIsNull();
        if (missing == 0) {
            return;
        }
        log.info("Backfilling display keys for {} issue(s)…", missing);

        Map<UUID, Integer> projectRdCursor = new HashMap<>();
        Map<String, Integer> childCursor = new HashMap<>();

        for (RdIssue issue : issueRepository.findAllMissingDisplayKey()) {
            if (issue.getParentIssue() != null) {
                continue;
            }
            UUID projectId = issue.getProject().getId();
            int next = projectRdCursor.computeIfAbsent(
                    projectId, id -> issueRepository.findMaxRdNumberByProjectId(id));
            next += 1;
            projectRdCursor.put(projectId, next);
            String prefix = IssueDisplayKeys.projectKeyPrefix(issue.getProject());
            issue.setRdNumber(next);
            issue.setChildNumber(null);
            issue.setDisplayKey(IssueDisplayKeys.rdKey(prefix, next));
            issueRepository.save(issue);
        }

        boolean progressed = true;
        int guard = 0;
        while (progressed && guard++ < 8) {
            progressed = false;
            List<RdIssue> stillMissing = issueRepository.findAllMissingDisplayKey();
            for (RdIssue issue : stillMissing) {
                RdIssue parent = issue.getParentIssue();
                if (parent == null) {
                    issueKeyAllocator.assign(
                            issue, issue.getProject(), null, issue.getIssueType().getWorkflowCode());
                    issueRepository.save(issue);
                    progressed = true;
                    continue;
                }
                if (parent.getRdNumber() == null) {
                    continue;
                }
                String workflow = issue.getIssueType().getWorkflowCode();
                UUID projectId = issue.getProject().getId();
                int rdNumber = parent.getRdNumber();
                String cursorKey = projectId + ":" + rdNumber + ":" + workflow.toUpperCase();
                int next = childCursor.computeIfAbsent(
                        cursorKey,
                        k -> issueRepository.findMaxChildNumberByProjectRdAndWorkflow(
                                projectId, rdNumber, workflow));
                next += 1;
                childCursor.put(cursorKey, next);
                String prefix = IssueDisplayKeys.projectKeyPrefix(issue.getProject());
                String rdKey = IssueDisplayKeys.rdKey(prefix, rdNumber);
                issue.setRdNumber(rdNumber);
                issue.setChildNumber(next);
                issue.setDisplayKey(IssueDisplayKeys.childKey(rdKey, workflow, next));
                issueRepository.save(issue);
                progressed = true;
            }
        }

        long remaining = issueRepository.countByDisplayKeyIsNull();
        if (remaining > 0) {
            log.warn("{} issue(s) still missing display keys after backfill", remaining);
        } else {
            log.info("Display key backfill complete");
        }
    }

    /** Rewrite keys that used product (e.g. GBL) so they use project name (SABI-GBL). */
    private void realignPrefixesToProjectName() {
        int updated = 0;
        for (RdIssue issue : issueRepository.findAllWithRdNumber()) {
            String expected = IssueDisplayKeys.buildDisplayKey(
                    issue.getProject(),
                    issue.getRdNumber(),
                    issue.getChildNumber(),
                    issue.getIssueType().getWorkflowCode());
            if (expected == null || Objects.equals(expected, issue.getDisplayKey())) {
                continue;
            }
            issue.setDisplayKey(expected);
            issueRepository.save(issue);
            updated++;
        }
        if (updated > 0) {
            log.info("Realigned {} display key(s) to project name prefix", updated);
        }
    }
}
