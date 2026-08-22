package com.nexuspm.issue;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Excel header aliases for the New RD workbook. Keys are alphanumeric-lowercase.
 */
final class IssueNewRdColumnMap {

    enum Kind {
        TITLE,
        BMS_ID,
        STATUS,
        PRIORITY,
        PROJECT,
        PRODUCT,
        TYPE,
        JIRA_ID,
        CUSTOM,
        NOTE,
        RISK_DESCRIPTION,
        RISK_CREATED,
        RISK_OWNER,
        RISK_STATUS,
        RISK_IMPACT,
        RISK_CLOSED,
        RISK_MITIGATION
    }

    record Target(Kind kind, String fieldKey) {
        static Target core(Kind kind) {
            return new Target(kind, null);
        }

        static Target custom(String fieldKey) {
            return new Target(Kind.CUSTOM, fieldKey);
        }
    }

    private static final Map<String, Target> ALIASES = new LinkedHashMap<>();

    static {
        alias("changerequestname", Target.core(Kind.TITLE));
        alias("title", Target.core(Kind.TITLE));
        alias("crname", Target.core(Kind.TITLE));

        alias("cr", Target.core(Kind.BMS_ID));
        alias("crno", Target.core(Kind.BMS_ID));
        alias("crnoid", Target.core(Kind.BMS_ID));
        alias("crnumber", Target.core(Kind.BMS_ID));
        alias("bmsid", Target.core(Kind.BMS_ID));
        alias("bms", Target.core(Kind.BMS_ID));

        alias("currentstage", Target.core(Kind.STATUS));
        alias("stage", Target.core(Kind.STATUS));
        alias("status", Target.core(Kind.STATUS));

        alias("priority", Target.core(Kind.PRIORITY));

        alias("project", Target.core(Kind.PROJECT));
        alias("projectname", Target.core(Kind.PROJECT));
        alias("nameofproject", Target.core(Kind.PROJECT));
        alias("projecttitle", Target.core(Kind.PROJECT));
        alias("product", Target.core(Kind.PRODUCT));

        alias("type", Target.core(Kind.TYPE));
        alias("issuetype", Target.core(Kind.TYPE));

        alias("jiraid", Target.core(Kind.JIRA_ID));
        alias("jira", Target.core(Kind.JIRA_ID));

        alias("sow", Target.custom("sow"));
        alias("coverdinexistingresources", Target.custom("covered_in_existing_resources"));
        alias("coveredinexistingresources", Target.custom("covered_in_existing_resources"));
        alias("crtype", Target.custom("cr_type"));
        alias("majorcr", Target.custom("major_cr"));
        alias("majorcryesno", Target.custom("major_cr"));
        alias("deliveryquarter", Target.custom("delivery_quarter"));
        alias("deliveryyear", Target.custom("delivery_year"));
        alias("percentagecompletion", Target.custom("percentage_completion"));
        alias("completion", Target.custom("percentage_completion"));
        alias("completionpct", Target.custom("percentage_completion"));
        alias("ragstatus", Target.custom("rag_status"));

        alias("requirementinitdiateddate", Target.custom("requirement_initiated_date"));
        alias("requirementinidtiateddate", Target.custom("requirement_initiated_date"));
        alias("requirementinitiateddate", Target.custom("requirement_initiated_date"));
        alias("brdrequesteddate", Target.custom("brd_requested_date"));
        alias("brdreceiveddate", Target.custom("brd_received_date"));
        alias("brdrecieveddate", Target.custom("brd_received_date"));
        alias("baballeparkeffort", Target.custom("ba_ballpark_effort"));
        alias("baballparkeffort", Target.custom("ba_ballpark_effort"));
        alias("highlevelrddeliveryeta", Target.custom("highlevel_rd_delivery_eta"));
        alias("pendinghighlevelrdsignoff", Target.custom("pending_highlevel_rd_signoff"));
        alias("bpefforteta", Target.custom("bp_effort_eta"));
        alias("bpeffort", Target.custom("bp_effort"));
        alias("bpeffortaccepteddate", Target.custom("bp_effort_accepted_date"));
        alias("rdstartdate", Target.custom("rd_start_date"));
        alias("rddeliveryeta", Target.custom("rd_delivery_eta"));
        alias("rdsignedoffdate", Target.custom("rd_sign_off_date"));
        alias("rdsignoffdate", Target.custom("rd_sign_off_date"));
        alias("totalefforteta", Target.custom("total_effort_eta"));
        alias("quotationshareddate", Target.custom("quotation_shared_date"));
        alias("quotationaccepteddate", Target.custom("quotation_approved_date"));
        alias("quotationapproveddate", Target.custom("quotation_approved_date"));
        alias("dealdeskapprovalstatus", Target.custom("deal_desk_approval_status"));
        alias("requirementauditdate", Target.custom("requirement_audit_date"));

        alias("costingdone", Target.custom("costing_done"));
        alias("quotedone", Target.custom("quote_done"));
        alias("quotation", Target.custom("quotation"));
        alias("quotationcostest", Target.custom("quotation"));
        alias("payment", Target.custom("payment_status"));
        alias("paymentstatus", Target.custom("payment_status"));

        alias("mandaysplanned", Target.custom("md_planned"));
        alias("planned", Target.custom("md_planned"));
        alias("mandaysadditional", Target.custom("md_additional"));
        alias("additional", Target.custom("md_additional"));
        alias("mandaystotal", Target.custom("md_total"));
        alias("toal", Target.custom("md_total"));
        alias("mandaysactuallyutilized", Target.custom("md_actually_utilized"));
        alias("actuallyutilized", Target.custom("md_actually_utilized"));
        alias("mandaysremaining", Target.custom("md_remaining"));
        alias("remaining", Target.custom("md_remaining"));
        alias("overutilizaion", Target.custom("over_utilization_pct"));
        alias("overutilization", Target.custom("over_utilization_pct"));
        alias("overutilizationpct", Target.custom("over_utilization_pct"));

        alias("devstartdate", Target.custom("dev_start_date"));
        alias("devenddate", Target.custom("dev_end_date"));
        alias("sitstartdate", Target.custom("sit_start_date"));
        alias("sitenddate", Target.custom("sit_end_date"));
        alias("uatstartdate", Target.custom("uat_start_date"));
        alias("uatenddate", Target.custom("uat_end_date"));
        alias("proddate", Target.custom("prod_date"));
        alias("nextuatrelease", Target.custom("next_uat_release"));
        alias("releasecount", Target.custom("release_count"));
        alias("uatdefectcount", Target.custom("uat_defect_count"));
        alias("nextproductionrelease", Target.custom("next_production_release"));
        alias("releaseauditdate", Target.custom("release_audit_date"));
        alias("lastactiondate", Target.custom("last_action_date"));

        alias("riskcount", Target.custom("risk_count"));

        alias("note", Target.core(Kind.NOTE));
        alias("notes", Target.core(Kind.NOTE));

        alias("riskdescription", Target.core(Kind.RISK_DESCRIPTION));
        alias("riskcreateddate", Target.core(Kind.RISK_CREATED));
        alias("riskcreaateddate", Target.core(Kind.RISK_CREATED));
        alias("riskowner", Target.core(Kind.RISK_OWNER));
        alias("riskstatus", Target.core(Kind.RISK_STATUS));
        alias("riskimpact", Target.core(Kind.RISK_IMPACT));
        alias("riskcloseddate", Target.core(Kind.RISK_CLOSED));
        alias("riskmitigation", Target.core(Kind.RISK_MITIGATION));
    }

    private IssueNewRdColumnMap() {
    }

    static String normalize(String header) {
        if (header == null) {
            return "";
        }
        return header.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    static Target resolve(String header, Map<String, String> labelToFieldKey) {
        String key = normalize(header);
        if (key.isEmpty()) {
            return null;
        }
        Target alias = ALIASES.get(key);
        if (alias != null) {
            return alias;
        }
        String fieldKey = labelToFieldKey.get(key);
        if (fieldKey != null) {
            return Target.custom(fieldKey);
        }
        return null;
    }

    private static void alias(String normalizedHeader, Target target) {
        ALIASES.put(normalizedHeader, target);
    }
}
