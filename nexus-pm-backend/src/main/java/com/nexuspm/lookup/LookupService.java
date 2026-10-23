package com.nexuspm.lookup;

import com.nexuspm.lookup.entity.IssueStatus;
import com.nexuspm.lookup.entity.IssueType;
import com.nexuspm.lookup.entity.Priority;
import com.nexuspm.lookup.entity.ProjectType;
import com.nexuspm.lookup.entity.TaskCategory;
import com.nexuspm.lookup.entity.TaskType;
import com.nexuspm.lookup.dto.WorkCategoryResponse;
import com.nexuspm.lookup.entity.WorkCategory;
import com.nexuspm.lookup.entity.WorkCategoryDirector;
import com.nexuspm.lookup.entity.WorkCategoryManager;
import com.nexuspm.lookup.repository.IssueStatusRepository;
import com.nexuspm.lookup.repository.WorkCategoryDirectorRepository;
import com.nexuspm.lookup.repository.IssueTypeRepository;
import com.nexuspm.lookup.repository.PriorityRepository;
import com.nexuspm.lookup.repository.ProjectTypeRepository;
import com.nexuspm.lookup.repository.TaskCategoryRepository;
import com.nexuspm.lookup.repository.TaskTypeRepository;
import com.nexuspm.lookup.repository.WorkCategoryManagerRepository;
import com.nexuspm.lookup.repository.WorkCategoryRepository;
import com.nexuspm.teamroster.entity.TeamManagement;
import com.nexuspm.shared.cache.CacheNames;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LookupService {

    private final PriorityRepository priorityRepository;
    private final IssueTypeRepository issueTypeRepository;
    private final IssueStatusRepository issueStatusRepository;
    private final TaskTypeRepository taskTypeRepository;
    private final TaskCategoryRepository taskCategoryRepository;
    private final ProjectTypeRepository projectTypeRepository;
    private final WorkCategoryRepository workCategoryRepository;
    private final WorkCategoryManagerRepository workCategoryManagerRepository;
    private final WorkCategoryDirectorRepository workCategoryDirectorRepository;

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

    @Cacheable(cacheNames = CacheNames.TASK_TYPES, key = "'all'")
    @Transactional(readOnly = true)
    public List<TaskType> listTaskTypes() {
        return taskTypeRepository.findAllByOrderBySortOrderAscNameAsc();
    }

    @Cacheable(cacheNames = CacheNames.TASK_CATEGORIES, key = "'all'")
    @Transactional(readOnly = true)
    public List<TaskCategory> listTaskCategories() {
        return taskCategoryRepository.findAllByOrderBySortOrderAscNameAsc();
    }

    @Cacheable(cacheNames = CacheNames.PROJECT_TYPES, key = "'all'")
    @Transactional(readOnly = true)
    public List<ProjectType> listProjectTypes() {
        return projectTypeRepository.findAllByOrderBySortOrderAscNameAsc();
    }

    @Cacheable(cacheNames = CacheNames.WORK_CATEGORIES, key = "'all'")
    @Transactional(readOnly = true)
    public List<WorkCategoryResponse> listWorkCategories() {
        List<WorkCategory> categories = workCategoryRepository.findAllByOrderBySortOrderAscNameAsc();
        Map<UUID, List<WorkCategoryManager>> byCategory = new LinkedHashMap<>();
        for (WorkCategoryManager assignment : workCategoryManagerRepository.findAllWithManager()) {
            byCategory.computeIfAbsent(assignment.getWorkCategory().getId(), ignored -> new ArrayList<>())
                    .add(assignment);
        }
        Map<UUID, List<WorkCategoryDirector>> directorsByCategory = new LinkedHashMap<>();
        for (WorkCategoryDirector assignment : workCategoryDirectorRepository.findAllWithDirector()) {
            directorsByCategory.computeIfAbsent(assignment.getWorkCategory().getId(), ignored -> new ArrayList<>())
                    .add(assignment);
        }
        return categories.stream()
                .map(category -> {
                    List<WorkCategoryResponse.ManagerItem> managers = managerItems(byCategory
                            .getOrDefault(category.getId(), List.of())
                            .stream()
                            .map(WorkCategoryManager::getEngineeringManager)
                            .toList());
                    List<WorkCategoryResponse.ManagerItem> directors = managerItems(directorsByCategory
                            .getOrDefault(category.getId(), List.of())
                            .stream()
                            .map(WorkCategoryDirector::getDirector)
                            .toList());
                    var group = category.getFunctionalUnitCategory();
                    return WorkCategoryResponse.builder()
                            .id(category.getId())
                            .name(category.getName())
                            .description(category.getDescription())
                            .sortOrder(category.getSortOrder())
                            .functionalUnitCategoryId(group != null ? group.getId() : null)
                            .functionalUnitCategoryName(group != null ? group.getName() : null)
                            .engineeringManagers(managers)
                            .directors(directors)
                            .build();
                })
                .toList();
    }

    private List<WorkCategoryResponse.ManagerItem> managerItems(List<TeamManagement> people) {
        return people.stream()
                .map(person -> WorkCategoryResponse.ManagerItem.builder()
                        .id(person.getId())
                        .name(person.getFullName())
                        .roleTitle(person.getRoleTitle())
                        .build())
                .sorted(Comparator.comparing(
                        WorkCategoryResponse.ManagerItem::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Cacheable(cacheNames = CacheNames.ISSUE_STATUSES, key = "'all'")
    @Transactional(readOnly = true)
    public List<IssueStatus> listStatuses() {
        return issueStatusRepository.findAllByOrderBySequenceAsc();
    }
}
