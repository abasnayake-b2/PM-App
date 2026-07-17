package com.nexuspm.user;

import com.nexuspm.user.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
public class UserManagementController {

    private final UserManagementService userManagementService;

    @GetMapping
    @PreAuthorize("@perm.can('USERS_VIEW')")
    public List<UserAccountResponse> listUserAccounts(@RequestParam(required = false) String search) {
        return userManagementService.listUserAccounts(search);
    }

    @GetMapping("/eligible-management")
    @PreAuthorize("@perm.can('USERS_VIEW')")
    public List<EligibleManagementOption> listEligibleManagement(@RequestParam(required = false) String search) {
        return userManagementService.listEligibleManagement(search);
    }

    @GetMapping("/{id}")
    @PreAuthorize("@perm.can('USERS_VIEW')")
    public UserAccountResponse getUserAccount(@PathVariable UUID id) {
        return userManagementService.getUserAccount(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@perm.can('USERS_CREATE')")
    public UserAccountResponse createUserAccount(@Valid @RequestBody CreateUserAccountRequest request) {
        return userManagementService.createUserAccount(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@perm.can('USERS_UPDATE')")
    public UserAccountResponse updateUserAccount(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserAccountRequest request) {
        return userManagementService.updateUserAccount(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("@perm.can('USERS_DELETE')")
    public void deleteUserAccount(@PathVariable UUID id) {
        userManagementService.deleteUserAccount(id);
    }

    @PostMapping("/{id}/unlock")
    @PreAuthorize("@perm.can('USERS_UPDATE')")
    public UserAccountResponse unlockUserAccount(@PathVariable UUID id) {
        return userManagementService.unlockUserAccount(id);
    }
}
