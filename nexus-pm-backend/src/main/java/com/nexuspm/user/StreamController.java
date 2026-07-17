package com.nexuspm.user;

import com.nexuspm.user.dto.StreamResponse;
import com.nexuspm.user.repository.StreamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/streams")
@RequiredArgsConstructor
public class StreamController {

    private final StreamRepository streamRepository;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<StreamResponse> listStreams() {
        return streamRepository.findAllWithDepartment().stream()
                .map(s -> StreamResponse.builder()
                        .id(s.getId())
                        .name(s.getName())
                        .departmentId(s.getDepartment() != null ? s.getDepartment().getId() : null)
                        .departmentName(s.getDepartment() != null ? s.getDepartment().getName() : null)
                        .build())
                .toList();
    }
}
