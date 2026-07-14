declare namespace Reports {
    interface Template {
        id: string;
        name: string;
        content: string;
        createdAt: string;
        updatedAt: string;
    }

    interface SaveTemplateInput {
        id?: string;
        name: string;
        content: string;
    }

    interface Job {
        id: string;
        templateId: string;
        status: "queued" | "running" | "succeeded" | "failed";
        inputJson: string;
        outputFile: string | null;
        error: string | null;
        createdAt: string;
        startedAt: string | null;
        finishedAt: string | null;
        expiresAt: string;
    }

    interface CreateJobInput {
        templateId: string;
        data: Record<string, unknown>;
    }
}
