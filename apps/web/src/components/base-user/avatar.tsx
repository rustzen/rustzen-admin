import { UploadIcon } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

import { accountAPI, appMessage } from "@/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";

const MAX_AVATAR_SIZE = 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png"]);

export const UserAvatar = () => {
    const { userInfo, updateAvatar } = useAuthStore();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }

        if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
            appMessage.error("You can only upload JPG/JPEG/PNG file!");
            return;
        }
        if (file.size > MAX_AVATAR_SIZE) {
            appMessage.error("Image must be smaller than 1MB!");
            return;
        }

        setUploading(true);
        try {
            const avatarUrl = await accountAPI.updateAvatar({ file });
            updateAvatar(avatarUrl);
            appMessage.success("Avatar updated");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex w-full flex-col items-center gap-3 text-center">
            <Avatar className="size-24 border">
                <AvatarImage src={userInfo?.avatarUrl ?? undefined} alt={userInfo?.realName || userInfo?.username || ""} />
                <AvatarFallback>{avatarFallback(userInfo)}</AvatarFallback>
            </Avatar>
            <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleFileChange}
            />
            <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
            >
                <UploadIcon data-icon="inline-start" />
                {uploading ? "Uploading" : "Upload avatar"}
            </Button>
            <div className="text-sm text-muted-foreground">
                <div>Format: JPG, PNG, JPEG</div>
                <div>Size: under 1 MB</div>
            </div>
        </div>
    );
};

const avatarFallback = (userInfo: Auth.UserInfoResponse | null) => {
    const displayName = userInfo?.realName || userInfo?.username || "RA";
    return displayName.slice(0, 2).toUpperCase();
};
