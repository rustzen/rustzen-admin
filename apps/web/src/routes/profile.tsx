import { createFileRoute } from "@tanstack/react-router";
import { EditIcon, LockIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { accountAPI, appMessage } from "@/api";
import { PageHeader } from "@/components/page/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user";
import { useAuthStore } from "@/store/useAuthStore";

export const Route = createFileRoute("/profile")({
    component: ProfilePage,
});

function ProfilePage() {
    const { userInfo, updateUserInfo } = useAuthStore();

    return (
        <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto pr-1">
            <PageHeader title="个人资料" description="管理个人账号信息与登录凭据。" />
            <div className="grid xl:grid-cols-[minmax(520px,1fr)_420px]">
                <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                        <div>
                            <CardTitle>账号信息</CardTitle>
                            <CardDescription>查看并维护当前账号资料。</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <EditProfileDialog userInfo={userInfo} onUpdated={updateUserInfo} />
                            <ChangePasswordDialog />
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="grid gap-4">
                            <ProfileField label="用户名" value={userInfo?.username} />
                            <ProfileField label="邮箱" value={userInfo?.email} />
                            <ProfileField label="真实姓名" value={userInfo?.realName} />
                        </div>
                        <div className="flex flex-col items-center">
                            <UserAvatar />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function EditProfileDialog({
    userInfo,
    onUpdated,
}: {
    userInfo: Auth.UserInfoResponse | null;
    onUpdated: (value: Auth.UserInfoResponse) => void;
}) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [realName, setRealName] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setEmail(userInfo?.email ?? "");
            setRealName(userInfo?.realName ?? "");
        }
    }, [open, userInfo?.email, userInfo?.realName]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!email.trim()) {
            appMessage.error("请输入邮箱");
            return;
        }

        setSubmitting(true);
        try {
            const nextUserInfo = await accountAPI.updateProfile({
                email: email.trim(),
                realName: realName.trim() || null,
            });
            onUpdated(nextUserInfo);
            appMessage.success("个人资料已更新");
            setOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="编辑个人资料">
                    <EditIcon />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>编辑个人资料</DialogTitle>
                    <DialogDescription>更新邮箱和显示名称。</DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="profile-email">
                            邮箱
                        </label>
                        <Input
                            id="profile-email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="profile-real-name">
                            真实姓名
                        </label>
                        <Input
                            id="profile-real-name"
                            value={realName}
                            onChange={(event) => setRealName(event.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            取消
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            保存
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ChangePasswordDialog() {
    const [open, setOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!currentPassword || !newPassword || !confirmPassword) {
            appMessage.error("请填写全部密码字段");
            return;
        }
        if (newPassword !== confirmPassword) {
            appMessage.error("两次输入的密码不一致");
            return;
        }

        setSubmitting(true);
        try {
            await accountAPI.changePassword({
                currentPassword,
                newPassword,
                confirmPassword,
            });
            appMessage.success("密码已修改");
            reset();
            setOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    reset();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="修改密码">
                    <LockIcon />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>修改密码</DialogTitle>
                    <DialogDescription>请使用未在其他系统中使用的新密码。</DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <PasswordField
                        id="current-password"
                        label="当前密码"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                    />
                    <PasswordField
                        id="new-password"
                        label="新密码"
                        value={newPassword}
                        onChange={setNewPassword}
                    />
                    <PasswordField
                        id="confirm-password"
                        label="确认密码"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            取消
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            保存
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PasswordField({
    id,
    label,
    value,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor={id}>
                {label}
            </label>
            <Input
                id={id}
                type="password"
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <p className="mb-1 text-sm text-muted-foreground">{label}</p>
            <p className="text-sm">{value || "-"}</p>
        </div>
    );
}
