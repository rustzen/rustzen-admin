declare namespace Insights {
    interface Project {
        id: string;
        name: string;
        allowedOrigins: string[];
        archivedAt: string | null;
        createdAt: string;
        updatedAt: string;
    }

    interface CreatedProject extends Project {
        projectKey: string;
    }

    interface ProjectKey {
        projectKey: string;
    }

    interface SaveProjectInput {
        name: string;
        allowedOrigins: string[];
    }

    interface TimeQuery {
        projectId: string;
        from?: string;
        to?: string;
    }

    interface OverviewQuery extends TimeQuery {}

    interface TrendPoint {
        date: string;
        pv: number;
        uv: number;
        requestCount: number;
        errorCount: number;
    }

    interface Overview {
        pv: number;
        uv: number;
        eventCount: number;
        requestCount: number;
        errorCount: number;
        averageDurationMs: number;
        p95DurationMs: number;
        trend: TrendPoint[];
    }

    interface Page<T> {
        data: T[];
        total: number;
        success: boolean;
    }

    interface ListQuery extends TimeQuery {
        current?: number;
        pageSize?: number;
    }

    interface PageQuery extends ListQuery {
        path?: string;
    }
    interface ApiQuery extends ListQuery {
        path?: string;
    }
    interface EventQuery extends ListQuery {
        eventName?: string;
        visitorId?: string;
        platform?: string;
    }
    interface UserQuery extends ListQuery {
        keyword?: string;
    }

    interface PageStat {
        pagePath: string;
        pv: number;
        uv: number;
        averageDurationMs: number;
        lastSeenAt: string;
    }

    interface ApiStat {
        apiPath: string;
        apiMethod: string | null;
        requestCount: number;
        errorCount: number;
        errorRate: number;
        averageDurationMs: number;
        p95DurationMs: number;
        lastSeenAt: string;
    }

    interface Event {
        id: number;
        eventName: string;
        visitorId: string;
        userId: string | null;
        sessionId: string | null;
        platform: string | null;
        pagePath: string | null;
        referrer: string | null;
        apiPath: string | null;
        apiMethod: string | null;
        statusCode: number | null;
        durationMs: number | null;
        isError: boolean;
        properties: Record<string, unknown>;
        occurredAt: string;
        receivedAt: string;
    }

    interface UserStat {
        visitorId: string;
        userId: string | null;
        platform: string | null;
        eventCount: number;
        firstSeenAt: string;
        lastSeenAt: string;
    }

    interface Settings {
        eventRetentionDays: number;
        defaultQueryDays: number;
        maxQueryDays: number;
        maxBatchEvents: number;
        businessTimezone: string;
        updatedAt: string;
    }

    interface UpdateSettings {
        eventRetentionDays: number;
        defaultQueryDays: number;
        maxQueryDays: number;
    }
}
