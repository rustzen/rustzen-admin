declare namespace Monitor {
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
}
