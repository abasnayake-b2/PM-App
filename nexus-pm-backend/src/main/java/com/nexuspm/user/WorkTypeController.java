package com.nexuspm.user;

import com.nexuspm.user.dto.WorkTypeResponse;
import com.nexuspm.user.repository.WorkTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/work-types")
@RequiredArgsConstructor
public class WorkTypeController {

    private final WorkTypeRepository workTypeRepository;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<WorkTypeResponse> listWorkTypes() {
        return workTypeRepository.findAll().stream()
                .map(w -> WorkTypeResponse.builder().id(w.getId()).name(w.getName()).build())
                .toList();
    }
}
