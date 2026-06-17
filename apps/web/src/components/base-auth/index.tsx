import { Popconfirm } from "antd";
import type { MouseEvent, ReactNode } from "react";

import { appModal } from "@/api";
import { useAuthStore } from "@/store/useAuthStore";

interface AuthWrapProps {
    code: string;
    children: ReactNode;
    hidden?: boolean;
    fallback?: ReactNode;
}

export const AuthWrap = ({ code, children, hidden = false, fallback = null }: AuthWrapProps) => {
    const isPermission = useAuthStore((state) => state.checkPermissions(code));
    if (isPermission && !hidden) {
        return children;
    }
    return fallback;
};

interface AuthPopconfirmProps extends AuthWrapProps {
    title: ReactNode;
    description?: ReactNode;
    onConfirm: () => Promise<void>;
    onCancel?: () => Promise<void>;
}

export const AuthPopconfirm = ({
    code,
    children,
    hidden = false,
    title,
    description,
    onConfirm,
    onCancel,
}: AuthPopconfirmProps) => {
    return (
        <AuthWrap code={code} hidden={hidden}>
            <Popconfirm
                placement="leftBottom"
                title={title}
                description={description}
                onConfirm={onConfirm}
                onCancel={onCancel}
            >
                {children}
            </Popconfirm>
        </AuthWrap>
    );
};

interface AuthConfirmProps extends AuthPopconfirmProps {
    className?: string;
}

export const AuthConfirm = ({
    code,
    children,
    hidden,
    title,
    description,
    onConfirm,
    onCancel,
    className = "",
}: AuthConfirmProps) => {
    const handleConfirm = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        appModal.confirm({
            title,
            content: description,
            onOk: onConfirm,
            onCancel,
        });
    };

    return (
        <AuthWrap code={code} hidden={hidden}>
            <button
                type="button"
                onClick={handleConfirm}
                className={`rounded border-0 bg-transparent p-0 text-left ${className}`}
            >
                {children}
            </button>
        </AuthWrap>
    );
};
