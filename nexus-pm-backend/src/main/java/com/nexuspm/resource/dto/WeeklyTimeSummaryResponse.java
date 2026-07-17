package com.nexuspm.resource.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class WeeklyTimeSummaryResponse {

    private LocalDate weekStart;
    private LocalDate weekEnd;
    private BigDecimal totalHours;
    private List<DailyHours> days;

    @Data
    @Builder
    public static class DailyHours {
        private LocalDate date;
        private BigDecimal hours;
    }
}
