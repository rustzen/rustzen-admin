import { EditIcon, LockIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { accountAPI, appMessage } from "@/api";
import { UserAvatar } from "@/components/base-user";
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
import { useAuthStore } from "@/store/useAuthStore";

export const Route = createFileRoute("/profile")({
    component: ProfilePage,
});

function ProfilePage() {
    const { userInfo, updateUserInfo } = useAuthStore();

    return (
        <div className="grid gap-5 xl:grid-cols-[minmax(520px,1fr)_420px]">
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle>User Profile</CardTitle>
                        <CardDescription>Manage your personal account information.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <EditProfileDialog userInfo={userInfo} onUpdated={updateUserInfo} />
                        <ChangePasswordDialog />
                    </div>
                </CardHeader>
                <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="grid gap-4">
                        <ProfileField label="Username" value={userInfo?.username} />
                        <ProfileField label="Email" value={userInfo?.email} />
                        <ProfileField label="Real Name" value={userInfo?.realName} />
                    </div>
                    <div className="flex flex-col items-center">
                        <UserAvatar />
                    </div>
                </CardContent>
            </Card>
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
            appMessage.error("Please enter email");
            return;
        }

        setSubmitting(true);
        try {
            const nextUserInfo = await accountAPI.updateProfile({
                email: email.trim(),
                realName: realName.trim() || null,
            });
            onUpdated(nextUserInfo);
            appMessage.success("Profile updated");
            setOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit profile">
                    <EditIcon />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>Update your email and display name.</DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="profile-email">
                            Email
                        </label>
                        <Input
                            id="profile-email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="profile-real-name">
                            Real Name
                        </label>
                        <Input
                            id="profile-real-name"
                            value={realName}
                            onChange={(event) => setRealName(event.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            Save
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
            appMessage.error("Please fill all password fields");
            return;
        }
        if (newPassword !== confirmPassword) {
            appMessage.error("The two passwords do not match");
            return;
        }

        setSubmitting(true);
        try {
            await accountAPI.changePassword({
                currentPassword,
                newPassword,
                confirmPassword,
            });
            appMessage.success("Password changed");
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
                <Button variant="ghost" size="icon" aria-label="Change password">
                    <LockIcon />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>Use a new password that is not used elsewhere.</DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <PasswordField
                        id="current-password"
                        label="Current Password"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                    />
                    <PasswordField
                        id="new-password"
                        label="New Password"
                        value={newPassword}
                        onChange={setNewPassword}
                    />
                    <PasswordField
                        id="confirm-password"
                        label="Confirm Password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            Save
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
