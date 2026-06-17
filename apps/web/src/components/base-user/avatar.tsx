import { UploadOutlined } from "@ant-design/icons";
import { Upload, type UploadFile, type UploadProps } from "antd";

import { accountAPI, appMessage } from "@/api";
import { useAuthStore } from "@/store/useAuthStore";

// const getBase64 = (img: UploadFile, callback: (url: string) => void) => {
//     const reader = new FileReader();
//     reader.addEventListener("load", () => callback(reader.result as string));
//     reader.readAsDataURL(img.originFileObj as Blob);
// };

const beforeUpload = async (file: UploadFile) => {
    if (!file.size) {
        return false;
    }
    const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";
    if (!isJpgOrPng) {
        appMessage.error("You can only upload JPG/JPEG/PNG file!");
        return false;
    }
    const isLimt = file.size / 1024 / 1024 <= 1;
    if (!isLimt) {
        appMessage.error("Image must be smaller than 1MB!");
        return false;
    }
    return isJpgOrPng && isLimt;
};
export const UserAvatar = () => {
    const { userInfo, updateAvatar } = useAuthStore();

    const uploadAvatar: UploadProps["customRequest"] = async ({ file, onError, onSuccess }) => {
        try {
            const avatarUrl = await accountAPI.updateAvatar({ file: file as Blob });
            updateAvatar(avatarUrl);
            onSuccess?.(avatarUrl);
        } catch (error) {
            onError?.(error as Error);
        }
    };

    return (
        <>
            <Upload
                accept="image/*"
                name="avatar"
                listType="picture-circle"
                showUploadList={false}
                beforeUpload={beforeUpload}
                customRequest={uploadAvatar}
            >
                {userInfo?.avatarUrl ? (
                    <img src={userInfo?.avatarUrl} className="rounded-full" alt="avatar" />
                ) : (
                    <UploadOutlined />
                )}
            </Upload>
            <div className="mt-2 w-full text-center">Upload avatar</div>
            <div className="w-full text-left text-gray-500">Format: JPG, PNG, JPEG</div>
            <div className="w-full text-left text-gray-500">Size: under 1 MB</div>
        </>
    );
};
