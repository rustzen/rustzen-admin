declare namespace Reports {
    interface System {
        id: string;
        name: string;
        baseUrl: string;
        enabled: boolean;
        notes: string;
        createdAt: string;
        updatedAt: string;
    }
    interface SaveSystem {
        name: string;
        baseUrl: string;
        enabled?: boolean;
        notes?: string;
    }
    interface Account {
        id: string;
        systemId: string;
        name: string;
        username: string;
        secretConfigured: boolean;
        createdAt: string;
        updatedAt: string;
    }
    interface SaveAccount {
        systemId: string;
        name: string;
        username: string;
        secret?: string;
    }
    type FlowStep =
        | { action: "goto"; url: string }
        | { action: "fill"; selector: string; value: string }
        | { action: "click"; selector: string }
        | { action: "waitFor"; selector: string }
        | { action: "assertText"; selector: string; text: string }
        | { action: "screenshot"; name?: string };
    interface Flow {
        id: string;
        systemId: string;
        name: string;
        steps: FlowStep[];
        createdAt: string;
        updatedAt: string;
    }
    interface SaveFlow {
        systemId: string;
        name: string;
        steps: FlowStep[];
    }
    interface Run {
        id: string;
        flowId: string;
        accountId: string | null;
        scheduleId: string | null;
        status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
        inputJson: string;
        error: string | null;
        createdAt: string;
        startedAt: string | null;
        finishedAt: string | null;
    }
    interface CreateRun {
        flowId: string;
        accountId?: string;
        input: Record<string, unknown>;
    }
    interface RunStep {
        id: number;
        runId: string;
        stepIndex: number;
        action: string;
        status: string;
        durationMs: number | null;
        message: string | null;
        createdAt: string;
    }
    interface Artifact {
        id: string;
        runId: string;
        kind: string;
        fileName: string;
        createdAt: string;
    }
    interface Schedule {
        id: string;
        name: string;
        flowId: string;
        accountId: string | null;
        cron: string;
        inputJson: string;
        enabled: boolean;
        nextRunAt: string | null;
        createdAt: string;
        updatedAt: string;
    }
    interface SaveSchedule {
        name: string;
        flowId: string;
        accountId?: string;
        cron: string;
        input: Record<string, unknown>;
        enabled?: boolean;
    }
    interface Page<T> {
        data: T[];
        total: number;
        success: boolean;
    }
    interface Settings {
        runRetentionDays: number;
        artifactRetentionDays: number;
        defaultStepTimeoutSeconds: number;
        maxRunTimeoutSeconds: number;
        updatedAt: string;
        maxConcurrency: number;
        headless: boolean;
        browserConfigured: boolean;
    }
    interface UpdateSettings {
        runRetentionDays: number;
        artifactRetentionDays: number;
        defaultStepTimeoutSeconds: number;
        maxRunTimeoutSeconds: number;
    }
}
