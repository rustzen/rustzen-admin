import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EditIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { appMessage, systemAPI } from "@/api";
import { AuthWrap } from "@/components/auth";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DataTableState } from "@/components/feedback/data-state";
import { TextField } from "@/components/form/text-field";
import { PageCard } from "@/components/page/page-card";
import { DataTableShell } from "@/components/table/data-table-shell";
import { TablePagination } from "@/components/table/table-pagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { getEnableOptions } from "@/constant/options";
import { localizeBuiltInRoleName, localizeBuiltInUserName } from "@/lib/builtin-i18n";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/store/useAuthStore";

export const Route = createFileRoute("/system/user")({
    component: UserPage,
});

const PAGE_SIZE = 20;

const formatResetDateSuffix = (date: Date) => {
    const year = date.getFullYear() % 100;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${String(year).padStart(2, "0")}${String(month).padStart(2, "0")}${String(day).padStart(
        2,
        "0",
    )}`;
};

const buildResetPassword = (username: string, date = new Date()) => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
        return `User@${formatResetDateSuffix(date)}`;
    }
    const normalized = trimmedUsername.charAt(0).toUpperCase() + trimmedUsername.slice(1);
    return `${normalized}@${formatResetDateSuffix(date)}`;
};

function UserPage() {
    const currentUserId = useAuthStore((state) => state.userInfo?.id);
    const [currentPage, setCurrentPage] = useState(1);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [realName, setRealName] = useState("");
    const [status, setStatus] = useState("all");
    const [filters, setFilters] = useState({
        username: "",
        email: "",
        realName: "",
        status: "all",
    });
    const params = useMemo<User.QueryParams>(
        () => ({
            current: currentPage,
            pageSize: PAGE_SIZE,
            username: filters.username || undefined,
            email: filters.email || undefined,
            realName: filters.realName || undefined,
            status: filters.status,
        }),
        [currentPage, filters],
    );
    const { data, error, isFetching, isPending, refetch } = useQuery({
        queryKey: ["system", "user", params],
        queryFn: () => systemAPI.user.list(params),
    });
    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const search = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCurrentPage(1);
        setFilters({
            username: username.trim(),
            email: email.trim(),
            realName: realName.trim(),
            status,
        });
    };

    const reset = () => {
        setUsername("");
        setEmail("");
        setRealName("");
        setStatus("all");
        setCurrentPage(1);
        setFilters({ username: "", email: "", realName: "", status: "all" });
    };

    const refresh = () => {
        void refetch();
    };

    return (
        <PageCard
            title={t("用户列表", "Users")}
            description={t(
                "管理账号、角色和账号状态。",
                "Manage accounts, roles, and account status.",
            )}
            actions={
                <AuthWrap code="system:user:create">
                    <UserDialog mode="create" onSuccess={refresh}>
                        <Button>
                            <PlusIcon data-icon="inline-start" />
                            {t("新建用户", "New user")}
                        </Button>
                    </UserDialog>
                </AuthWrap>
            }
            toolbar={
                <form className="grid gap-3 md:grid-cols-5" onSubmit={search}>
                    <Input
                        aria-label={t("用户名", "Username")}
                        value={username}
                        placeholder={t("用户名", "Username")}
                        onChange={(event) => setUsername(event.target.value)}
                    />
                    <Input
                        aria-label={t("邮箱", "Email")}
                        value={email}
                        placeholder={t("邮箱", "Email")}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                    <Input
                        aria-label={t("真实姓名", "Real name")}
                        value={realName}
                        placeholder={t("真实姓名", "Real name")}
                        onChange={(event) => setRealName(event.target.value)}
                    />
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger
                            className="w-full"
                            aria-label={t("账号状态", "Account status")}
                        >
                            <SelectValue placeholder={t("状态", "Status")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="all">{t("全部状态", "All statuses")}</SelectItem>
                                {getEnableOptions().map((item) => (
                                    <SelectItem key={item.value} value={String(item.value)}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                        <Button type="submit" disabled={isFetching}>
                            {t("查询", "Search")}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isFetching}
                            onClick={reset}
                        >
                            {t("重置", "Reset")}
                        </Button>
                    </div>
                </form>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16">ID</TableHead>
                            <TableHead className="w-20">{t("头像", "Avatar")}</TableHead>
                            <TableHead className="min-w-36">{t("用户名", "Username")}</TableHead>
                            <TableHead className="min-w-48">{t("邮箱", "Email")}</TableHead>
                            <TableHead className="min-w-36">{t("真实姓名", "Real name")}</TableHead>
                            <TableHead className="min-w-28">{t("状态", "Status")}</TableHead>
                            <TableHead className="min-w-48">{t("角色", "Roles")}</TableHead>
                            <TableHead className="min-w-44">
                                {t("最后登录", "Last sign-in")}
                            </TableHead>
                            <TableHead className="min-w-44">
                                {t("更新时间", "Updated at")}
                            </TableHead>
                            <TableHead className="w-20 text-right">
                                {t("操作", "Actions")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length > 0 ? (
                            rows.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-medium">{record.id}</TableCell>
                                    <TableCell>
                                        <Avatar className="size-8">
                                            <AvatarImage
                                                src={record.avatarUrl ?? undefined}
                                                alt={record.username}
                                            />
                                            <AvatarFallback>
                                                {getUserInitial(record)}
                                            </AvatarFallback>
                                        </Avatar>
                                    </TableCell>
                                    <TableCell>{record.username}</TableCell>
                                    <TableCell>{record.email}</TableCell>
                                    <TableCell>
                                        {record.isSystem
                                            ? localizeBuiltInUserName(
                                                  record.username,
                                                  record.realName,
                                              )
                                            : record.realName || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <UserStatusBadge status={record.status} />
                                    </TableCell>
                                    <TableCell className="max-w-64 truncate">
                                        {record.roles
                                            .map((role) =>
                                                role.isSystem
                                                    ? localizeBuiltInRoleName(role.code, role.label)
                                                    : role.label,
                                            )
                                            .join(", ") || "-"}
                                    </TableCell>
                                    <TableCell>{formatDateTime(record.lastLoginAt)}</TableCell>
                                    <TableCell>{formatDateTime(record.updatedAt)}</TableCell>
                                    <TableCell>
                                        <UserActions
                                            record={record}
                                            currentUserId={currentUserId}
                                            onSuccess={refresh}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState
                                colSpan={10}
                                kind="loading"
                                title={t("正在加载用户", "Loading users")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={10}
                                kind="error"
                                title={t("用户加载失败", "Failed to load users")}
                                description={
                                    error instanceof Error
                                        ? error.message
                                        : t("请稍后重试。", "Please try again later.")
                                }
                                action={
                                    <Button onClick={() => void refetch()}>
                                        {t("重新加载", "Reload")}
                                    </Button>
                                }
                            />
                        ) : (
                            <DataTableState
                                colSpan={10}
                                kind="empty"
                                title={t("暂无用户", "No users")}
                            />
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
            <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                total={total}
                disabled={isFetching}
                onPageChange={setCurrentPage}
            />
        </PageCard>
    );
}

function UserActions({
    record,
    currentUserId,
    onSuccess,
}: {
    record: User.Item;
    currentUserId?: number;
    onSuccess: () => void;
}) {
    if (record.id === currentUserId || record.isSystem) {
        return null;
    }

    return (
        <div className="flex justify-end gap-2">
            <AuthWrap code="system:user:update">
                <UserDialog mode="edit" initialValues={record} onSuccess={onSuccess}>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("编辑用户", "Edit user")}
                    >
                        <EditIcon />
                    </Button>
                </UserDialog>
            </AuthWrap>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("更多用户操作", "More user actions")}
                    >
                        <MoreHorizontalIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <AuthWrap code="system:user:status">
                        <UserActionDialog
                            title={
                                record.status === 1
                                    ? t("禁用用户", "Disable user")
                                    : t("启用用户", "Enable user")
                            }
                            description={
                                record.status === 1
                                    ? t(
                                          `确定禁用用户 ${record.username}？`,
                                          `Disable user ${record.username}?`,
                                      )
                                    : t(
                                          `确定启用用户 ${record.username}？`,
                                          `Enable user ${record.username}?`,
                                      )
                            }
                            actionLabel={
                                record.status === 1 ? t("禁用", "Disable") : t("启用", "Enable")
                            }
                            onConfirm={async () => {
                                await systemAPI.user.status(record.id, record.status === 1 ? 2 : 1);
                                onSuccess();
                            }}
                        />
                    </AuthWrap>
                    <AuthWrap code="system:user:password">
                        <UserActionDialog
                            title={t("重置密码", "Reset password")}
                            description={t(
                                `确定重置用户 ${record.username} 的密码吗？`,
                                `Reset the password for user ${record.username}?`,
                            )}
                            actionLabel={t("重置密码", "Reset password")}
                            onConfirm={async () => {
                                const password = buildResetPassword(record.username);
                                await systemAPI.user.password(record.id, password);
                                appMessage.success(
                                    t(`密码已重置为 ${password}`, `Password reset to ${password}`),
                                );
                                onSuccess();
                            }}
                        />
                    </AuthWrap>
                    <AuthWrap code="system:user:delete">
                        <UserActionDialog
                            title={t("删除用户", "Delete user")}
                            description={t(
                                `确定删除用户 ${record.username}？此操作无法撤销。`,
                                `Delete user ${record.username}? This action cannot be undone.`,
                            )}
                            actionLabel={t("删除用户", "Delete user")}
                            destructive
                            onConfirm={async () => {
                                await systemAPI.user.delete(record.id);
                                onSuccess();
                            }}
                        />
                    </AuthWrap>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

interface UserDialogProps {
    initialValues?: Partial<User.Item>;
    mode?: "create" | "edit";
    children: ReactNode;
    onSuccess?: () => void;
}

const UserDialog = ({ children, initialValues, mode = "create", onSuccess }: UserDialogProps) => {
    const [open, setOpen] = useState(false);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [realName, setRealName] = useState("");
    const [password, setPassword] = useState("");
    const [status, setStatus] = useState("1");
    const [roleIds, setRoleIds] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const { data: roleOptions = [] } = useQuery({
        queryKey: ["system", "roles", "options"],
        queryFn: systemAPI.role.options,
        enabled: open,
    });

    useEffect(() => {
        if (open) {
            setUsername(initialValues?.username ?? "");
            setEmail(initialValues?.email ?? "");
            setRealName(initialValues?.realName ?? "");
            setPassword("");
            setStatus(String(initialValues?.status ?? 1));
            setRoleIds(initialValues?.roles?.map((role) => role.value) ?? []);
        }
    }, [initialValues, open]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedUsername = username.trim();
        const trimmedEmail = email.trim();
        const trimmedRealName = realName.trim();
        const trimmedPassword = password.trim();

        if (mode === "create" && trimmedUsername.length < 3) {
            appMessage.error(
                t("用户名至少需要 3 个字符", "The username must be at least 3 characters."),
            );
            return;
        }
        if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            appMessage.error(t("请输入有效的邮箱", "Enter a valid email address."));
            return;
        }
        if (!trimmedRealName) {
            appMessage.error(t("请输入真实姓名", "Enter the real name."));
            return;
        }
        if (mode === "create" && trimmedPassword.length < 6) {
            appMessage.error(
                t("密码至少需要 6 个字符", "The password must be at least 6 characters."),
            );
            return;
        }
        if (roleIds.length === 0) {
            appMessage.error(t("请至少选择一个角色", "Select at least one role."));
            return;
        }

        setSubmitting(true);
        try {
            if (mode === "create") {
                await systemAPI.user.create({
                    username: trimmedUsername,
                    email: trimmedEmail,
                    password: trimmedPassword,
                    realName: trimmedRealName,
                    status: Number(status),
                    roleIds,
                });
                appMessage.success(t("用户已创建", "User created."));
            } else if (initialValues?.id) {
                await systemAPI.user.update(initialValues.id, {
                    email: trimmedEmail,
                    realName: trimmedRealName,
                    roleIds,
                });
                appMessage.success(t("用户已更新", "User updated."));
            }
            onSuccess?.();
            setOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create"
                            ? t("创建用户", "Create user")
                            : t("编辑用户", "Edit user")}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === "create"
                            ? t("创建账号并分配角色。", "Create an account and assign roles.")
                            : t("更新账号信息和角色。", "Update account details and roles.")}
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <TextField
                        id="user-username"
                        label={t("用户名", "Username")}
                        value={username}
                        placeholder={t("请输入用户名", "Enter a username")}
                        disabled={mode === "edit"}
                        onChange={setUsername}
                    />
                    <TextField
                        id="user-email"
                        label={t("邮箱", "Email")}
                        value={email}
                        placeholder={t("请输入邮箱", "Enter an email address")}
                        onChange={setEmail}
                    />
                    <TextField
                        id="user-real-name"
                        label={t("真实姓名", "Real name")}
                        value={realName}
                        placeholder={t("请输入真实姓名", "Enter the real name")}
                        onChange={setRealName}
                    />
                    {mode === "create" && (
                        <TextField
                            id="user-password"
                            label={t("密码", "Password")}
                            value={password}
                            type="password"
                            placeholder={t("请输入密码", "Enter a password")}
                            onChange={setPassword}
                        />
                    )}
                    {mode === "create" && (
                        <div className="grid gap-2">
                            <Label htmlFor="user-status">{t("状态", "Status")}</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger id="user-status" className="w-full">
                                    <SelectValue placeholder={t("请选择状态", "Select a status")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {getEnableOptions().map((item) => (
                                            <SelectItem key={item.value} value={String(item.value)}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <RolePicker options={roleOptions} value={roleIds} onChange={setRoleIds} />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            {t("取消", "Cancel")}
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {mode === "create" ? t("创建", "Create") : t("保存", "Save")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

function RolePicker({
    options,
    value,
    onChange,
}: {
    options: Role.OptionItem[];
    value: number[];
    onChange: (value: number[]) => void;
}) {
    const toggleRole = (roleId: number, checked: boolean) => {
        if (checked) {
            onChange([...value, roleId]);
            return;
        }
        onChange(value.filter((item) => item !== roleId));
    };

    return (
        <div className="grid gap-2">
            <Label>{t("角色", "Roles")}</Label>
            <div className="max-h-40 overflow-auto rounded-md border p-3">
                {options.length > 0 ? (
                    <div className="grid gap-3">
                        {options.map((role) => (
                            <Label key={role.value} className="justify-start">
                                <Checkbox
                                    checked={value.includes(role.value)}
                                    onCheckedChange={(checked) =>
                                        toggleRole(role.value, checked === true)
                                    }
                                />
                                {role.isSystem
                                    ? localizeBuiltInRoleName(role.code, role.label)
                                    : role.label}
                            </Label>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground">
                        {t("暂无可用角色。", "No roles available.")}
                    </div>
                )}
            </div>
        </div>
    );
}

function UserActionDialog({
    title,
    description,
    actionLabel,
    destructive = false,
    onConfirm,
}: {
    title: string;
    description: string;
    actionLabel: string;
    destructive?: boolean;
    onConfirm: () => Promise<void>;
}) {
    return (
        <ConfirmDialog
            trigger={
                <DropdownMenuItem
                    className={destructive ? "text-destructive" : undefined}
                    onSelect={(event) => event.preventDefault()}
                >
                    {actionLabel}
                </DropdownMenuItem>
            }
            title={title}
            description={description}
            confirmLabel={actionLabel}
            destructive={destructive}
            onConfirm={onConfirm}
        />
    );
}

function UserStatusBadge({ status }: { status: number }) {
    const statusMeta = {
        1: { label: t("启用", "Enabled"), variant: "secondary" as const },
        2: { label: t("禁用", "Disabled"), variant: "outline" as const },
        3: { label: t("待审核", "Pending"), variant: "default" as const },
        4: { label: t("已锁定", "Locked"), variant: "destructive" as const },
    };
    const meta = statusMeta[status as keyof typeof statusMeta] ?? {
        label: t("未知", "Unknown"),
        variant: "outline" as const,
    };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function getUserInitial(record: User.Item) {
    const name = record.isSystem
        ? localizeBuiltInUserName(record.username, record.realName)
        : record.realName || record.username;
    return name.slice(0, 1).toUpperCase();
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "-";
    }
    return new Date(value).toLocaleString();
}
