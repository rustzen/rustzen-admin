import { apiDownload, apiRequest } from "@/api/request";

export const reportsAPI = {
    templates: () => apiRequest<Reports.Template[]>({ url: "/api/reports/templates" }),
    saveTemplate: (params: Reports.SaveTemplateInput) =>
        apiRequest<Reports.Template, Reports.SaveTemplateInput>({
            url: "/api/reports/templates",
            method: "POST",
            params,
        }),
    jobs: () => apiRequest<Reports.Job[]>({ url: "/api/reports/jobs" }),
    createJob: (params: Reports.CreateJobInput) =>
        apiRequest<Reports.Job, Reports.CreateJobInput>({
            url: "/api/reports/jobs",
            method: "POST",
            params,
        }),
    job: (jobId: string) => apiRequest<Reports.Job>({ url: `/api/reports/jobs/${jobId}` }),
    download: (jobId: string) =>
        apiDownload({ url: `/api/reports/jobs/${jobId}/download`, filename: `${jobId}.html` }),
};
