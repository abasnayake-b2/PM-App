package com.nexuspm.lookup;

import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.entity.Priority;
import com.nexuspm.lookup.repository.IssueStatusRepository;
import com.nexuspm.lookup.repository.IssueTypeRepository;
import com.nexuspm.lookup.repository.PriorityRepository;
import com.nexuspm.shared.cache.CacheNames;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LookupService {

    private final PriorityRepository priorityRepository;
    private final IssueTypeRepository issueTypeRepository;
    private final IssueStatusRepository issueStatusRepository;

    @Cacheable(cacheNames = CacheNames.PRIORITIES, key = "'all'")
    @Transactional(readOnly = true)
    public List<Priority> listPriorities() {
        return priorityRepository.findAllByOrderByLevelAsc();
    }

    @Cacheable(cacheNames = CacheNames.ISSUE_TYPES, key = "'all'")
    @Transactional(readOnly = true)
    public List<IssueType> listIssueTypes() {
        return IssueTypeCatalog.filterAndSort(issueTypeRepository.findAll());
    }

    @Cacheable(cacheNames = CacheNames.ISSUE_STATUSES, key = "'all'")
    @Transactional(readOnly = true)
    public List<IssueStatus> listStatuses() {
        return issueStatusRepository.findAllByOrderBySequenceAsc();
    }
}
