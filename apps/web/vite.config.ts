import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

// Vite+ and Vite 8 expose compatible plugins through distinct type identities.
type VitePlusPluginList = NonNullable<ReturnType<typeof lazyPlugins>>;

const WEB_DEV_PORT = 9800;
const BACKEND_PORT = 9801;

// https://vite.dev/config/
export default defineConfig({
    lint: { options: { typeAware: true, typeCheck: true } },
    fmt: { sortImports: {} },
    staged: {
        "*": "vp check --fix",
    },
    plugins: lazyPlugins(
        () =>
            [
                tanstackRouter({ autoCodeSplitting: true }),
                viteReact(),
                tailwindcss(),
            ] as unknown as VitePlusPluginList,
    ),
    resolve: {
        tsconfigPaths: true,
    },
    server: {
        host: "0.0.0.0",
        port: WEB_DEV_PORT,
        open: false,
        allowedHosts: ["host.docker.internal", "terminal.local"],
        proxy: {
            "/api": {
                target: `http://127.0.0.1:${BACKEND_PORT}`,
                changeOrigin: true,
            },
            "/resources": {
                target: `http://127.0.0.1:${BACKEND_PORT}`,
                changeOrigin: true,
            },
        },
    },
});
