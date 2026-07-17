package com.nexuspm.notification.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UnreadCountResponse {

    private long count;
}
