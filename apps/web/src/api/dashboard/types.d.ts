declare namespace Dashboard {
    // 顶部统计卡片
    interface Stats {
        totalUsers: number; // 总用户数
        activeUsers: number; // 活跃用户数（7天内登录）
        todayLogins: number; // 今日登录次数
        pendingUsers: number; // 待审核用户数
    }

    interface ModuleHealth {
        module: "monitor" | "insights" | "reports";
        available: boolean;
        releaseVersion: string | null;
    }
}
