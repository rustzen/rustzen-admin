declare namespace SystemStatus {
    interface Overview {
        collectedAt: string;
        storage: StorageStatus;
        resource: LocalResourceStatus;
    }

    interface StorageStatus {
        database: SqliteStorageStatus;
        directories: DirectoryStorageItem[];
    }

    interface SqliteStorageStatus {
        totalBytes: number;
        mainBytes: number;
        walBytes: number;
        shmBytes: number;
    }

    interface DirectoryStorageItem {
        key: string;
        label: string;
        sizeBytes: number;
        errorMessage?: string | null;
    }

    interface LocalResourceStatus {
        cpu: CpuResourceStatus;
        memory: MemoryResourceStatus;
        disk: DiskResourceStatus;
    }

    interface CpuResourceStatus {
        cores: number;
        usagePercent: number;
    }

    interface MemoryResourceStatus {
        totalBytes: number;
        usedBytes: number;
        availableBytes: number;
        usagePercent: number;
    }

    interface DiskResourceStatus {
        totalBytes: number;
        usedBytes: number;
        availableBytes: number;
        usagePercent: number;
    }
}
