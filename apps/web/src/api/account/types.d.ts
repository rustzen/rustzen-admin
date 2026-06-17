declare namespace Account {
    interface UpdateProfileRequest {
        email: string;
        realName?: string | null;
    }

    interface ChangePasswordRequest {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    }

    interface UpdateAvatarForm {
        file: Blob;
    }
}
