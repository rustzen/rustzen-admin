import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EditIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { appMessage, systemAPI } from "@/api";
import { AuthWrap } from "@/components/auth";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DataTableState } from "@/components/feedback/data-state";
import { TextField } from "@/components/form/text-field";
import { TextareaField } from "@/components/form/textarea-field";
import { PageCard } from "@/components/page/page-card";
import { DataTableShell } from "@/components/table/data-table-shell";
import { TablePagination } from "@/components/table/table-pagination";
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
import {
    localizeBuiltInMenuName,
    localizeBuiltInRoleDescription,
    localizeBuiltInRoleName,
} from "@/lib/builtin-i18n";
import { t } from "@/lib/i18n";

const OWNER_ROLE_CODE = "owner";
const BUILTIN_ROLE_CODES = new Set([OWNER_ROLE_CODE, "admin", "viewer"]);
const PAGE_SIZE = 20;

export const Route = createFileRoute("/system/role")({
    component: RolePage,
});

function RolePage() {
    const [currentPage, setCurrentPage] = useState(1);
    const [roleName, setRoleName] = useState("");
    const [roleCode, setRoleCode] = useState("");
    const [status, setStatus] = useState("all");
    const [filters, setFilters] = useState({
        roleName: "",
        roleCode: "",
        status: "all",
    });
    const params = useMemo<Role.QueryParams>(
        () => ({
            current: currentPage,
            pageSize: PAGE_SIZE,
            roleName: filters.roleName || undefined,
            roleCode: filters.roleCode || undefined,
            status: filters.status,
        }),
        [currentPage, filters],
    );
    const { data, error, isFetching, isPending, refetch } = useQuery({
        queryKey: ["system", "role", params],
        queryFn: () => systemAPI.role.list(params),
    });
    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const search = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setCurrentPage(1);
        setFilters({
            roleName: roleName.trim(),
            roleCode: roleCode.trim(),
            status,
        });
    };

    const reset = () => {
        setRoleName("");
        setRoleCode("");
        setStatus("all");
        setCurrentPage(1);
        setFilters({ roleName: "", roleCode: "", status: "all" });
    };

    const refresh = () => {
        void refetch();
    };

    return (
        <PageCard
            title={t("角色管理", "Role management")}
            description={t(
                "管理角色定义和权限分配。",
                "Manage role definitions and permission assignments.",
            )}
            actions={
                <AuthWrap code="system:role:create">
                    <RoleDialog mode="create" onSuccess={refresh}>
                        <Button>
                            <PlusIcon data-icon="inline-start" />
                            {t("新建角色", "New role")}
                        </Button>
                    </RoleDialog>
                </AuthWrap>
            }
            toolbar={
                <form className="grid gap-3 md:grid-cols-4" onSubmit={search}>
                    <Input
                        aria-label={t("角色名称", "Role name")}
                        value={roleName}
                        placeholder={t("角色名称", "Role name")}
                        onChange={(event) => setRoleName(event.target.value)}
                    />
                    <Input
                        aria-label={t("角色编码", "Role code")}
                        value={roleCode}
                        placeholder={t("角色编码", "Role code")}
                        onChange={(event) => setRoleCode(event.target.value)}
                    />
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-full" aria-label={t("角色状态", "Role status")}>
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
                            <TableHead className="min-w-48">{t("角色名称", "Role name")}</TableHead>
                            <TableHead className="min-w-48">{t("角色编码", "Role code")}</TableHead>
                            <TableHead className="min-w-64">{t("描述", "Description")}</TableHead>
                            <TableHead className="min-w-28">{t("状态", "Status")}</TableHead>
                            <TableHead className="min-w-40">{t("权限", "Permissions")}</TableHead>
                            <TableHead className="min-w-44">
                                {t("更新时间", "Updated at")}
                            </TableHead>
                            <TableHead className="w-24 text-right">
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
                                        {localizeBuiltInRoleName(record.code, record.name)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{record.code}</Badge>
                                    </TableCell>
                                    <TableCell className="max-w-72 truncate">
                                        {localizeBuiltInRoleDescription(
                                            record.code,
                                            record.description,
                                        ) || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <RoleStatusBadge status={record.status} />
                                    </TableCell>
                                    <TableCell>
                                        {record.menus?.length ? (
                                            <span
                                                title={record.menus
                                                    .map((menu) => menu.label)
                                                    .join(", ")}
                                            >
                                                {t(
                                                    `${record.menus.length} 项权限`,
                                                    `${record.menus.length} permissions`,
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                {t("暂无权限", "No permissions")}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>{formatDateTime(record.updatedAt)}</TableCell>
                                    <TableCell>
                                        <RoleActions record={record} onSuccess={refresh} />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState
                                colSpan={8}
                                kind="loading"
                                title={t("正在加载角色", "Loading roles")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={8}
                                kind="error"
                                title={t("角色加载失败", "Failed to load roles")}
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
                                colSpan={8}
                                kind="empty"
                                title={t("暂无角色", "No roles")}
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

function RoleActions({ record, onSuccess }: { record: Role.Item; onSuccess: () => void }) {
    if (isBuiltInRoleCode(record.code)) {
        return null;
    }

    return (
        <div className="flex justify-end gap-2">
            <AuthWrap code="system:role:update">
                <RoleDialog mode="edit" record={record} onSuccess={onSuccess}>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("编辑角色", "Edit role")}
                    >
                        <EditIcon />
                    </Button>
                </RoleDialog>
            </AuthWrap>
            <AuthWrap code="system:role:delete">
                <DeleteRoleDialog record={record} onSuccess={onSuccess} />
            </AuthWrap>
        </div>
    );
}

interface RoleDialogProps {
    record?: Partial<Role.Item>;
    mode?: "create" | "edit";
    children: ReactNode;
    onSuccess?: () => void;
}

const RoleDialog = ({ children, record, mode = "create", onSuccess }: RoleDialogProps) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [status, setStatus] = useState("1");
    const [description, setDescription] = useState("");
    const [menuIds, setMenuIds] = useState<number[]>([]);
    const [permissionSearch, setPermissionSearch] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { data: menuOptions = [] } = useQuery({
        queryKey: ["system", "menus", "options"],
        queryFn: systemAPI.menu.options,
        enabled: open,
    });
    const permissionOptions = useMemo(
        () =>
            menuOptions
                .filter((option) => option.value !== 0 && isAssignableRolePermission(option.code))
                .map((option) => ({
                    key: option.value,
                    title: localizeBuiltInMenuName({
                        name: option.label,
                        code: option.code,
                        isSystem: option.isSystem,
                        moduleId: option.moduleId,
                        moduleMenuCode: option.moduleMenuCode,
                    }),
                    code: option.code,
                })),
        [menuOptions],
    );
    const filteredPermissions = useMemo(() => {
        const query = permissionSearch.trim().toLowerCase();
        if (!query) {
            return permissionOptions;
        }
        return permissionOptions.filter(
            (option) =>
                option.title.toLowerCase().includes(query) ||
                option.code.toLowerCase().includes(query),
        );
    }, [permissionOptions, permissionSearch]);

    useEffect(() => {
        if (open) {
            setName(record?.name ?? "");
            setCode(record?.code ?? "");
            setStatus(String(record?.status ?? 1));
            setDescription(record?.description ?? "");
            setMenuIds(record?.menus?.map((menu) => menu.value) ?? []);
            setPermissionSearch("");
        }
    }, [record, open]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const payload = {
            name: name.trim(),
            code: code.trim(),
            status: Number(status),
            description: description.trim() || undefined,
            menuIds,
        };

        if (payload.name.length < 2 || payload.name.length > 50) {
            appMessage.error(
                t("角色名称必须为 2-50 个字符", "The role name must be 2–50 characters."),
            );
            return;
        }
        if (payload.code.length < 2 || payload.code.length > 50) {
            appMessage.error(
                t("角色编码必须为 2-50 个字符", "The role code must be 2–50 characters."),
            );
            return;
        }
        if (!/^[a-zA-Z_]+$/.test(payload.code)) {
            appMessage.error(
                t(
                    "角色编码只能包含字母和下划线",
                    "The role code may contain only letters and underscores.",
                ),
            );
            return;
        }
        if (payload.menuIds.length === 0) {
            appMessage.error(t("请至少选择一个权限", "Select at least one permission."));
            return;
        }

        setSubmitting(true);
        try {
            if (mode === "create") {
                await systemAPI.role.create(payload);
                appMessage.success(t("角色已创建", "Role created."));
            } else if (record?.id) {
                await systemAPI.role.update(record.id, payload);
                appMessage.success(t("角色已更新", "Role updated."));
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
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create"
                            ? t("创建角色", "Create role")
                            : t("编辑角色", "Edit role")}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            "配置角色标识、状态和可分配权限。",
                            "Configure the role identifier, status, and assignable permissions.",
                        )}
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <TextField
                            id="role-name"
                            label={t("角色名称", "Role name")}
                            value={name}
                            placeholder={t("请输入角色名称", "Enter a role name")}
                            onChange={setName}
                        />
                        <TextField
                            id="role-code"
                            label={t("角色编码", "Role code")}
                            value={code}
                            placeholder={t("请输入角色编码", "Enter a role code")}
                            onChange={setCode}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="role-status">{t("状态", "Status")}</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger id="role-status" className="w-full">
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
                    <PermissionPicker
                        options={filteredPermissions}
                        selectedCount={menuIds.length}
                        search={permissionSearch}
                        value={menuIds}
                        onSearchChange={setPermissionSearch}
                        onChange={setMenuIds}
                    />
                    <div className="grid gap-1">
                        <TextareaField
                            id="role-description"
                            label={t("描述", "Description")}
                            value={description}
                            maxLength={200}
                            placeholder={t("请输入角色描述", "Enter a role description")}
                            onChange={setDescription}
                        />
                        <div className="text-xs text-muted-foreground">
                            {description.length}/200
                        </div>
                    </div>
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

function PermissionPicker({
    options,
    selectedCount,
    search,
    value,
    onSearchChange,
    onChange,
}: {
    options: { key: number; title: string; code: string }[];
    selectedCount: number;
    search: string;
    value: number[];
    onSearchChange: (value: string) => void;
    onChange: (value: number[]) => void;
}) {
    const togglePermission = (permissionId: number, checked: boolean) => {
        if (checked) {
            onChange([...value, permissionId]);
            return;
        }
        onChange(value.filter((item) => item !== permissionId));
    };

    return (
        <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Label>{t("权限", "Permissions")}</Label>
                <span className="text-sm text-muted-foreground">
                    {t(`已选择 ${selectedCount} 项`, `${selectedCount} selected`)}
                </span>
            </div>
            <Input
                value={search}
                placeholder={t("搜索权限", "Search permissions")}
                onChange={(event) => onSearchChange(event.target.value)}
            />
            <div className="max-h-72 overflow-auto rounded-md border p-3">
                {options.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        {options.map((option) => (
                            <Label key={option.key} className="items-start justify-start">
                                <Checkbox
                                    checked={value.includes(option.key)}
                                    onCheckedChange={(checked) =>
                                        togglePermission(option.key, checked === true)
                                    }
                                />
                                <span className="grid gap-1">
                                    <span>{option.title}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {option.code}
                                    </span>
                                </span>
                            </Label>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground">
                        {t("未找到可分配权限。", "No assignable permissions found.")}
                    </div>
                )}
            </div>
        </div>
    );
}

function DeleteRoleDialog({ record, onSuccess }: { record: Role.Item; onSuccess: () => void }) {
    const submit = async () => {
        await systemAPI.role.delete(record.id);
        appMessage.success(t("角色已删除", "Role deleted."));
        onSuccess();
    };

    return (
        <ConfirmDialog
            trigger={
                <Button
                    type="button"
                    variant="ghost-destructive"
                    size="icon-sm"
                    aria-label={t("删除角色", "Delete role")}
                >
                    <TrashIcon />
                </Button>
            }
            title={t("删除角色", "Delete role")}
            description={t(
                `此操作无法撤销。确定删除角色 ${record.name}？`,
                `This action cannot be undone. Delete role ${record.name}?`,
            )}
            confirmLabel={t("删除", "Delete")}
            destructive
            onConfirm={submit}
        />
    );
}

function RoleStatusBadge({ status }: { status: number }) {
    const statusMeta = {
        1: { label: t("启用", "Enabled"), variant: "secondary" as const },
        2: { label: t("禁用", "Disabled"), variant: "outline" as const },
    };
    const meta = statusMeta[status as keyof typeof statusMeta] ?? {
        label: t("未知", "Unknown"),
        variant: "outline" as const,
    };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function isBuiltInRoleCode(code: string) {
    return BUILTIN_ROLE_CODES.has(code);
}

function isAssignableRolePermission(code: string) {
    const ownerOnlyRoots = ["system:module", "system:status", "manage:task", "manage:deploy"];
    if (code === "*") {
        return false;
    }
    if (ownerOnlyRoots.some((root) => code === root || code.startsWith(`${root}:`))) {
        return false;
    }
    if (!code.endsWith(":*")) {
        return true;
    }
    const wildcardPrefix = code.slice(0, -1);
    return !ownerOnlyRoots.some((root) => `${root}:`.startsWith(wildcardPrefix));
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "-";
    }
    return new Date(value).toLocaleString();
}
