import type { ReactNode } from "react";

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
