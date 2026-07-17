package com.nexuspm.auth.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LoginResult {

    private TokenResponse tokenResponse;
    private String refreshToken;
}
