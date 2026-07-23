import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EditIcon, PlusIcon, StopCircleIcon } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { appMessage, systemAPI } from "@/api";
import { menuQueryOptions } from "@/api/system/menu/query-options";
import { AuthWrap } from "@/components/auth";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DataTableState } from "@/components/feedback/data-state";
import { TextField } from "@/components/form/text-field";
import { PageCard } from "@/components/page/page-card";
import { DataTableShell } from "@/components/table/data-table-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getEnableOptions, getMenuTypeOptions, getModuleIconOptions } from "@/constant/options";
import { localizeBuiltInMenuName } from "@/lib/builtin-i18n";
import { formatDateTime } from "@/lib/format-date-time";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/system/menu")({
    component: MenuPage,
});

type FlatMenuItem = Menu.Item & {
    depth: number;
};

function MenuPage() {
    const { data, error, isPending, refetch } = useQuery({
        queryKey: ["system", "menu"],
        queryFn: () => systemAPI.menu.list({}),
    });
    const rows = useMemo(() => flattenMenuTree(data?.data ?? []), [data?.data]);

    const refresh = () => {
        void refetch();
    };

    return (
        <PageCard
            title={t("菜单管理", "Menu management")}
            description={t(
                "管理路由菜单、权限编码和按钮操作。",
                "Manage route menus, permission codes, and button actions.",
            )}
            actions={
                <AuthWrap code="system:menu:create">
                    <MenuDialog mode="create" onSuccess={refresh}>
                        <Button>
                            <PlusIcon data-icon="inline-start" />
                            {t("新建菜单", "New menu")}
                        </Button>
                    </MenuDialog>
                </AuthWrap>
            }
        >
            <DataTableShell>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-64">{t("名称", "Name")}</TableHead>
                            <TableHead className="min-w-64">{t("编码", "Code")}</TableHead>
                            <TableHead className="min-w-32">{t("菜单类型", "Menu type")}</TableHead>
                            <TableHead className="min-w-28">{t("状态", "Status")}</TableHead>
                            <TableHead className="min-w-28">{t("排序", "Sort order")}</TableHead>
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
                                    <TableCell className="font-medium">
                                        <span
                                            className="inline-flex items-center"
                                            style={{ paddingLeft: `${record.depth * 24}px` }}
                                        >
                                            {record.depth > 0 ? (
                                                <span className="mr-2 text-muted-foreground">
                                                    └
                                                </span>
                                            ) : null}
                                            {localizeBuiltInMenuName(record)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{record.code}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <MenuTypeBadge menuType={record.menuType} />
                                    </TableCell>
                                    <TableCell>
                                        <MenuStatusBadge status={record.status} />
                                    </TableCell>
                                    <TableCell>{record.sortOrder}</TableCell>
                                    <TableCell>{formatDateTime(record.updatedAt)}</TableCell>
                                    <TableCell>
                                        <MenuActions record={record} onSuccess={refresh} />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : isPending ? (
                            <DataTableState
                                colSpan={7}
                                kind="loading"
                                title={t("正在加载菜单", "Loading menus")}
                            />
                        ) : error ? (
                            <DataTableState
                                colSpan={7}
                                kind="error"
                                title={t("菜单加载失败", "Failed to load menus")}
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
                                colSpan={7}
                                kind="empty"
                                title={t("暂无菜单", "No menus")}
                            />
                        )}
                    </TableBody>
                </Table>
            </DataTableShell>
        </PageCard>
    );
}

function MenuActions({ record, onSuccess }: { record: Menu.Item; onSuccess: () => void }) {
    const canEdit = !record.moduleId || Boolean(record.moduleMenuCode);

    return (
        <div className="flex justify-end gap-2">
            {canEdit ? (
                <AuthWrap code="system:menu:update">
                    <MenuDialog mode="edit" initialValues={record} onSuccess={onSuccess}>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("编辑菜单", "Edit menu")}
                        >
                            <EditIcon />
                        </Button>
                    </MenuDialog>
                </AuthWrap>
            ) : null}
            {!record.isSystem && !record.moduleId ? (
                <AuthWrap code="system:menu:delete">
                    <DisableMenuDialog record={record} onSuccess={onSuccess} />
                </AuthWrap>
            ) : null}
        </div>
    );
}

interface MenuDialogProps {
    initialValues?: Partial<Menu.Item>;
    mode?: "create" | "edit";
    children: ReactNode;
    onSuccess?: () => void;
}

const MenuDialog = ({ children, initialValues, mode = "create", onSuccess }: MenuDialogProps) => {
    const queryClient = useQueryClient();
    const isModuleOwned = Boolean(initialValues?.moduleId);
    const [open, setOpen] = useState(false);
    const [parentId, setParentId] = useState("0");
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [menuType, setMenuType] = useState("1");
    const [status, setStatus] = useState("1");
    const [sortOrder, setSortOrder] = useState("0");
    const [icon, setIcon] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const { data: menuOptions = [] } = useQuery({
        ...menuQueryOptions.options(),
        enabled: open && !isModuleOwned,
    });
    const selectableParents = useMemo(
        () => menuOptions.filter((option) => option.value !== initialValues?.id),
        [initialValues?.id, menuOptions],
    );

    useEffect(() => {
        if (open) {
            setParentId(String(initialValues?.parentId ?? 0));
            setName(initialValues?.name ?? "");
            setCode(initialValues?.code ?? "");
            setMenuType(String(initialValues?.menuType ?? 1));
            setStatus(String(initialValues?.status ?? 1));
            setSortOrder(String(initialValues?.sortOrder ?? 0));
            setIcon(initialValues?.icon ?? "");
        }
    }, [initialValues, open]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = name.trim();
        const trimmedCode = code.trim();
        const parsedSortOrder = Number(sortOrder);

        if (!trimmedName) {
            appMessage.error(t("请输入菜单名称", "Enter a menu name."));
            return;
        }
        if (!trimmedCode) {
            appMessage.error(t("请输入权限编码", "Enter a permission code."));
            return;
        }
        if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) {
            appMessage.error(
                t("排序必须是非负整数", "The sort order must be a non-negative integer."),
            );
            return;
        }

        const payload = {
            parentId: Number(parentId),
            name: trimmedName,
            code: trimmedCode,
            menuType: Number(menuType),
            sortOrder: parsedSortOrder,
            status: Number(status),
            icon: icon || null,
        };

        setSubmitting(true);
        try {
            if (mode === "create") {
                await systemAPI.menu.create(payload);
                appMessage.success(t("菜单已创建", "Menu created."));
            } else if (initialValues?.id) {
                await systemAPI.menu.update(initialValues.id, payload);
                appMessage.success(t("菜单已更新", "Menu updated."));
            }
            if (isModuleOwned) {
                await queryClient.invalidateQueries({
                    queryKey: ["system", "modules", "navigation"],
                });
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
                            ? t("创建菜单", "Create menu")
                            : t("编辑菜单", "Edit menu")}
                    </DialogTitle>
                    <DialogDescription>
                        {isModuleOwned
                            ? t(
                                  "覆盖标题、图标、排序和可见性。模块标识仍与清单保持同步。",
                                  "Override the title, icon, sort order, and visibility. The module identifier remains synchronized with the manifest.",
                              )
                            : t(
                                  "配置菜单层级、权限编码和显示顺序。",
                                  "Configure the menu hierarchy, permission code, and display order.",
                              )}
                    </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                    <div className="grid gap-2">
                        <Label htmlFor="menu-parent">{t("上级菜单", "Parent menu")}</Label>
                        <Select
                            value={parentId}
                            onValueChange={setParentId}
                            disabled={isModuleOwned}
                        >
                            <SelectTrigger id="menu-parent" className="w-full">
                                <SelectValue
                                    placeholder={t("请选择上级菜单", "Select a parent menu")}
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {selectableParents.map((item) => (
                                        <SelectItem key={item.value} value={String(item.value)}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                    <TextField
                        id="menu-name"
                        label={
                            isModuleOwned ? t("菜单标题", "Menu title") : t("菜单名称", "Menu name")
                        }
                        value={name}
                        placeholder={t("请输入菜单名称", "Enter a menu name")}
                        onChange={setName}
                    />
                    <TextField
                        id="menu-code"
                        label={t("权限编码", "Permission code")}
                        value={code}
                        placeholder={t(
                            "请输入权限编码（如 system:menu:list）",
                            "Enter a permission code (for example, system:menu:list)",
                        )}
                        onChange={setCode}
                        disabled={isModuleOwned}
                    />
                    {isModuleOwned && initialValues?.path ? (
                        <div className="grid gap-2">
                            <Label htmlFor="menu-path">{t("路由路径", "Route path")}</Label>
                            <Input id="menu-path" value={initialValues.path} disabled />
                        </div>
                    ) : null}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="menu-type">{t("类型", "Type")}</Label>
                            <Select
                                value={menuType}
                                onValueChange={setMenuType}
                                disabled={isModuleOwned}
                            >
                                <SelectTrigger id="menu-type" className="w-full">
                                    <SelectValue
                                        placeholder={t("请选择菜单类型", "Select a menu type")}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {getMenuTypeOptions().map((item) => (
                                            <SelectItem key={item.value} value={String(item.value)}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="menu-status">{t("状态", "Status")}</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger id="menu-status" className="w-full">
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
                    </div>
                    {isModuleOwned ? (
                        <div className="grid gap-2">
                            <Label htmlFor="menu-icon">{t("图标", "Icon")}</Label>
                            <Select value={icon || undefined} onValueChange={setIcon}>
                                <SelectTrigger id="menu-icon" className="w-full">
                                    <SelectValue placeholder={t("请选择图标", "Select an icon")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {getModuleIconOptions().map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}
                    <TextField
                        id="menu-sort-order"
                        label={t("排序", "Sort order")}
                        value={sortOrder}
                        type="number"
                        min={0}
                        step={1}
                        placeholder={t("请输入排序", "Enter a sort order")}
                        onChange={setSortOrder}
                    />
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

function DisableMenuDialog({ record, onSuccess }: { record: Menu.Item; onSuccess: () => void }) {
    const submit = async () => {
        await systemAPI.menu.delete(record.id);
        appMessage.success(t("菜单已禁用", "Menu disabled."));
        onSuccess();
    };

    return (
        <ConfirmDialog
            trigger={
                <Button
                    type="button"
                    variant="ghost-destructive"
                    size="icon-sm"
                    aria-label={t("禁用菜单", "Disable menu")}
                >
                    <StopCircleIcon />
                </Button>
            }
            title={t("禁用菜单", "Disable menu")}
            description={t(
                `菜单 ${record.name} 将被禁用，是否继续？`,
                `Menu ${record.name} will be disabled. Continue?`,
            )}
            confirmLabel={t("禁用", "Disable")}
            destructive
            onConfirm={submit}
        />
    );
}

function MenuTypeBadge({ menuType }: { menuType: number }) {
    const menuTypeMeta = {
        1: { label: t("目录", "Directory"), variant: "secondary" as const },
        2: { label: t("菜单", "Menu"), variant: "default" as const },
        3: { label: t("按钮", "Button"), variant: "outline" as const },
    };
    const meta = menuTypeMeta[menuType as keyof typeof menuTypeMeta] ?? {
        label: t("未知", "Unknown"),
        variant: "outline" as const,
    };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function MenuStatusBadge({ status }: { status: number }) {
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

function flattenMenuTree(items: Menu.Item[], depth = 0): FlatMenuItem[] {
    return items.flatMap((item) => [
        { ...item, depth },
        ...flattenMenuTree(item.children ?? [], depth + 1),
    ]);
}
