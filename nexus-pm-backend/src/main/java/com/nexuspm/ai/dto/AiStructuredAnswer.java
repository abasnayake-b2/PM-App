package com.nexuspm.ai.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class AiStructuredAnswer {
    private String title;
    private String summary;
    private List<Metric> metrics;
    private List<TableBlock> tables;
    private List<String> caveats;
    private List<Source> sources;

    @Getter
    @Builder
    public static class Metric {
        private String label;
        private String value;
    }

    @Getter
    @Builder
    public static class TableBlock {
        private String title;
        private List<String> columns;
        private List<List<String>> rows;
    }

    @Getter
    @Builder
    public static class Source {
        private String toolKey;
        private String label;
        private String href;
    }
}
