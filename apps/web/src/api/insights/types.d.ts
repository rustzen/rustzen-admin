declare namespace Insights {
    interface Project {
        id: string;
        name: string;
        allowedOrigins: string;
        createdAt: string;
    }

    interface CreatedProject {
        id: string;
        name: string;
        projectKey: string;
        allowedOrigins: string[];
    }

    interface CreateProjectInput {
        name: string;
        allowedOrigins: string[];
    }

    interface OverviewQuery {
        projectId: string;
        from?: string;
        to?: string;
    }

    interface Overview {
        pv: number;
        uv: number;
        requestCount: number;
        errorCount: number;
        averageDurationMs: number;
        p95DurationMs: number;
    }
}
