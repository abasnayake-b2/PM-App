package com.nexuspm.resource;

import com.nexuspm.project.ProjectService;
import com.nexuspm.resource.dto.TaskSummaryResponse;
import com.nexuspm.resource.entity.Task;
import com.nexuspm.resource.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectService projectService;

    @Transactional(readOnly = true)
    public List<TaskSummaryResponse> listTasks(UUID projectId) {
        if (projectId != null) {
            projectService.getProject(projectId);
        }
        return taskRepository.findByProject(projectId).stream()
                .map(this::toSummary)
                .toList();
    }

    private TaskSummaryResponse toSummary(Task task) {
        var project = task.getIssue().getProject();
        return TaskSummaryResponse.builder()
                .id(task.getId())
                .title(task.getTitle())
                .issueId(task.getIssue().getId())
                .issueTitle(task.getIssue().getTitle())
                .projectId(project.getId())
                .projectName(project.getName())
                .build();
    }
}
