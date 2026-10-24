# 依存バージョン一覧（2026-10-24）

npm registryの公開日時でプレリリースを除外して照合。lockfileに含むプラットフォーム別optional依存も対象。最新と異なる推移依存は、親の要求範囲/固定指定を併記する。要求範囲を超えるメジャーを機械的にoverrideしない。Node型は実行環境の24系を維持する。

| パッケージ | lockfile解決版 | 最新安定版 | 最新と異なる版の親要求（最大3件） |
|---|---|---|---|
| `@adobe/react-spectrum` | 3.47.7 | 3.47.7 |  |
| `@adobe/react-spectrum-ui` | 1.2.1 | 1.2.1 |  |
| `@adobe/react-spectrum-workflow` | 2.3.5 | 3.0.1 | @spectrum-icons/workflow@4.3.2: 2.3.5 |
| `@babel/runtime` | 7.29.10 | 8.0.8 | @spectrum-icons/ui@3.7.2: ^7.24.4; dom-helpers@5.2.1: ^7.8.7; react-transition-group@4.4.5: ^7.5.5 |
| `@cloudflare/kv-asset-handler` | 0.5.0 | 0.5.0 |  |
| `@cloudflare/unenv-preset` | 2.16.2 | 2.16.2 |  |
| `@cloudflare/workerd-darwin-64` | 1.20261019.1 | 1.20261024.1 |  |
| `@cloudflare/workerd-darwin-arm64` | 1.20261019.1 | 1.20261024.1 |  |
| `@cloudflare/workerd-linux-64` | 1.20261019.1 | 1.20261024.1 |  |
| `@cloudflare/workerd-linux-arm64` | 1.20261019.1 | 1.20261024.1 |  |
| `@cloudflare/workerd-windows-64` | 1.20261019.1 | 1.20261024.1 |  |
| `@cspotcode/source-map-support` | 0.8.1 | 0.8.1 |  |
| `@discordjs/builders` | 1.14.1 | 1.14.1 |  |
| `@discordjs/collection` | 1.5.3, 2.1.1 | 2.1.1 | @discordjs/rest@2.6.3: ^2.1.1; @discordjs/ws@1.2.3: ^2.1.0; discord.js@14.27.0: 1.5.3 |
| `@discordjs/formatters` | 0.6.2 | 0.6.2 |  |
| `@discordjs/node-pre-gyp` | 0.4.5 | 0.4.5 |  |
| `@discordjs/opus` | 0.10.0 | 0.10.0 |  |
| `@discordjs/rest` | 2.6.3 | 2.6.3 |  |
| `@discordjs/util` | 1.2.0 | 1.2.0 |  |
| `@discordjs/voice` | 0.19.2 | 0.19.2 |  |
| `@discordjs/ws` | 1.2.3 | 2.0.4 | discord.js@14.27.0: ^1.2.3 |
| `@electric-sql/pglite` | 0.4.3 | 0.5.11 | @prisma/dev@0.24.17: 0.4.3 |
| `@electric-sql/pglite-socket` | 0.1.3 | 0.2.14 | @prisma/dev@0.24.17: 0.1.3 |
| `@electric-sql/pglite-tools` | 0.3.3 | 0.4.11 | @prisma/dev@0.24.17: 0.3.3 |
| `@emnapi/core` | 1.9.1 | 1.11.3 | @tailwindcss/oxide-wasm32-wasi@4.3.3: ^1.11.1 |
| `@emnapi/runtime` | 1.11.3 | 1.11.3 |  |
| `@emnapi/wasi-threads` | 1.2.0 | 2.2.0 | @emnapi/core@1.9.1: 1.2.0; @tailwindcss/oxide-wasm32-wasi@4.3.3: ^1.2.2 |
| `@epic-web/invariant` | 1.0.0 | 1.0.0 |  |
| `@esbuild/aix-ppc64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/android-arm` | 0.28.2 | 0.28.2 |  |
| `@esbuild/android-arm64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/android-x64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/darwin-arm64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/darwin-x64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/freebsd-arm64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/freebsd-x64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/linux-arm` | 0.28.2 | 0.28.2 |  |
| `@esbuild/linux-arm64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/linux-ia32` | 0.28.2 | 0.28.2 |  |
| `@esbuild/linux-loong64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/linux-mips64el` | 0.28.2 | 0.28.2 |  |
| `@esbuild/linux-ppc64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/linux-riscv64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/linux-s390x` | 0.28.2 | 0.28.2 |  |
| `@esbuild/linux-x64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/netbsd-arm64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/netbsd-x64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/openbsd-arm64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/openbsd-x64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/openharmony-arm64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/sunos-x64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/win32-arm64` | 0.28.2 | 0.28.2 |  |
| `@esbuild/win32-ia32` | 0.28.2 | 0.28.2 |  |
| `@esbuild/win32-x64` | 0.28.2 | 0.28.2 |  |
| `@heroui/react` | 3.2.6 | 3.2.6 |  |
| `@heroui/styles` | 3.2.6 | 3.2.6 |  |
| `@hono/node-server` | 2.1.5 | 2.1.5 |  |
| `@img/colour` | 1.1.0 | 1.1.0 |  |
| `@img/sharp-darwin-arm64` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-darwin-x64` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-freebsd-wasm32` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-libvips-darwin-arm64` | 1.3.4 | 1.3.4 |  |
| `@img/sharp-libvips-darwin-x64` | 1.3.4 | 1.3.4 |  |
| `@img/sharp-libvips-linux-arm` | 1.3.4 | 1.3.4 |  |
| `@img/sharp-libvips-linux-arm64` | 1.3.4 | 1.3.4 |  |
| `@img/sharp-libvips-linux-ppc64` | 1.3.4 | 1.3.4 |  |
| `@img/sharp-libvips-linux-riscv64` | 1.3.4 | 1.3.4 |  |
| `@img/sharp-libvips-linux-s390x` | 1.3.4 | 1.3.4 |  |
| `@img/sharp-libvips-linux-x64` | 1.3.4 | 1.3.4 |  |
| `@img/sharp-libvips-linuxmusl-arm64` | 1.3.4 | 1.3.4 |  |
| `@img/sharp-libvips-linuxmusl-x64` | 1.3.4 | 1.3.4 |  |
| `@img/sharp-linux-arm` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-linux-arm64` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-linux-ppc64` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-linux-riscv64` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-linux-s390x` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-linux-x64` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-linuxmusl-arm64` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-linuxmusl-x64` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-wasm32` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-webcontainers-wasm32` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-win32-arm64` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-win32-ia32` | 0.35.5 | 0.35.5 |  |
| `@img/sharp-win32-x64` | 0.35.5 | 0.35.5 |  |
| `@internationalized/date` | 3.12.4 | 3.12.4 |  |
| `@internationalized/number` | 3.6.9 | 3.6.9 |  |
| `@internationalized/string` | 3.2.10 | 3.2.10 |  |
| `@ioredis/commands` | 2.0.0 | 2.1.1 | ioredis@6.0.0: 2.0.0 |
| `@isaacs/fs-minipass` | 4.0.1 | 4.0.1 |  |
| `@jridgewell/gen-mapping` | 0.3.13 | 0.3.13 |  |
| `@jridgewell/remapping` | 2.3.5 | 2.3.5 |  |
| `@jridgewell/resolve-uri` | 3.1.2 | 3.1.2 |  |
| `@jridgewell/sourcemap-codec` | 1.6.0 | 1.6.0 |  |
| `@jridgewell/trace-mapping` | 0.3.31, 0.3.9 | 0.3.31 | @cspotcode/source-map-support@0.8.1: 0.3.9; @jridgewell/gen-mapping@0.3.13: ^0.3.24; @jridgewell/remapping@2.3.5: ^0.3.24 |
| `@napi-rs/wasm-runtime` | 1.2.5 | 1.2.5 |  |
| `@oxc-project/types` | 0.155.0 | 0.155.0 |  |
| `@pinojs/redact` | 0.4.0 | 0.4.0 |  |
| `@poppinss/colors` | 4.1.6 | 4.1.6 |  |
| `@poppinss/dumper` | 0.7.0 | 0.7.0 |  |
| `@poppinss/exception` | 1.2.3 | 1.2.3 |  |
| `@prisma/adapter-pg` | 7.10.1 | 7.10.1 |  |
| `@prisma/client` | 7.10.1 | 7.10.1 |  |
| `@prisma/client-runtime-utils` | 7.10.1 | 7.10.1 |  |
| `@prisma/config` | 7.10.1 | 7.10.1 |  |
| `@prisma/debug` | 7.10.1, 7.2.0 | 7.10.1 | @prisma/driver-adapter-utils@7.10.1: 7.10.1; @prisma/engines@7.10.1: 7.10.1; @prisma/fetch-engine@7.10.1: 7.10.1 |
| `@prisma/dev` | 0.24.17 | 0.25.2 | prisma@7.10.1: 0.24.17 |
| `@prisma/driver-adapter-utils` | 7.10.1 | 7.10.1 |  |
| `@prisma/engines` | 7.10.1 | 7.10.1 |  |
| `@prisma/engines-version` | 8.1.0-1.d1b3f377ca835d73fd50954a5e22128b9ebdd6b8 | 0.0.1 | @prisma/engines@7.10.1: 8.1.0-1.d1b3f377ca835d73fd50954a5e22128b9ebdd6b8; @prisma/fetch-engine@7.10.1: 8.1.0-1.d1b3f377ca835d73fd50954a5e22128b9ebdd6b8 |
| `@prisma/fetch-engine` | 7.10.1 | 7.10.1 |  |
| `@prisma/get-platform` | 7.10.1, 7.2.0 | 7.10.1 | @prisma/dev@0.24.17: 7.2.0; @prisma/engines@7.10.1: 7.10.1; @prisma/fetch-engine@7.10.1: 7.10.1 |
| `@prisma/query-plan-executor` | 7.2.0 | 7.10.1 | @prisma/dev@0.24.17: 7.2.0 |
| `@prisma/streams-local` | 0.1.11 | 0.1.11 |  |
| `@prisma/studio-core` | 0.33.0 | 0.34.1 | prisma@7.10.1: 0.33.0 |
| `@radix-ui/primitive` | 1.1.3, 1.1.7 | 1.2.0 | @radix-ui/react-avatar@1.2.6: 1.1.7; @radix-ui/react-toggle@1.1.10: 1.1.3 |
| `@radix-ui/react-avatar` | 1.2.6 | 1.3.1 | @heroui/react@3.2.6: 1.2.6 |
| `@radix-ui/react-compose-refs` | 1.1.2, 1.1.5 | 1.1.5 | @radix-ui/react-slot@1.2.3: 1.1.2; @radix-ui/react-slot@1.3.3: 1.1.5 |
| `@radix-ui/react-context` | 1.2.2 | 1.3.0 | @radix-ui/react-avatar@1.2.6: 1.2.2 |
| `@radix-ui/react-primitive` | 2.1.10, 2.1.3 | 2.2.0 | @radix-ui/react-avatar@1.2.6: 2.1.10; @radix-ui/react-toggle@1.1.10: 2.1.3 |
| `@radix-ui/react-slot` | 1.2.3, 1.3.3 | 1.5.0 | @radix-ui/react-primitive@2.1.10: 1.3.3; @radix-ui/react-primitive@2.1.3: 1.2.3 |
| `@radix-ui/react-toggle` | 1.1.10 | 1.2.1 | @prisma/studio-core@0.33.0: 1.1.10 |
| `@radix-ui/react-use-callback-ref` | 1.1.4 | 1.1.5 | @radix-ui/react-avatar@1.2.6: 1.1.4 |
| `@radix-ui/react-use-controllable-state` | 1.2.2 | 1.3.0 | @radix-ui/react-toggle@1.1.10: 1.2.2 |
| `@radix-ui/react-use-effect-event` | 0.0.2 | 0.0.5 | @radix-ui/react-use-controllable-state@1.2.2: 0.0.2 |
| `@radix-ui/react-use-is-hydrated` | 0.1.3 | 0.1.3 |  |
| `@radix-ui/react-use-layout-effect` | 1.1.1, 1.1.4 | 1.1.4 | @radix-ui/react-avatar@1.2.6: 1.1.4; @radix-ui/react-use-controllable-state@1.2.2: 1.1.1; @radix-ui/react-use-effect-event@0.0.2: 1.1.1 |
| `@react-aria/color` | 3.2.1 | 3.2.1 |  |
| `@react-aria/ssr` | 3.10.1 | 3.10.1 |  |
| `@react-aria/utils` | 3.34.1 | 3.34.1 |  |
| `@react-spectrum/color` | 3.2.1 | 3.2.1 |  |
| `@react-spectrum/provider` | 3.11.1 | 3.11.1 |  |
| `@react-stately/color` | 3.10.1 | 3.10.1 |  |
| `@react-stately/utils` | 3.12.1 | 3.12.1 |  |
| `@react-types/color` | 3.2.0 | 3.2.0 |  |
| `@react-types/shared` | 3.36.1, 3.37.0 | 3.37.0 | @adobe/react-spectrum@3.47.7: ^3.37.0; @heroui/react@3.2.6: 3.36.1; react-aria-components@1.22.1: ^3.37.0 |
| `@remix-run/route-pattern` | 0.22.1 | 1.0.0 | react-router@8.5.0: ^0.22.1 |
| `@rolldown/binding-android-arm-eabi` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-android-arm64` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-darwin-arm64` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-darwin-x64` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-freebsd-x64` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-linux-arm-gnueabihf` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-linux-arm64-gnu` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-linux-arm64-musl` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-linux-ppc64-gnu` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-linux-s390x-gnu` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-linux-x64-gnu` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-linux-x64-musl` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-openharmony-arm64` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-win32-arm64-msvc` | 1.2.15 | 1.2.15 |  |
| `@rolldown/binding-win32-x64-msvc` | 1.2.15 | 1.2.15 |  |
| `@rolldown/pluginutils` | 1.0.1 | 1.0.1 |  |
| `@sapphire/async-queue` | 1.5.5 | 1.5.5 |  |
| `@sapphire/shapeshift` | 4.0.0 | 5.0.0 | @discordjs/builders@1.14.1: ^4.0.0 |
| `@sapphire/snowflake` | 3.5.5 | 3.5.5 |  |
| `@sindresorhus/is` | 7.2.0 | 8.1.0 | @poppinss/dumper@0.7.0: ^7.0.2 |
| `@snazzah/davey` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-android-arm-eabi` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-android-arm64` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-darwin-arm64` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-darwin-x64` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-freebsd-x64` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-linux-arm-gnueabihf` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-linux-arm64-gnu` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-linux-arm64-musl` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-linux-x64-gnu` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-linux-x64-musl` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-wasm32-wasi` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-win32-arm64-msvc` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-win32-ia32-msvc` | 0.1.12 | 0.1.12 |  |
| `@snazzah/davey-win32-x64-msvc` | 0.1.12 | 0.1.12 |  |
| `@spectrum-icons/ui` | 3.7.2 | 3.7.2 |  |
| `@spectrum-icons/workflow` | 4.3.2 | 4.3.2 |  |
| `@speed-highlight/core` | 1.2.24 | 2.1.0 | youch@4.1.1: ^1.2.14 |
| `@standard-schema/spec` | 1.1.0 | 1.1.0 |  |
| `@swc/helpers` | 0.5.23 | 0.5.23 |  |
| `@tailwindcss/node` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-android-arm64` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-darwin-arm64` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-darwin-x64` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-freebsd-x64` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-linux-arm-gnueabihf` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-linux-arm64-gnu` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-linux-arm64-musl` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-linux-x64-gnu` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-linux-x64-musl` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-wasm32-wasi` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-win32-arm64-msvc` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/oxide-win32-x64-msvc` | 4.3.3 | 4.3.3 |  |
| `@tailwindcss/vite` | 4.3.3 | 4.3.3 |  |
| `@tybys/wasm-util` | 0.10.4 | 0.10.4 |  |
| `@types/chai` | 5.2.3 | 5.2.3 |  |
| `@types/d3-array` | 3.0.3 | 3.2.2 | @visx/vendor@4.0.0: 3.0.3 |
| `@types/d3-color` | 3.1.0 | 3.1.3 | @types/d3-interpolate@3.0.1: *; @visx/vendor@4.0.0: 3.1.0 |
| `@types/d3-delaunay` | 6.0.1 | 6.0.4 | @visx/vendor@4.0.0: 6.0.1 |
| `@types/d3-format` | 3.0.1 | 3.0.4 | @visx/vendor@4.0.0: 3.0.1 |
| `@types/d3-geo` | 3.1.0 | 3.1.1 | @visx/vendor@4.0.0: 3.1.0 |
| `@types/d3-interpolate` | 3.0.1 | 3.0.4 | @visx/vendor@4.0.0: 3.0.1 |
| `@types/d3-path` | 3.1.1 | 3.1.1 |  |
| `@types/d3-scale` | 4.0.2 | 4.0.9 | @visx/vendor@4.0.0: 4.0.2 |
| `@types/d3-shape` | 3.1.7 | 3.2.0 | @visx/vendor@4.0.0: 3.1.7 |
| `@types/d3-time` | 3.0.0 | 3.0.4 | @types/d3-scale@4.0.2: *; @visx/vendor@4.0.0: 3.0.0 |
| `@types/d3-time-format` | 2.1.0 | 4.0.3 | @visx/vendor@4.0.0: 2.1.0 |
| `@types/debug` | 4.1.13 | 4.1.13 |  |
| `@types/deep-eql` | 4.0.2 | 4.0.2 |  |
| `@types/estree` | 1.0.9 | 1.0.9 |  |
| `@types/estree-jsx` | 1.0.5 | 1.0.5 |  |
| `@types/geojson` | 7946.0.16 | 7946.0.16 |  |
| `@types/hast` | 3.0.5 | 3.0.5 |  |
| `@types/mdast` | 4.0.4 | 4.0.4 |  |
| `@types/ms` | 2.1.0 | 2.1.0 |  |
| `@types/node` | 24.19.2 | 26.6.5 | @types/pg@8.23.1: *; @types/ws@8.18.2: * |
| `@types/pg` | 8.23.1 | 8.23.1 |  |
| `@types/react` | 19.3.0 | 19.3.0 |  |
| `@types/react-dom` | 19.3.0 | 19.3.0 |  |
| `@types/unist` | 2.0.11, 3.0.3 | 3.0.3 | @types/hast@3.0.5: *; @types/mdast@4.0.4: *; hast-util-to-jsx-runtime@2.3.6: ^3.0.0 |
| `@types/ws` | 8.18.2 | 8.18.2 |  |
| `@typescript/typescript-aix-ppc64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-darwin-arm64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-darwin-x64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-freebsd-arm64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-freebsd-x64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-linux-arm` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-linux-arm64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-linux-loong64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-linux-mips64el` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-linux-ppc64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-linux-riscv64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-linux-s390x` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-linux-x64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-netbsd-arm64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-netbsd-x64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-openbsd-arm64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-openbsd-x64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-sunos-x64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-win32-arm64` | 7.0.2 | 7.0.2 |  |
| `@typescript/typescript-win32-x64` | 7.0.2 | 7.0.2 |  |
| `@ungap/structured-clone` | 1.4.0 | 1.4.0 |  |
| `@visx/curve` | 4.0.0 | 4.0.0 |  |
| `@visx/event` | 4.0.0 | 4.0.0 |  |
| `@visx/grid` | 4.0.0 | 4.0.0 |  |
| `@visx/group` | 4.0.0 | 4.0.0 |  |
| `@visx/point` | 4.0.0 | 4.0.0 |  |
| `@visx/responsive` | 4.0.0 | 4.0.0 |  |
| `@visx/scale` | 4.0.0 | 4.0.0 |  |
| `@visx/shape` | 4.0.0 | 4.0.0 |  |
| `@visx/vendor` | 4.0.0 | 4.0.0 |  |
| `@vitejs/plugin-react` | 6.1.2 | 6.1.2 |  |
| `@vitest/mocker` | 5.0.5 | 5.0.5 |  |
| `@vitest/spy` | 5.0.5 | 5.0.5 |  |
| `@vladfrangu/async_event_emitter` | 2.4.7 | 2.4.7 |  |
| `abbrev` | 1.1.1 | 5.0.0 | nopt@5.0.0: 1 |
| `agent-base` | 6.0.2 | 9.0.0 | https-proxy-agent@5.0.1: 6 |
| `ajv` | 8.20.0 | 8.20.0 |  |
| `ansi-regex` | 5.0.1 | 6.4.0 | strip-ansi@6.0.1: ^5.0.1 |
| `aproba` | 2.1.0 | 2.1.0 |  |
| `are-we-there-yet` | 2.0.0 | 4.0.2 | npmlog@5.0.1: ^2.0.0 |
| `aria-hidden` | 1.2.6 | 1.2.6 |  |
| `assertion-error` | 2.0.1 | 2.0.1 |  |
| `atomic-sleep` | 1.0.0 | 1.0.0 |  |
| `aws-ssl-profiles` | 1.1.2 | 1.1.2 |  |
| `b4a` | 1.9.0 | 1.9.0 |  |
| `bail` | 2.0.2 | 2.0.2 |  |
| `balanced-match` | 1.0.2 | 5.0.0 | brace-expansion@1.1.21: ^1.0.0 |
| `bare-addon-resolve` | 1.11.0 | 1.11.0 |  |
| `bare-ansi-escapes` | 2.2.3 | 2.2.3 |  |
| `bare-assert` | 1.3.0 | 1.3.0 |  |
| `bare-events` | 2.9.2 | 2.9.2 |  |
| `bare-inspect` | 3.1.10 | 3.1.10 |  |
| `bare-module-resolve` | 1.12.6 | 1.12.6 |  |
| `bare-semver` | 1.1.0 | 1.1.0 |  |
| `bare-stream` | 2.13.4 | 2.13.4 |  |
| `bare-type` | 1.4.0 | 1.4.0 |  |
| `better-result` | 2.10.0 | 3.0.1 | @prisma/streams-local@0.1.11: ^2.7.0 |
| `blake3-wasm` | 2.1.5 | 3.0.0 | wrangler@4.152.0: 2.1.5 |
| `brace-expansion` | 1.1.21 | 5.0.12 | minimatch@3.1.5: ^1.1.7 |
| `c12` | 3.3.4 | 3.3.4 |  |
| `ccount` | 2.0.1 | 2.0.1 |  |
| `chai` | 6.3.0 | 6.3.0 |  |
| `character-entities` | 2.0.2 | 2.0.2 |  |
| `character-entities-html4` | 2.1.0 | 2.1.0 |  |
| `character-entities-legacy` | 3.0.0 | 3.0.0 |  |
| `character-reference-invalid` | 2.0.1 | 2.0.1 |  |
| `chokidar` | 5.0.0 | 6.0.0 | c12@3.3.4: ^5.0.0 |
| `chownr` | 3.0.0 | 3.0.0 |  |
| `classnames` | 2.5.1 | 2.5.1 |  |
| `client-only` | 0.0.1 | 0.0.1 |  |
| `clsx` | 2.1.1 | 2.1.1 |  |
| `cluster-key-slot` | 1.1.1 | 1.1.2 | ioredis@6.0.0: 1.1.1 |
| `color-support` | 1.1.3 | 1.1.3 |  |
| `colorette` | 2.0.20 | 2.0.20 |  |
| `comma-separated-tokens` | 2.0.3 | 2.0.3 |  |
| `concat-map` | 0.0.1 | 0.0.2 | brace-expansion@1.1.21: 0.0.1 |
| `confbox` | 0.2.4, 0.3.1 | 0.3.1 | c12@3.3.4: ^0.2.4; pkg-types@2.4.0: ^0.3.1 |
| `console-control-strings` | 1.1.0 | 1.1.0 |  |
| `cookie-es` | 3.1.1 | 3.1.1 |  |
| `cross-env` | 10.1.0 | 10.1.0 |  |
| `cross-spawn` | 7.0.6 | 7.0.6 |  |
| `csstype` | 3.2.3 | 3.2.3 |  |
| `d3-array` | 3.2.1, 3.2.4 | 3.2.4 | @prisma/studio-core@0.33.0: 3.2.4; @visx/vendor@4.0.0: 3.2.1; d3-geo@3.1.0: 2.5.0 - 3 |
| `d3-color` | 3.1.0 | 3.1.0 |  |
| `d3-delaunay` | 6.0.2 | 6.0.4 | @visx/vendor@4.0.0: 6.0.2 |
| `d3-format` | 3.1.0 | 3.1.2 | @visx/vendor@4.0.0: 3.1.0; d3-scale@4.0.2: 1 - 3 |
| `d3-geo` | 3.1.0 | 3.1.1 | @visx/vendor@4.0.0: 3.1.0 |
| `d3-interpolate` | 3.0.1 | 3.0.1 |  |
| `d3-path` | 3.1.0 | 3.1.0 |  |
| `d3-scale` | 4.0.2 | 4.0.2 |  |
| `d3-shape` | 3.2.0 | 3.2.0 |  |
| `d3-time` | 3.1.0 | 3.1.0 |  |
| `d3-time-format` | 4.1.0 | 4.1.0 |  |
| `dateformat` | 4.6.3 | 5.0.4 | pino-pretty@13.2.0: ^4.6.3 |
| `debug` | 4.4.3 | 4.4.3 |  |
| `decode-named-character-reference` | 1.3.0 | 1.3.0 |  |
| `deepmerge-ts` | 8.0.2 | 8.0.2 |  |
| `defu` | 6.1.7 | 6.1.7 |  |
| `delaunator` | 5.1.0 | 5.1.0 |  |
| `delegates` | 1.0.0 | 1.0.0 |  |
| `denque` | 2.1.0 | 2.1.0 |  |
| `dequal` | 2.0.3 | 2.0.3 |  |
| `destr` | 2.0.5 | 2.0.5 |  |
| `detect-libc` | 2.1.2 | 2.1.2 |  |
| `devlop` | 1.1.0 | 1.1.0 |  |
| `discord-api-types` | 0.38.57 | 0.38.57 |  |
| `discord.js` | 14.27.0 | 14.27.0 |  |
| `dom-helpers` | 5.2.1 | 6.0.1 | react-transition-group@4.4.5: ^5.0.1 |
| `dotenv` | 16.6.1, 17.4.2, 18.0.9 | 18.0.9 | c12@3.3.4: ^17.3.1; dotenv-cli@11.0.0: ^17.1.0; dotenv-expand@12.0.3: ^16.4.5 |
| `dotenv-cli` | 11.0.0 | 11.0.0 |  |
| `dotenv-expand` | 12.0.3 | 1000.0.0 | dotenv-cli@11.0.0: ^12.0.0 |
| `effect` | 3.20.0 | 4.0.6 | @prisma/config@7.10.1: 3.20.0 |
| `elkjs` | 0.11.1 | 0.12.0 | @prisma/studio-core@0.33.0: 0.11.1 |
| `emoji-regex` | 8.0.0 | 11.0.0 | string-width@4.2.3: ^8.0.0 |
| `emojibase` | 17.0.0 | 18.0.0 |  |
| `emojibase-data` | 18.0.0 | 18.0.0 |  |
| `empathic` | 2.0.0 | 2.1.0 | @prisma/config@7.10.1: 2.0.0 |
| `end-of-stream` | 1.4.5 | 1.4.5 |  |
| `enhanced-resolve` | 5.26.0 | 5.26.0 |  |
| `env-paths` | 3.0.0 | 4.0.0 | @prisma/streams-local@0.1.11: ^3.0.0 |
| `error-stack-parser-es` | 1.0.5 | 2.0.1 | youch-core@0.3.3: ^1.0.5 |
| `es-module-lexer` | 2.3.2 | 3.0.4 | vitest@5.0.5: ^2.3.2 |
| `esbuild` | 0.28.2 | 0.28.2 |  |
| `escape-string-regexp` | 5.0.0 | 5.0.0 |  |
| `estree-util-is-identifier-name` | 3.0.0 | 3.0.0 |  |
| `estree-walker` | 3.0.3 | 3.0.3 |  |
| `events-universal` | 1.0.1 | 1.0.1 |  |
| `expect-type` | 1.4.0 | 1.4.0 |  |
| `exsolve` | 1.1.3 | 1.1.3 |  |
| `extend` | 3.0.2 | 3.0.2 |  |
| `fast-check` | 3.23.2 | 4.10.2 | effect@3.20.0: ^3.23.1 |
| `fast-copy` | 4.2.0 | 4.2.0 |  |
| `fast-decode-uri-component` | 1.0.1 | 1.0.1 |  |
| `fast-deep-equal` | 3.1.3 | 3.1.3 |  |
| `fast-fifo` | 1.3.2 | 1.3.2 |  |
| `fast-querystring` | 1.1.2 | 1.1.2 |  |
| `fast-safe-stringify` | 2.1.1 | 2.1.1 |  |
| `fast-uri` | 3.1.9 | 4.2.3 | ajv@8.20.0: ^3.0.1 |
| `fdir` | 6.5.0 | 6.5.0 |  |
| `find-my-way` | 9.7.0 | 9.10.0 | @prisma/dev@0.24.17: 9.7.0 |
| `foreground-child` | 3.3.1 | 4.0.3 | @prisma/dev@0.24.17: 3.3.1 |
| `framer-motion` | 14.6.0 | 14.6.0 |  |
| `fs.realpath` | 1.0.0 | 1.0.0 |  |
| `fsevents` | 2.3.3 | 2.3.3 |  |
| `gauge` | 3.0.2 | 5.0.2 | npmlog@5.0.1: ^3.0.0 |
| `generate-function` | 2.3.1 | 2.3.1 |  |
| `get-port-please` | 3.2.0 | 3.2.0 |  |
| `giget` | 3.3.1 | 3.3.1 |  |
| `glob` | 7.2.3 | 13.0.6 | rimraf@3.0.2: ^7.1.3 |
| `graceful-fs` | 4.2.11 | 4.2.11 |  |
| `grammex` | 3.1.13 | 3.1.13 |  |
| `graphmatch` | 1.1.1 | 1.1.1 |  |
| `has-unicode` | 2.0.1 | 2.0.1 |  |
| `hast-util-sanitize` | 5.0.2 | 5.0.2 |  |
| `hast-util-to-jsx-runtime` | 2.3.6 | 2.3.6 |  |
| `hast-util-whitespace` | 3.0.0 | 3.0.0 |  |
| `help-me` | 5.0.0 | 5.0.0 |  |
| `hono` | 4.13.13 | 4.13.13 |  |
| `html-url-attributes` | 3.0.1 | 3.0.1 |  |
| `https-proxy-agent` | 5.0.1 | 9.1.0 | @discordjs/node-pre-gyp@0.4.5: ^5.0.0 |
| `iconv-lite` | 0.7.3 | 0.7.3 |  |
| `inflight` | 1.0.6 | 1.0.6 |  |
| `inherits` | 2.0.4 | 2.0.4 |  |
| `inline-style-parser` | 0.2.7 | 0.2.9 | style-to-object@1.0.14: 0.2.7 |
| `input-otp` | 1.5.0 | 1.5.0 |  |
| `internmap` | 2.0.3 | 2.0.3 |  |
| `ioredis` | 6.0.0 | 6.0.0 |  |
| `is-alphabetical` | 2.0.1 | 2.0.1 |  |
| `is-alphanumerical` | 2.0.1 | 2.0.1 |  |
| `is-decimal` | 2.0.1 | 2.0.1 |  |
| `is-fullwidth-code-point` | 3.0.0 | 5.1.0 | string-width@4.2.3: ^3.0.0 |
| `is-hexadecimal` | 2.0.1 | 2.0.1 |  |
| `is-plain-obj` | 4.1.0 | 4.1.0 |  |
| `is-property` | 1.0.2 | 1.0.2 |  |
| `isexe` | 2.0.0 | 4.0.0 | which@2.0.2: ^2.0.0 |
| `jiti` | 2.7.0 | 2.7.0 |  |
| `joycon` | 3.1.1 | 3.1.1 |  |
| `js-tokens` | 4.0.0 | 10.0.0 | loose-envify@1.4.0: ^3.0.0 \|\| ^4.0.0 |
| `json-schema-traverse` | 1.0.0 | 1.0.0 |  |
| `kleur` | 4.1.5 | 4.1.5 |  |
| `lightningcss` | 1.32.0, 1.33.0 | 1.33.0 | @tailwindcss/node@4.3.3: 1.32.0; vite@8.3.5: ^1.33.0 |
| `lightningcss-android-arm64` | 1.32.0, 1.33.0 | 1.33.0 |  |
| `lightningcss-darwin-arm64` | 1.32.0, 1.33.0 | 1.33.0 |  |
| `lightningcss-darwin-x64` | 1.32.0, 1.33.0 | 1.33.0 |  |
| `lightningcss-freebsd-x64` | 1.32.0, 1.33.0 | 1.33.0 |  |
| `lightningcss-linux-arm-gnueabihf` | 1.32.0, 1.33.0 | 1.33.0 |  |
| `lightningcss-linux-arm64-gnu` | 1.32.0, 1.33.0 | 1.33.0 |  |
| `lightningcss-linux-arm64-musl` | 1.32.0, 1.33.0 | 1.33.0 |  |
| `lightningcss-linux-x64-gnu` | 1.32.0, 1.33.0 | 1.33.0 |  |
| `lightningcss-linux-x64-musl` | 1.32.0, 1.33.0 | 1.33.0 |  |
| `lightningcss-win32-arm64-msvc` | 1.32.0, 1.33.0 | 1.33.0 |  |
| `lightningcss-win32-x64-msvc` | 1.32.0, 1.33.0 | 1.33.0 |  |
| `lodash` | 4.18.1 | 4.18.1 |  |
| `lodash.snakecase` | 4.1.1 | 4.1.1 |  |
| `long` | 5.3.2 | 5.3.2 |  |
| `longest-streak` | 3.1.0 | 3.1.0 |  |
| `loose-envify` | 1.4.0 | 1.4.0 |  |
| `lru.min` | 1.1.5 | 1.1.5 |  |
| `lucide-react` | 1.61.0 | 1.61.0 |  |
| `magic-bytes.js` | 1.13.1 | 1.13.1 |  |
| `magic-string` | 0.30.21, 1.4.3 | 1.4.3 | @tailwindcss/node@4.3.3: ^0.30.21; @vitest/mocker@5.0.5: ^1.4.3; vitest@5.0.5: ^1.4.3 |
| `make-dir` | 3.1.0 | 5.1.0 | @discordjs/node-pre-gyp@0.4.5: ^3.1.0 |
| `markdown-table` | 3.0.4 | 3.0.4 |  |
| `mdast-util-find-and-replace` | 3.0.3 | 3.0.3 |  |
| `mdast-util-from-markdown` | 2.1.0 | 2.1.0 |  |
| `mdast-util-gfm` | 3.1.0 | 3.1.0 |  |
| `mdast-util-gfm-autolink-literal` | 2.0.1 | 2.0.1 |  |
| `mdast-util-gfm-footnote` | 2.1.0 | 2.1.0 |  |
| `mdast-util-gfm-strikethrough` | 2.0.1 | 2.0.1 |  |
| `mdast-util-gfm-table` | 2.0.0 | 2.0.0 |  |
| `mdast-util-gfm-task-list-item` | 2.0.0 | 2.0.0 |  |
| `mdast-util-mdx-expression` | 2.0.1 | 2.0.1 |  |
| `mdast-util-mdx-jsx` | 3.2.0 | 3.2.0 |  |
| `mdast-util-mdxjs-esm` | 2.0.1 | 2.0.1 |  |
| `mdast-util-newline-to-break` | 2.0.0 | 2.0.0 |  |
| `mdast-util-phrasing` | 4.1.0 | 4.1.0 |  |
| `mdast-util-to-hast` | 13.2.1 | 13.2.1 |  |
| `mdast-util-to-markdown` | 2.2.0 | 2.2.0 |  |
| `mdast-util-to-string` | 4.0.0 | 4.0.0 |  |
| `micromark` | 4.0.3 | 4.0.3 |  |
| `micromark-core-commonmark` | 2.0.4 | 2.0.4 |  |
| `micromark-extension-gfm` | 3.0.0 | 3.0.0 |  |
| `micromark-extension-gfm-autolink-literal` | 2.1.0 | 2.1.0 |  |
| `micromark-extension-gfm-footnote` | 2.1.0 | 2.1.0 |  |
| `micromark-extension-gfm-strikethrough` | 2.1.0 | 2.1.0 |  |
| `micromark-extension-gfm-table` | 2.1.2 | 2.1.2 |  |
| `micromark-extension-gfm-tagfilter` | 2.0.0 | 2.0.0 |  |
| `micromark-extension-gfm-task-list-item` | 2.1.0 | 2.1.0 |  |
| `micromark-factory-destination` | 2.0.1 | 2.0.1 |  |
| `micromark-factory-label` | 2.0.1 | 2.0.1 |  |
| `micromark-factory-space` | 2.1.0 | 2.1.0 |  |
| `micromark-factory-title` | 2.0.1 | 2.0.1 |  |
| `micromark-factory-whitespace` | 2.0.1 | 2.0.1 |  |
| `micromark-util-character` | 2.1.1 | 2.1.1 |  |
| `micromark-util-chunked` | 2.0.1 | 2.0.1 |  |
| `micromark-util-classify-character` | 2.0.1 | 2.0.1 |  |
| `micromark-util-combine-extensions` | 2.0.1 | 2.0.1 |  |
| `micromark-util-decode-numeric-character-reference` | 2.0.2 | 2.0.2 |  |
| `micromark-util-decode-string` | 2.0.1 | 2.0.1 |  |
| `micromark-util-edit-map` | 1.0.0 | 1.0.0 |  |
| `micromark-util-encode` | 2.0.1 | 2.0.1 |  |
| `micromark-util-html-tag-name` | 2.0.1 | 2.0.1 |  |
| `micromark-util-normalize-identifier` | 2.0.1 | 2.0.1 |  |
| `micromark-util-resolve-all` | 2.0.1 | 2.0.1 |  |
| `micromark-util-sanitize-uri` | 2.0.1 | 2.0.1 |  |
| `micromark-util-subtokenize` | 2.1.0 | 2.1.0 |  |
| `micromark-util-symbol` | 2.0.1 | 2.0.1 |  |
| `micromark-util-types` | 2.0.3 | 2.0.3 |  |
| `miniflare` | 5.20261019.2-beta | 4.20260730.0 | wrangler@4.152.0: 5.20261019.2-beta |
| `minimatch` | 3.1.5 | 10.2.6 | glob@7.2.3: ^3.1.1 |
| `minimist` | 1.2.8 | 1.2.8 |  |
| `minipass` | 7.1.3 | 7.1.3 |  |
| `minizlib` | 3.1.0 | 3.1.0 |  |
| `motion-dom` | 14.6.0 | 14.6.0 |  |
| `motion-utils` | 14.6.0 | 14.6.0 |  |
| `ms` | 2.1.3 | 2.1.3 |  |
| `mysql2` | 3.24.4 | 3.24.6 | prisma@7.10.1: 3.24.4 |
| `named-placeholders` | 1.1.6 | 1.1.6 |  |
| `nanoid` | 3.3.20 | 6.0.2 | postcss@8.5.31: ^3.3.20 |
| `node-addon-api` | 8.9.2 | 8.9.2 |  |
| `node-fetch` | 2.7.0 | 3.3.2 | @discordjs/node-pre-gyp@0.4.5: ^2.6.7 |
| `nopt` | 5.0.0 | 10.0.1 | @discordjs/node-pre-gyp@0.4.5: ^5.0.0 |
| `npmlog` | 5.0.1 | 7.0.1 | @discordjs/node-pre-gyp@0.4.5: ^5.0.1 |
| `object-assign` | 4.1.1 | 4.1.1 |  |
| `obug` | 3.0.0 | 3.0.0 |  |
| `ohash` | 2.0.12 | 2.0.12 |  |
| `on-exit-leak-free` | 2.1.2 | 2.1.2 |  |
| `once` | 1.4.0 | 1.4.0 |  |
| `parse-entities` | 4.0.2 | 4.0.2 |  |
| `path-is-absolute` | 1.0.1 | 2.0.0 | glob@7.2.3: ^1.0.0 |
| `path-key` | 3.1.1 | 4.0.0 | cross-spawn@7.0.6: ^3.1.0 |
| `path-to-regexp` | 6.3.0 | 9.0.0 | wrangler@4.152.0: 6.3.0 |
| `pathe` | 2.0.3 | 2.0.3 |  |
| `perfect-debounce` | 2.1.0 | 2.1.0 |  |
| `pg` | 8.23.1 | 8.23.1 |  |
| `pg-cloudflare` | 1.4.1 | 1.4.1 |  |
| `pg-connection-string` | 2.14.1 | 2.14.1 |  |
| `pg-int8` | 1.0.1 | 1.0.1 |  |
| `pg-pool` | 3.14.0 | 3.14.0 |  |
| `pg-protocol` | 1.16.1 | 1.16.1 |  |
| `pg-types` | 2.2.0 | 4.1.0 | @types/pg@8.23.1: ^2.2.0; pg@8.23.1: 2.2.0 |
| `pgpass` | 1.0.5 | 1.0.6 | pg@8.23.1: 1.0.5 |
| `picocolors` | 1.1.1 | 1.1.1 |  |
| `picomatch` | 4.0.7 | 4.0.7 |  |
| `pino` | 10.4.0 | 10.4.0 |  |
| `pino-abstract-transport` | 3.0.0 | 3.0.0 |  |
| `pino-pretty` | 13.2.0 | 13.2.0 |  |
| `pino-std-serializers` | 7.1.0 | 7.1.0 |  |
| `pkg-types` | 2.4.0 | 2.4.0 |  |
| `postcss` | 8.5.31 | 8.5.31 |  |
| `postgres` | 3.4.7 | 3.4.9 | prisma@7.10.1: 3.4.7 |
| `postgres-array` | 2.0.0, 3.0.4 | 3.0.4 | @prisma/adapter-pg@7.10.1: 3.0.4; pg-types@2.2.0: ~2.0.0 |
| `postgres-bytea` | 1.0.1 | 3.0.0 | pg-types@2.2.0: ~1.0.0 |
| `postgres-date` | 1.0.7 | 2.1.0 | pg-types@2.2.0: ~1.0.4 |
| `postgres-interval` | 1.2.0 | 4.1.0 | pg-types@2.2.0: ^1.1.0 |
| `prism-media` | 1.3.5 | 1.3.5 |  |
| `prisma` | 7.10.1 | 7.10.1 |  |
| `process-warning` | 5.1.1 | 5.1.1 |  |
| `prop-types` | 15.8.1 | 15.8.1 |  |
| `proper-lockfile` | 4.1.2 | 4.1.2 |  |
| `property-information` | 7.2.0 | 7.2.0 |  |
| `pump` | 3.0.4 | 3.0.4 |  |
| `pure-rand` | 6.1.0 | 8.4.2 | fast-check@3.23.2: ^6.1.0 |
| `quick-format-unescaped` | 4.0.4 | 4.0.4 |  |
| `rc9` | 3.1.0 | 3.1.0 |  |
| `react` | 19.3.1 | 19.3.1 |  |
| `react-aria` | 3.53.1 | 3.53.1 |  |
| `react-aria-components` | 1.22.1 | 1.22.1 |  |
| `react-dom` | 19.3.1 | 19.3.1 |  |
| `react-is` | 16.13.1 | 19.3.1 | prop-types@15.8.1: ^16.13.1 |
| `react-markdown` | 10.1.0 | 10.1.0 |  |
| `react-router` | 8.5.0 | 8.5.0 |  |
| `react-stately` | 3.51.0 | 3.51.0 |  |
| `react-transition-group` | 4.4.5 | 4.4.5 |  |
| `readable-stream` | 3.6.2 | 4.8.0 | are-we-there-yet@2.0.0: ^3.6.0 |
| `readdirp` | 5.1.1 | 5.1.1 |  |
| `real-require` | 1.0.0 | 1.0.0 |  |
| `redis-errors` | 1.2.0 | 1.2.0 |  |
| `rehype-sanitize` | 6.0.0 | 6.0.0 |  |
| `remark-breaks` | 4.0.0 | 4.0.0 |  |
| `remark-gfm` | 4.0.1 | 4.0.1 |  |
| `remark-parse` | 11.0.0 | 11.0.0 |  |
| `remark-rehype` | 11.1.2 | 11.1.2 |  |
| `remark-stringify` | 11.0.0 | 11.0.0 |  |
| `remeda` | 2.33.4 | 2.53.0 | @prisma/dev@0.24.17: 2.33.4 |
| `require-addon` | 1.3.0 | 1.3.0 |  |
| `require-from-string` | 2.0.2 | 2.0.2 |  |
| `ret` | 0.5.1 | 0.5.1 |  |
| `retry` | 0.12.0 | 0.13.1 | proper-lockfile@4.1.2: ^0.12.0 |
| `rimraf` | 3.0.2 | 6.1.3 | @discordjs/node-pre-gyp@0.4.5: ^3.0.2 |
| `robust-predicates` | 3.0.3 | 3.0.3 |  |
| `rolldown` | 1.2.15 | 1.2.15 |  |
| `safe-buffer` | 5.2.1 | 5.2.1 |  |
| `safe-regex2` | 5.1.2 | 5.1.2 |  |
| `safe-stable-stringify` | 2.5.0 | 3.0.0 | pino@10.4.0: ^2.3.1 |
| `safer-buffer` | 2.1.2 | 2.1.2 |  |
| `scheduler` | 0.28.0 | 0.28.0 |  |
| `secure-json-parse` | 4.1.1 | 4.1.1 |  |
| `semver` | 6.3.1, 7.8.5 | 7.8.5 | @discordjs/node-pre-gyp@0.4.5: ^7.3.5; make-dir@3.1.0: ^6.0.0; sharp@0.35.5: ^7.8.5 |
| `set-blocking` | 2.0.0 | 2.0.0 |  |
| `sharp` | 0.35.5 | 0.35.5 |  |
| `shebang-command` | 2.0.0 | 2.0.0 |  |
| `shebang-regex` | 3.0.0 | 4.0.0 | shebang-command@2.0.0: ^3.0.0 |
| `signal-exit` | 3.0.7, 4.1.0 | 4.1.0 | foreground-child@3.3.1: ^4.0.1; gauge@3.0.2: ^3.0.0; proper-lockfile@4.1.2: ^3.0.2 |
| `sodium-native` | 5.2.0 | 5.2.0 |  |
| `sonic-boom` | 4.2.1, 5.0.2 | 5.0.2 | pino-pretty@13.2.0: ^5.0.0; pino@10.4.0: ^4.0.1 |
| `source-map-js` | 1.2.2 | 1.2.2 |  |
| `space-separated-tokens` | 2.0.2 | 2.0.2 |  |
| `split2` | 4.2.0 | 4.2.0 |  |
| `sql-escaper` | 1.5.2 | 1.5.2 |  |
| `standard-as-callback` | 2.1.0 | 2.1.0 |  |
| `std-env` | 3.10.0, 4.3.0 | 4.3.0 | @prisma/dev@0.24.17: 3.10.0; vitest@5.0.5: ^4.3.0 |
| `streamx` | 2.28.1 | 2.28.1 |  |
| `string-width` | 4.2.3 | 8.3.0 | gauge@3.0.2: ^4.2.3; wide-align@1.1.5: ^1.0.2 \|\| 2 \|\| 3 \|\| 4 |
| `string_decoder` | 1.3.0 | 1.3.0 |  |
| `stringify-entities` | 4.0.4 | 4.0.4 |  |
| `strip-ansi` | 6.0.1 | 7.2.0 | gauge@3.0.2: ^6.0.1; string-width@4.2.3: ^6.0.1 |
| `strip-json-comments` | 5.0.3 | 5.0.3 |  |
| `stripe` | 23.0.1 | 23.0.1 |  |
| `style-to-js` | 1.1.21 | 2.0.2 | hast-util-to-jsx-runtime@2.3.6: ^1.0.0 |
| `style-to-object` | 1.0.14 | 2.0.2 | style-to-js@1.1.21: 1.0.14 |
| `supports-color` | 10.2.2 | 11.0.0 | @poppinss/dumper@0.7.0: ^10.0.0 |
| `tailwind-merge` | 3.4.0 | 3.7.0 |  |
| `tailwind-variants` | 3.3.1 | 3.3.1 |  |
| `tailwindcss` | 4.3.3 | 4.3.3 |  |
| `tapable` | 2.3.3 | 2.3.3 |  |
| `tar` | 7.5.22 | 7.5.22 |  |
| `teex` | 1.0.1 | 1.0.1 |  |
| `text-decoder` | 1.2.7 | 1.2.7 |  |
| `thread-stream` | 4.2.0 | 4.2.0 |  |
| `tinybench` | 6.2.2 | 6.2.2 |  |
| `tinyexec` | 1.3.1 | 1.3.1 |  |
| `tinyglobby` | 0.2.17 | 0.2.17 |  |
| `tr46` | 0.0.3 | 7.0.0 | whatwg-url@5.0.0: ~0.0.3 |
| `trim-lines` | 3.0.1 | 3.0.1 |  |
| `trough` | 2.2.0 | 2.2.0 |  |
| `ts-mixer` | 6.0.4 | 6.0.4 |  |
| `tslib` | 2.8.1 | 2.8.1 |  |
| `tsx` | 4.23.15 | 4.23.15 |  |
| `tw-animate-css` | 1.4.0 | 1.4.0 |  |
| `typescript` | 7.0.2 | 7.0.2 |  |
| `undici` | 8.12.3 | 8.12.3 |  |
| `undici-types` | 7.24.6 | 8.12.3 | @types/node@24.19.2: >=7.24.0 <7.24.7 |
| `unenv` | 2.0.0-rc.24 | 1.10.0 | wrangler@4.152.0: 2.0.0-rc.24 |
| `unified` | 11.0.5 | 11.0.5 |  |
| `unist-util-is` | 6.0.1 | 6.0.1 |  |
| `unist-util-position` | 5.0.0 | 5.0.0 |  |
| `unist-util-stringify-position` | 4.0.0 | 4.0.0 |  |
| `unist-util-visit` | 5.1.0 | 5.1.0 |  |
| `unist-util-visit-parents` | 6.0.2 | 6.0.2 |  |
| `use-sync-external-store` | 1.7.0 | 1.7.0 |  |
| `util-deprecate` | 1.0.2 | 1.0.2 |  |
| `valibot` | 1.4.2 | 1.5.0 | @prisma/dev@0.24.17: 1.4.2 |
| `vfile` | 6.0.3 | 6.0.3 |  |
| `vfile-message` | 4.0.3 | 4.0.3 |  |
| `vite` | 8.3.5 | 8.3.5 |  |
| `vitest` | 5.0.5 | 5.0.5 |  |
| `wanakana` | 5.3.1 | 5.3.1 |  |
| `webidl-conversions` | 3.0.1 | 8.0.1 | whatwg-url@5.0.0: ^3.0.0 |
| `whatwg-url` | 5.0.0 | 17.3.0 | node-fetch@2.7.0: ^5.0.0 |
| `which` | 2.0.2 | 7.0.0 | cross-spawn@7.0.6: ^2.0.1 |
| `which-runtime` | 1.4.0 | 1.4.0 |  |
| `why-is-node-running` | 3.2.1 | 3.2.3 | vitest@5.0.5: 3.2.1 |
| `wide-align` | 1.1.5 | 1.1.5 |  |
| `workerd` | 1.20261019.1 | 1.20261024.1 | miniflare@5.20261019.2-beta: 1.20261019.1; wrangler@4.152.0: 1.20261019.1 |
| `wrangler` | 4.152.0 | 4.152.0 |  |
| `wrappy` | 1.0.2 | 1.0.2 |  |
| `ws` | 8.22.0 | 8.22.0 |  |
| `xtend` | 4.0.2 | 4.0.2 |  |
| `yallist` | 5.0.0 | 5.0.0 |  |
| `youch` | 4.1.1 | 4.1.1 |  |
| `youch-core` | 0.3.3 | 0.3.3 |  |
| `zeptomatch` | 2.1.0 | 2.1.0 |  |
| `zod` | 4.6.7 | 4.6.7 |  |
| `zwitch` | 2.0.4 | 2.0.4 |  |
