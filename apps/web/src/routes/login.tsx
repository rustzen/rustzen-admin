import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { LockIcon, UserIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { appMessage, authAPI } from "@/api";
import loginIllustrationUrl from "@/assets/login-illustration.png";
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
        <main className="relative min-h-svh overflow-hidden bg-muted/40 text-foreground">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_26%,var(--background)_0,transparent_44%)]" />
            <div className="pointer-events-none absolute right-0 top-0 h-[58vh] w-[42vw] bg-[radial-gradient(var(--border)_1.4px,transparent_1.4px)] opacity-70 [background-size:31px_31px]" />
            <div className="pointer-events-none absolute bottom-[-19vh] left-[-8vw] h-[46vh] w-[78vw] rounded-[50%] border border-border/70 before:absolute before:inset-8 before:rounded-[50%] before:border before:border-border/60 after:absolute after:inset-16 after:rounded-[50%] after:border after:border-border/50" />

            <div className="relative flex min-h-svh flex-col px-7 py-8 sm:px-12 lg:px-14 xl:px-20">
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

                <div className="grid flex-1 items-center gap-8 py-7 lg:grid-cols-[minmax(560px,1fr)_420px] lg:gap-14 xl:grid-cols-[minmax(680px,1fr)_532px] xl:gap-20">
                    <section className="hidden min-w-0 self-stretch lg:flex lg:flex-col lg:justify-center lg:gap-4 xl:gap-5">
                        <div className="h-125 xl:h-153">
                            <img
                                src={loginIllustrationUrl}
                                alt={t(
                                    `${APP_BRAND_NAME} 运维管理平台`,
                                    `${APP_BRAND_NAME} operations platform`,
                                )}
                                className="h-full w-full object-contain object-left drop-shadow-[0_34px_72px_rgba(38,103,255,0.12)]"
                            />
                        </div>
                        <div className="relative z-10 pl-3">
                            <div className="flex flex-nowrap items-center gap-5 whitespace-nowrap text-[34px] font-extrabold leading-none xl:text-[38px]">
                                <span>{t("高效", "Efficient")}</span>
                                <span className="text-[28px] text-primary">•</span>
                                <span>{t("可靠", "Reliable")}</span>
                                <span className="text-[28px] text-primary">•</span>
                                <span>{t("智能", "Intelligent")}</span>
                            </div>
                            <p className="mt-5 text-[22px] leading-none text-muted-foreground">
                                {t(
                                    "统一运维平台，让管理更简单、更高效。",
                                    "A unified operations platform for simpler, more efficient management.",
                                )}
                            </p>
                        </div>
                    </section>

                    <section
                        className="mx-auto w-full max-w-105 rounded-xl border bg-card px-7 py-10 text-card-foreground shadow-xl sm:px-12 sm:py-14 xl:max-w-133 xl:px-16 xl:py-22"
                        aria-label={t("登录", "Sign in")}
                    >
                        <div className="mb-10 grid gap-5 text-center xl:mb-12">
                            <h1 className="text-[36px] font-extrabold leading-none xl:text-[40px]">
                                Rustzen <span className="text-primary">Admin</span>
                            </h1>
                            <p className="text-base leading-none text-muted-foreground">
                                {t("欢迎使用", "Welcome to")} {APP_BRAND_NAME}
                            </p>
                        </div>

                        <form className="grid gap-7" autoComplete="off" onSubmit={onLogin}>
                            <div className="grid gap-3">
                                <Label className="text-base font-semibold" htmlFor="login_username">
                                    {t("用户名", "Username")}
                                </Label>
                                <div className="relative">
                                    <UserIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="login_username"
                                        value={username}
                                        placeholder={t("请输入用户名", "Enter your username")}
                                        autoComplete="username"
                                        className="h-15 rounded-lg px-12 text-base shadow-none hover:border-primary focus-visible:border-primary"
                                        onChange={(event) => setUsername(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3">
                                <div className="flex items-center justify-between text-base leading-none">
                                    <Label className="font-semibold" htmlFor="login_password">
                                        {t("密码", "Password")}
                                    </Label>
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
                                        className="h-15 rounded-lg px-12 text-base shadow-none hover:border-primary focus-visible:border-primary"
                                        onChange={(event) => setPassword(event.target.value)}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="h-15 w-full rounded-lg text-lg font-semibold shadow-lg"
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
