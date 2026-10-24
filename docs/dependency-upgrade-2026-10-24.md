# 2026-10-24 依存関係更新

## 方針と調査

PR #46 / `chore/upgrade-all-deps-20261024` を継続する。npm registry の公開日時と数値形式の安定版を照合し、プレリリースを除外する。Prisma CLI の `latest` は `8.0.0-rc.27` のため採用せず、Client / adapter / CLI を最新安定版 `7.10.1` に揃える。Node.js `24.22.1` / pnpm `9.15.9` は維持し、Node型も24系を使う。

既存PRは主要な直接依存の更新済み候補を含むが、Prisma 6への一時固定と生成型の欠落、Vitestによるdist再収集、Stripe旧API参照が残っている。過去の失敗は Actions run `40077734402`（head `7283051`）。

## 互換性維持の設計

- Prisma 7: 接続URLは `prisma.config.ts` に移し、PostgreSQL driver adapterで接続する。Bot/APIは同じスキーマ・同じClientを利用する。モデルと既存SQL migrationは変更しない。生成時にはDB接続や本番の認証情報を必要としない。
- 既存の `DATABASE_URL` の `connection_limit` と `schema` をadapter設定へ移す。タイムアウト等の接続設定も検証し、暗黙に無制限接続にしない。
- Vitest: 各ワークスペースの `src` をテスト収集のルートとし、distの複製を収集しない。正規のソーステストは維持する。
- Stripe 23: SDKのAPIバージョンに揃え、subscription itemの課金期限、invoice parentのsubscription、invoice paymentsによるchargeとの対応を利用する。旧バージョンのWebhookと永続化済みoutboxも処理可能にする。支払い失敗・全額返金時のBoost解除とPub/Subの契約は維持する。
- HeroUI: 公開peer依存を明示してReact 19と整合させる。
- セキュリティoverrideは依存元のAPI互換性を調べて整理する。推移依存の無条件なメジャー差し替えは避け、互換性を確認できないものは理由を記録する。
- 一時的な自動更新workflowは削除し、通常PR CIで検証する。PRへのpushで本番ビルド・公開が実行されないことを確認する。

## 参照した公式仕様

- https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7
- https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool
- https://vitest.dev/guide/migration.html
- https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end
- https://docs.stripe.com/api/invoice-payment/list

## 検証と本番移行

実行結果・全依存一覧・制約・手動検証とロールバック手順は検証後に追記する。本番へのSSH、DBリセット、本番migration、マージ、デプロイは禁止。VOICEVOXのdigest固定とWatchtower除外を解除しない。既存Composeのlatestタグは本番の固定済み設定に上書き適用しない。

## Prisma / ランタイム検証

- PostgreSQL 16の隔離コンテナで既存9件のmigrationを適用し、再適用の冪等性を確認。Bot/APIのClient共有、JSONと日時、リレーション、Serializable、ロールバック、P2002/P2025/P2034を確認する専用スクリプトを追加。
- Dockerの通常版/本番版でconfigを明示してClientを生成する。API起動時のmigrationも同じconfigを使用する。
- dotenv 18で同名の`dotenv`バイナリが追加されたため、既存dotenv-cliのJSエントリを明示し、ルート.envの読み込みと変数展開を維持する。
- Undici 8.12.3へのoverride後、実際のDiscord RESTクライアントからローカルHTTPへのGET/PUT、シャーディング初期化、Opusの符号化/復号、sodium暗号化を確認。

## Stripe の移行

旧参照を型アサーションで隠さず、item課金期限、invoice parent、Invoice Paymentsを使用する。Checkoutの課金モードは公式変更点を確認し、`classic`を明示して日割り計算などの既存仕様を維持する。Webhookのraw body署名検証・永続化・再試行は維持し、旧イベント形も引き続き処理する。

回帰テストは新旧payload、支払い成功/失敗、数量増減、返金対象の特定・全ページ処理・重複排除、部分返金、APIの一時失敗、期限欠落、手動同期と定期整合の期限更新を検証する。

参考: https://docs.stripe.com/changelog/clover/2025-09-30/billing-mode-default-flexible

## CI の整理

`.github/workflows/dependency-refresh.yml` を削除し、自動更新コミットの再発を防ぐ。通常CIではPostgreSQL 16 / Redis 7のローカルテストサービスを使い、migration・DB例外・RESP3のセッション/ロック/PubSubを検証する。Docker検証はBot/API × 通常版/本番版の4種類。イメージはPRで公開せず、アプリ起動時のmigrationも実行しない。

GitHub Actionsは公式最新安定リリースのcheckout 7.0.1、setup-node 7.1.0、pnpm/action-setup 6.1.0、paths-filter 4.0.3、docker/login-action 4.7.0、setup-buildx-action 4.4.1、build-push-action 7.4.0に統一。Pages用Wranglerは4.152.0をルート開発依存としてlockし、`pnpm exec wrangler`を使う。`pages deploy --help`でCLI互換性を確認し、公開操作は実行していない。

## 直接依存・開発依存・optional依存の全一覧

mainとの差分。未変更の最新安定版も含む。`@types/node`はNode 24系の最新。推移依存全件は[別表](dependency-inventory-2026-10-24.md)。

| パッケージ | main | 更新後 | workspace |
|---|---|---|---|
| `@discordjs/opus` | ^0.10.0 | ^0.10.0 | apps/bot |
| `@discordjs/voice` | ^0.19.2 | ^0.19.2 | apps/bot |
| `@heroui/react` | ^3.0.1 | ^3.2.6 | apps/admin, apps/web |
| `@heroui/styles` | ^3.0.1 | ^3.2.6 | apps/admin, apps/web |
| `@hono/node-server` | ^1.13.8 | ^2.1.5 | apps/api |
| `@internationalized/date` | ^3.12.0, 追加 | ^3.12.4 | apps/admin, apps/web |
| `@prisma/adapter-pg` | 追加 | 7.10.1 | apps/api, apps/bot |
| `@prisma/client` | ^6.19.2, ^6.6.0 | 7.10.1 | apps/api, apps/bot |
| `@react-aria/ssr` | 追加 | ^3.10.1 | apps/admin, apps/web |
| `@react-aria/utils` | 追加 | ^3.34.1 | apps/admin, apps/web |
| `@tailwindcss/vite` | ^4.0.0 | ^4.3.3 | apps/admin, apps/web |
| `@types/node` | ^24.19.2 | ^24.19.2 | apps/api, apps/bot, packages/shared |
| `@types/react` | ^19.0.0 | ^19.3.0 | apps/admin, apps/web |
| `@types/react-dom` | ^19.0.0 | ^19.3.0 | apps/admin, apps/web |
| `@vitejs/plugin-react` | ^4.0.0 | ^6.1.2 | apps/admin, apps/web |
| `cross-env` | ^10.1.0 | ^10.1.0 | root |
| `discord.js` | ^14.25.1 | ^14.27.0 | apps/bot |
| `dotenv` | ^16.5.0 | ^18.0.9 | apps/bot |
| `dotenv-cli` | ^11.0.0 | ^11.0.0 | apps/api, apps/bot |
| `emojibase-data` | ^17.0.0 | ^18.0.0 | apps/bot |
| `framer-motion` | ^12.38.0 | ^14.6.0 | apps/web |
| `hono` | 4.12.25 | 4.13.13 | apps/api |
| `ioredis` | ^5.6.1 | ^6.0.0 | apps/api, apps/bot |
| `lucide-react` | ^0.577.0 | ^1.61.0 | apps/web |
| `pino` | ^9.6.0 | ^10.4.0 | apps/api, apps/bot, packages/shared |
| `pino-pretty` | ^13.0.0 | ^13.2.0 | apps/api, apps/bot, packages/shared |
| `prisma` | ^6.19.2, 追加 | 7.10.1 | apps/api, apps/bot |
| `react` | ^19.0.0 | ^19.3.1 | apps/admin, apps/web |
| `react-dom` | ^19.0.0 | ^19.3.1 | apps/admin, apps/web |
| `react-markdown` | ^10.1.0 | ^10.1.0 | apps/admin, apps/web |
| `react-router` | ^7.18.2 | ^8.5.0 | apps/admin, apps/web |
| `rehype-sanitize` | ^6.0.0 | ^6.0.0 | apps/admin, apps/web |
| `remark-breaks` | ^4.0.0 | ^4.0.0 | apps/admin, apps/web |
| `remark-gfm` | ^4.0.1 | ^4.0.1 | apps/admin, apps/web |
| `sodium-native` | ^5.1.0 | ^5.2.0 | apps/bot |
| `stripe` | ^17.7.0 | ^23.0.1 | apps/api |
| `tailwindcss` | ^4.0.0 | ^4.3.3 | apps/admin, apps/web |
| `tsx` | ^4.19.3 | ^4.23.15 | apps/api, apps/bot |
| `typescript` | ^5.0.0, ^5.8.3 | ^7.0.2 | apps/admin, apps/api, apps/bot, apps/web, packages/shared |
| `vite` | ^6.0.0 | ^8.3.5 | apps/admin, apps/web |
| `vitest` | ^3.1.0 | ^5.0.5 | apps/admin, apps/api, apps/bot, apps/web, packages/shared |
| `wanakana` | ^5.3.1 | ^5.3.1 | apps/bot |
| `wrangler` | 追加 | 4.152.0 | root |
| `zod` | ^4.3.6 | ^4.6.7 | apps/api |

## override整理と未更新項目

lockfileを一度ゼロから再解決して、既存lockの残留による未更新でないことを確認した。既存のeffect / defu / lodash / brace-expansion / deepmerge-tsのoverrideは削除し、上流の指定を優先しても監査0件であることを確認した。

- `undici=8.12.3`: Discordの旧メジャー要求に対して最新安定版を適用。実Discord REST経由のHTTP GET/PUTとnative runtimeを検証。
- `tar>=7.5.22 <8`: Opusのnode-pre-gypは古い6系要求のため、修正済み7系overrideを維持。LinuxとmacOSのnative build / 符号化・復号を検証。
- `ws=8.22.0`: Wrangler配下の古いexact pinも修正版へ統一。
- `@visx/{curve,event,grid,group,point,responsive,scale,shape,vendor}=4.0.0`: Prisma Studioのalpha固定を最新安定版で置換。隔離DB上でStudioを起動し、テーブルの読込・外部キーの関連図表示をブラウザーで確認。コンソールエラーなし。
- `youch=4.1.1`: Miniflare配下のbetaを最新安定版へ置換。WranglerのPages CLIと全ビルドで検証。

直接採用したnpmパッケージはすべて安定版。Node/pnpmは依頼通り24.22.1/9.15.9を維持し、型定義は24系最新の24.19.2に合わせる。以下の**上流固定の推移依存は要件を完全には達成できていない**。

| 項目 | 残した版 | 根拠・制約 |
|---|---|---|
| miniflare | 5.20261019.2-beta | 最新安定版Wrangler 4.152.0がexact指定。Miniflare 5には安定版が公開されておらず、最新安定4.20260730.0への置換はWranglerの要求メジャーを満たさない。依存元の更新が必要。Pages公開は未実行。 |
| unenv | 2.0.0-rc.24 | Wranglerのexact指定。安定1.10.0にはWranglerが実際に呼ぶ`defineEnv`がなく、1系を別環境へインストールして`undefined`となることを確認。RCを除去するとNode互換polyfill機能を破壊するため保留。 |
| @prisma/engines-version | 8.1.0-1.d1b3f377ca835d73fd50954a5e22128b9ebdd6b8 | 安定CLI 7.10.1が指定するエンジンhash識別子。独立したalpha/RC版CLIの採用ではない。registry上の数値版0.0.1へ差し替えるとCLIのエンジンと不整合になるため維持。 |
| その他の推移依存 | 全件を別表に記載 | effect 3.20.0（最新4.0.6）、@discordjs/ws 1.2.3（最新2.0.4）、glob 7.2.3（最新13.0.6）など。最新の親ライブラリが旧APIの範囲またはexact版を要求。アプリから呼ばない依存を一括メジャー置換すると親の内部実装を壊すため、上流の制約と各解決版を別表に残す。 |

これらを含め、開発依存も含む全依存の監査結果はhigh/criticalを含む全深刻度0件。上流固定の旧版/プレリリースが残ることと、監査に問題がないことは別の結果として扱う。

## 手動検証・本番反映・ロールバック

この作業では本番SSH、稼働サービス再作成、DBリセット、本番migration、mainへのマージ、公開/デプロイは行わない。Composeのインフライメージも変更しない。

1. ステージングでDBバックアップを復元し、同じイメージ・Node 24・環境変数で起動する。既存migrationの履歴と未適用migrationを確認する。本変更によるモデル/SQL変更はない。
2. DiscordテストサーバーでOAuthログイン、権限拒否、VC入退室、全シャード、再接続、VOICEVOXの話者・速度・ピッチと日本語読み上げを確認する。Redisセッションと各Pub/Subのキャッシュ無効化も複数プロセスで確認する。
3. Stripe SandboxでCheckout、期末解約、数量変更、支払い失敗/再試行、全額/部分返金、Webhook再送・署名不正・outbox再開を確認する。新規契約がclassicのままであること、Boost数/期限/解除と請求額を照合する。実課金と本番Webhookは未検証。
4. Webhook endpointのAPIバージョンはアプリ更新とは別設定。旧版でも動作するため、アプリの確認後に新endpointをテストし、受信イベントの重複が冪等に扱われることを確認する。アカウント全体のAPI既定版を一括変更しない。
5. VOICEVOXの稼働中digestとWatchtower除外を記録・維持する。リポジトリのComposeにあるlatestタグを、本番のdigest固定済み定義へ上書きしない。GPU・モデル・ボリュームの検証が済むまではインフラ更新を別作業にする。
6. 反映時は旧Bot/APIイメージのdigest、設定ファイル、Stripe endpoint設定を保存する。不具合時は旧イメージと設定に戻す。DBのdown migrationやresetは不要で、現在のデータとoutboxを保持する。Webhook endpointを新形式に切り替えた場合、旧アプリへ戻す前にendpointも旧版へ戻すか、この互換ハンドラーを残す。支払いイベントやBoostレコードを手動削除しない。

ローカルの実ブラウザーではWebのホーム→コマンド遷移とAdminのログイン必須画面を確認し、コンソールエラーなし。ログイン後のフォーム全操作、実Discordの音声、実VOICEVOX/GPU、Stripe Sandbox/本番、外部TLS DB/Redis、Cloudflareへの実公開は未検証。
