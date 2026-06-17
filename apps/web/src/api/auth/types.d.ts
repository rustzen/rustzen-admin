declare namespace Auth {
    interface LoginRequest {
        username: string;
        password: string;
    }

    interface LoginResponse {
        token: string;
        userInfo: UserInfoResponse;
    }

    interface UserInfoResponse {
        id: number;
        username: string;
        email?: string | null;
        realName?: string | null;
        avatarUrl?: string | null;
        permissions: string[];
        isSystem: boolean;
    }

}
