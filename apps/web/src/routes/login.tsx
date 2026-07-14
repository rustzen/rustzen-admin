import { LockIcon, UserIcon } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { appMessage, authAPI } from "@/api";
import loginIllustrationUrl from "@/assets/login-illustration.png";
import rustzenLogoUrl from "@/assets/rustzen-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_BRAND_NAME, RUSTZEN_BRAND_NAME } from "@/constant/brand";
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
            appMessage.error("Username must be at least 3 characters");
            return;
        }
        if (password.length < 6) {
            appMessage.error("Password must be at least 6 characters");
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
        <main className="relative min-h-screen overflow-hidden bg-[#f3f7ff] text-[#061634]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_26%,rgba(255,255,255,0.92)_0,rgba(255,255,255,0.28)_24%,transparent_44%),linear-gradient(120deg,#f5f8ff_0%,#eef4ff_45%,#f8fbff_100%)]" />
            <div className="pointer-events-none absolute right-0 top-0 h-[58vh] w-[42vw] bg-[radial-gradient(#d9e6ff_1.4px,transparent_1.4px)] opacity-70 [background-size:31px_31px]" />
            <div className="pointer-events-none absolute bottom-[-16vh] left-[-8vw] h-[46vh] w-[78vw] rounded-[50%] border border-[#d9e6fb]/70" />
            <div className="pointer-events-none absolute bottom-[-19vh] left-[-5vw] h-[42vh] w-[72vw] rounded-[50%] border border-[#d9e6fb]/55" />
            <div className="pointer-events-none absolute bottom-[-23vh] left-[1vw] h-[38vh] w-[64vw] rounded-[50%] border border-[#d9e6fb]/40" />

            <div className="relative flex min-h-screen flex-col px-7 py-8 sm:px-12 lg:px-14 xl:px-20">
                <header className="flex h-10 shrink-0 items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center">
                        <img
                            src={rustzenLogoUrl}
                            alt={RUSTZEN_BRAND_NAME}
                            className="h-10 w-10 object-contain"
                        />
                    </span>
                    <span className="text-[22px] font-bold leading-none text-[#071836]">
                        {APP_BRAND_NAME}
                    </span>
                </header>

                <div className="grid flex-1 items-center gap-8 py-7 lg:grid-cols-[minmax(560px,1fr)_420px] lg:gap-14 xl:grid-cols-[minmax(680px,1fr)_532px] xl:gap-20">
                    <section className="hidden min-w-0 self-stretch lg:flex lg:flex-col lg:justify-center">
                        <div className="h-125 xl:h-153">
                            <img
                                src={loginIllustrationUrl}
                                alt={`${APP_BRAND_NAME} Operations Management Platform`}
                                className="h-full w-full object-contain object-left drop-shadow-[0_34px_72px_rgba(38,103,255,0.12)]"
                            />
                        </div>
                        <div className="-mt-9 pl-3 xl:-mt-14">
                            <div className="flex items-center gap-5 text-[34px] font-extrabold leading-none text-[#061634] xl:text-[38px]">
                                <span>Efficient</span>
                                <span className="text-[28px] text-[#1677ff]">•</span>
                                <span>Reliable</span>
                                <span className="text-[28px] text-[#1677ff]">•</span>
                                <span>Smart</span>
                            </div>
                            <p className="mt-5 text-[22px] leading-none text-[#7484a0]">
                                A unified operations platform for simpler and more efficient
                                management.
                            </p>
                        </div>
                    </section>

                    <section
                        className="mx-auto w-full max-w-105 rounded-[18px] bg-white px-7 py-10 shadow-[0_28px_76px_rgba(45,88,150,0.09)] sm:px-12 sm:py-14 xl:max-w-133 xl:px-16 xl:py-22"
                        aria-label="Login"
                    >
                        <div className="mb-10 text-center xl:mb-12">
                            <h1 className="m-0 text-[36px] font-extrabold leading-none text-[#061634] xl:text-[40px]">
                                RustZen <span className="text-[#1677ff]">Admin</span>
                            </h1>
                            <p className="mt-6 text-base leading-none text-[#8b98ae]">
                                Welcome to {APP_BRAND_NAME}
                            </p>
                        </div>

                        <form autoComplete="off" onSubmit={onLogin}>
                            <div className="mb-8 grid gap-3">
                                <Label className="text-base font-semibold text-[#10213d]" htmlFor="login_username">
                                    Username
                                </Label>
                                <div className="relative">
                                    <UserIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#8a9ab5]" />
                                    <Input
                                        id="login_username"
                                        value={username}
                                        placeholder="Enter username"
                                        autoComplete="username"
                                        className="h-15 rounded-[10px] border-[#dce4f1] px-12 text-base shadow-none hover:border-[#1677ff] focus-visible:border-[#1677ff]"
                                        onChange={(event) => setUsername(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="mb-3 flex items-center justify-between text-base leading-none">
                                <label
                                    htmlFor="login_password"
                                    className="font-semibold text-[#10213d]"
                                >
                                    Password
                                </label>
                                <span className="text-sm font-medium text-[#8b98ae]">
                                    Forgot password?
                                </span>
                            </div>

                            <div className="mb-7">
                                <div className="relative">
                                    <LockIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#8a9ab5]" />
                                    <Input
                                        id="login_password"
                                        type="password"
                                        value={password}
                                        placeholder="Enter password"
                                        autoComplete="current-password"
                                        className="h-15 rounded-[10px] border-[#dce4f1] px-12 text-base shadow-none hover:border-[#1677ff] focus-visible:border-[#1677ff]"
                                        onChange={(event) => setPassword(event.target.value)}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="h-15 w-full rounded-[10px] bg-[#1677ff] text-lg font-semibold shadow-[0_12px_22px_rgba(22,119,255,0.24)] hover:bg-[#1677ff]/90"
                            >
                                {isSubmitting ? "Logging in..." : "Login"}
                            </Button>
                        </form>
                    </section>
                </div>

                <footer className="shrink-0 pb-3 text-sm text-[#7f8da7]">
                    © {currentYear} {RUSTZEN_BRAND_NAME}. All rights reserved.
                </footer>
            </div>
        </main>
    );
}
