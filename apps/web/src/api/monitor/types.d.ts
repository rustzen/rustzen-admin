declare namespace Monitor {
    interface Overview {
        registeredNodes: number;
        onlineNodes: number;
        offlineNodes: number;
        activeIncidents: number;
        unhealthyChecks: number;
    }

    interface Node {
        id: string;
        agentId: string;
        hostname: string;
        agentVersion: string;
        lastSeenAt: string;
        cpuPercent: number | null;
        memoryUsedBytes: number | null;
        memoryTotalBytes: number | null;
        diskUsedBytes: number | null;
        diskTotalBytes: number | null;
        collectedAt: string | null;
        status: "online" | "offline";
    }

    interface MetricPoint {
        collectedAt: string;
        cpuPercent: number;
        memoryPercent: number;
        diskPercent: number;
    }

    interface MetricsQuery {
        from?: string;
        to?: string;
        bucket?: "raw" | "5m" | "1h";
    }

    interface Check {
        id: string;
        name: string;
        host: string;
        port: number;
        intervalSeconds: number;
        timeoutMs: number;
        failureThreshold: number;
        enabled: boolean;
        lastStatus: "up" | "down" | null;
        lastCheckedAt: string | null;
        lastLatencyMs: number | null;
        consecutiveFailures: number;
        createdAt: string;
        updatedAt: string;
    }

    interface SaveCheck {
        name: string;
        host: string;
        port: number;
        intervalSeconds?: number;
        timeoutMs?: number;
        failureThreshold?: number;
        enabled?: boolean;
    }

    interface CheckQuery {
        current?: number;
        pageSize?: number;
        enabled?: boolean;
        status?: "up" | "down";
    }

    interface CheckResult {
        id: number;
        checkId: string;
        status: "up" | "down";
        latencyMs: number | null;
        error: string | null;
        checkedAt: string;
    }

    interface ProbeResult {
        status: "up" | "down";
        latencyMs: number | null;
        error: string | null;
    }

    interface Incident {
        id: string;
        sourceType: "node" | "check" | "resource";
        sourceId: string;
        kind: string;
        title: string;
        status: "open" | "acknowledged" | "resolved";
        details: Record<string, unknown> | null;
        openedAt: string;
        acknowledgedAt: string | null;
        resolvedAt: string | null;
        lastObservedAt: string;
    }

    interface IncidentQuery {
        current?: number;
        pageSize?: number;
        status?: "active" | "open" | "acknowledged" | "resolved";
        sourceType?: "node" | "check" | "resource";
    }

    interface Page<T> {
        data: T[];
        total: number;
        success: boolean;
    }

    interface Settings {
        offlineAfterSeconds: number;
        metricsRetentionDays: number;
        checkResultRetentionDays: number;
        defaultCheckIntervalSeconds: number;
        defaultCheckTimeoutMs: number;
        failureThreshold: number;
        cpuThresholdPercent: number;
        memoryThresholdPercent: number;
        diskThresholdPercent: number;
        updatedAt: string;
    }

    type UpdateSettings = Omit<Settings, "updatedAt">;
}
