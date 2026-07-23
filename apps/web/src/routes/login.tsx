import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { LockIcon, UserIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { appMessage, authAPI } from "@/api";
import rustzenLogoUrl from "@/assets/rustzen-logo.png";
import { LanguageSwitch } from "@/components/language-switch";
import { ThemeSwitch } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_BRAND_NAME, RUSTZEN_BRAND_NAME } from "@/constant/brand";
import { t } from "@/lib/i18n";
import { useAuthStore } from "@/store/useAuthStore";

export const Route = createFileRoute("/login")({
    component: () => <LoginPage />,
});

function LoginPage() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const { handleLogin } = useAuthStore();
    const currentYear = new Date().getFullYear();

    const onLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 3) {
            appMessage.error(
                t("用户名至少需要 3 个字符", "Username must be at least 3 characters"),
            );
            return;
        }
        if (password.length < 6) {
            appMessage.error(t("密码至少需要 6 个字符", "Password must be at least 6 characters"));
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await authAPI.login({
                username: trimmedUsername,
                password,
            });
            handleLogin(res.token, res.userInfo);
            void navigate({ to: "/", replace: true });
        } catch (error) {
            console.error("Login failed", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-svh bg-background text-foreground">
            <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col px-5 py-5 sm:px-8">
                <header className="flex h-10 shrink-0 items-center gap-3">
                    <img
                        src={rustzenLogoUrl}
                        alt={RUSTZEN_BRAND_NAME}
                        className="size-10 object-contain"
                    />
                    <span className="text-[22px] font-bold leading-none">{APP_BRAND_NAME}</span>
                    <div className="ms-auto flex items-center gap-1">
                        <LanguageSwitch />
                        <ThemeSwitch />
                    </div>
                </header>

                <div className="flex flex-1 items-center justify-center py-10">
                    <section
                        className="w-full max-w-100 rounded-lg border bg-card p-6 text-card-foreground shadow-sm sm:p-8"
                        aria-label={t("登录", "Sign in")}
                    >
                        <div className="mb-7 grid gap-2">
                            <h1 className="text-xl font-semibold">{t("登录", "Sign in")}</h1>
                            <p className="text-sm text-muted-foreground">
                                {t(
                                    `使用你的 ${APP_BRAND_NAME} 账号继续。`,
                                    `Continue with your ${APP_BRAND_NAME} account.`,
                                )}
                            </p>
                        </div>

                        <form className="grid gap-5" autoComplete="off" onSubmit={onLogin}>
                            <div className="grid gap-2">
                                <Label htmlFor="login_username">{t("用户名", "Username")}</Label>
                                <div className="relative">
                                    <UserIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="login_username"
                                        value={username}
                                        placeholder={t("请输入用户名", "Enter your username")}
                                        autoComplete="username"
                                        className="h-10 ps-10 shadow-none"
                                        onChange={(event) => setUsername(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="login_password">{t("密码", "Password")}</Label>
                                    <span className="text-sm font-medium text-muted-foreground">
                                        {t("忘记密码？", "Forgot password?")}
                                    </span>
                                </div>
                                <div className="relative">
                                    <LockIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="login_password"
                                        type="password"
                                        value={password}
                                        placeholder={t("请输入密码", "Enter your password")}
                                        autoComplete="current-password"
                                        className="h-10 ps-10 shadow-none"
                                        onChange={(event) => setPassword(event.target.value)}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="h-10 w-full shadow-none"
                            >
                                {isSubmitting
                                    ? t("正在登录...", "Signing in...")
                                    : t("登录", "Sign in")}
                            </Button>
                        </form>
                    </section>
                </div>

                <footer className="shrink-0 pb-3 text-sm text-muted-foreground">
                    © {currentYear} {RUSTZEN_BRAND_NAME}.{" "}
                    {t("保留所有权利。", "All rights reserved.")}
                </footer>
            </div>
        </main>
    );
}
