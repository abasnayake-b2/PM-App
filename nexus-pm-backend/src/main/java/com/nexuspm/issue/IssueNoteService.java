package com.nexuspm.issue;

import com.nexuspm.issue.dto.CreateIssueNoteRequest;
import com.nexuspm.issue.dto.IssueNoteResponse;
import com.nexuspm.issue.dto.UpdateIssueNoteRequest;
import com.nexuspm.issue.entity.RdIssue;
import com.nexuspm.issue.entity.RdIssueNote;
import com.nexuspm.issue.repository.RdIssueNoteRepository;
import com.nexuspm.issue.repository.RdIssueRepository;
import com.nexuspm.project.ProjectService;
import com.nexuspm.shared.audit.AuditLogService;
import com.nexuspm.shared.exception.BusinessException;
import com.nexuspm.shared.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IssueNoteService {

    private final RdIssueNoteRepository noteRepository;
    private final RdIssueRepository issueRepository;
    private final ProjectService projectService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<IssueNoteResponse> list(UUID issueId) {
        loadIssueWithAccess(issueId);
        return noteRepository.findActiveByIssueId(issueId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public IssueNoteResponse create(UUID issueId, CreateIssueNoteRequest request) {
        RdIssue issue = loadIssueWithAccess(issueId);
        String body = requireNote(request.getNote());

        RdIssueNote row = new RdIssueNote();
        row.setId(UUID.randomUUID());
        row.setIssue(issue);
        row.setNoteDate(request.getDate() != null ? request.getDate() : LocalDate.now());
        row.setNote(body);
        row.setOwner(currentOwnerName());

        noteRepository.save(row);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "CREATE",
                "ISSUE_NOTE",
                row.getId(),
                "Note on " + issue.getDisplayKey(),
                null);
        return toResponse(row);
    }

    @Transactional
    public IssueNoteResponse update(UUID id, UpdateIssueNoteRequest request) {
        RdIssueNote row = loadWithAccess(id);
        if (request.getDate() != null) {
            row.setNoteDate(request.getDate());
        }
        if (request.getNote() != null) {
            row.setNote(requireNote(request.getNote()));
        }
        noteRepository.save(row);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "UPDATE",
                "ISSUE_NOTE",
                row.getId(),
                "Note on " + row.getIssue().getDisplayKey(),
                null);
        return toResponse(row);
    }

    @Transactional
    public void delete(UUID id) {
        RdIssueNote row = loadWithAccess(id);
        row.setDeleted(true);
        noteRepository.save(row);
        auditLogService.log(
                SecurityUtils.currentUserId(),
                "DELETE",
                "ISSUE_NOTE",
                row.getId(),
                "Note on " + row.getIssue().getDisplayKey(),
                null);
    }

    private static String currentOwnerName() {
        String name = SecurityUtils.currentUser().getName();
        if (name == null || name.isBlank()) {
            throw new BusinessException("VALIDATION", "Logged-in user name is required for note owner", 400);
        }
        return name.trim();
    }

    private static String requireNote(String note) {
        if (note == null || note.trim().isEmpty()) {
            throw new BusinessException("VALIDATION", "Note is required", 400);
        }
        return note.trim();
    }

    private RdIssue loadIssueWithAccess(UUID issueId) {
        RdIssue issue = issueRepository.findDetailedById(issueId)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Issue not found", 404));
        projectService.getProject(issue.getProject().getId());
        return issue;
    }

    private RdIssueNote loadWithAccess(UUID id) {
        RdIssueNote row = noteRepository.findActiveDetailedById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND", "Note not found", 404));
        projectService.getProject(row.getIssue().getProject().getId());
        return row;
    }

    private IssueNoteResponse toResponse(RdIssueNote row) {
        return IssueNoteResponse.builder()
                .id(row.getId())
                .issueId(row.getIssue().getId())
                .date(row.getNoteDate())
                .note(row.getNote())
                .owner(row.getOwner())
                .createdAt(row.getCreatedAt())
                .updatedAt(row.getUpdatedAt())
                .build();
    }
}
