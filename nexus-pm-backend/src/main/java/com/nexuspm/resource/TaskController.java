package com.nexuspm.resource;

import com.nexuspm.resource.dto.TaskSummaryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping
    @PreAuthorize("@perm.can('ALLOCATIONS_VIEW')")
    public List<TaskSummaryResponse> listTasks(@RequestParam(required = false) UUID projectId) {
        return taskService.listTasks(projectId);
    }
}
