package com.nexuspm.issue.repository;

import com.nexuspm.issue.entity.RdIssueNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RdIssueNoteRepository extends JpaRepository<RdIssueNote, UUID> {

    @Query("""
            SELECT n FROM RdIssueNote n
            JOIN FETCH n.issue i
            WHERE i.id = :issueId AND n.deleted = false
            ORDER BY n.noteDate DESC, n.createdAt DESC
            """)
    List<RdIssueNote> findActiveByIssueId(UUID issueId);

    @Query("""
            SELECT n FROM RdIssueNote n
            JOIN FETCH n.issue i
            JOIN FETCH i.project
            WHERE n.id = :id AND n.deleted = false
            """)
    Optional<RdIssueNote> findActiveDetailedById(UUID id);
}
