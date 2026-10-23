# Node.js 24 LTS 移行・検証記録

検証日: 2026-10-23。起点: `origin/main`の`6593b01`。作業ブランチ: `chore/upgrade-node-24`。

## 変更内容

- 開発環境・6つのDockerfile・GitHub Actions・Cloudflare PagesのビルドをNode.js 24.22.1 LTSに統一した。
- ルートの`engines.node`は`>=24.22.1 <25`、`.nvmrc`は`24.22.1`。pnpmは9.15.9を維持し、Dockerの`pnpm@latest`を廃止した。
- Bot/API/sharedの`@types/node`を22.19.15から24.19.2へ更新した。対応する`undici-types`は6.21.0から7.24.6へ変わった。型定義のパッチ番号はNode.js本体とは独立している。
- ロックファイルはpnpm 9.15.9の通常の`install`で更新し、`--frozen-lockfile`で再検証した。上記2パッケージ以外の解決バージョンは変更していない。
- Dockerのビルド成立に必要な共通設定のコピー、Adminのshared依存のインストール・ビルド、Botの音声アセット配置を補った。Botの誤った`node_modules/.prisma`コピーを除き、実際の生成先であるpnpmストアを含む`node_modules`をコピーする構成にした。
- 開発用Bot/APIにもOpenSSLとネイティブ依存のビルドツールを追加し、Botには本番用と同様にffmpegを配置した。
- `AGENTS.md`、`README.md`、`docs/architecture.md`を更新した。architectureの既存の「24-alpine」は実際のDockerfileと異なっていたため、24.22.1-slimへ修正した。過去の監査記録は保持した。
- アプリケーションのソース、公開API、DBスキーマ、データ、環境変数の値は変更していない。

## 依存関係の互換性

固定されたパッケージの公開メタデータと公式情報を確認した。Node.jsの対応条件を満たすことと、外部サービスを含む実動作を検証できたことは区別する。

| パッケージ | 維持したバージョン | 公開されたNode.js条件・確認結果 |
|---|---|---|
| discord.js | 14.25.1 | `>=18`。モジュール読み込みとShardingManager生成が成功 |
| @discordjs/voice | 0.19.2 | `>=22.12.0`。モジュール読み込みが成功 |
| @discordjs/opus | 0.10.0 | `>=12.0.0`。Node.js 24.22.1でソースビルド・読み込み・PCMのエンコード/デコードが成功 |
| sodium-native | 5.1.0 | Node.jsのengines制限なし。配布済みネイティブバイナリの読み込み・暗号化/復号が成功 |
| @prisma/client / prisma | 6.19.2 | `>=18.18`。Client生成・インスタンス生成が成功。DB接続は未検証 |
| @hono/node-server | 1.19.11 | `>=18.14.1`。一時HonoサーバーのHTTP疎通が成功 |
| vite | 6.4.1 | `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0`。Web/Adminビルドが成功 |
| vitest | 3.2.4 | `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0`。全既存テストが成功 |
| tsx | 4.21.0 | `>=18.0.0`。バージョン・TypeScript実行を確認 |

Node.js自体のセキュリティ修正は[24.22.1の公式リリース](https://nodejs.org/en/blog/release/v24.22.1)を参照。Dockerタグは[公式イメージ一覧](https://github.com/docker-library/official-images/blob/master/library/node)とDocker Hubで確認した。調査時の`node:24.22.1-slim`のmanifest digestは`sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205`。

[Corepackの公式説明](https://nodejs.org/download/release/v24.22.1/docs/api/corepack.html)、[Prismaのシステム要件](https://docs.prisma.io/docs/orm/v6/reference/system-requirements)、[Opus](https://github.com/discordjs/opus)、[sodium-native](https://github.com/holepunchto/sodium-native)も確認した。Corepackは24.22.1の公式配布に同梱されており、追加更新なしで指定のpnpmを有効化できた。

## 検証結果

ローカル検証はmacOS arm64で実施した。公式配布のNode.js 24.22.1をSHA-256照合後に一時ディレクトリへ展開し、PATHを明示して使用した。既存のシステム全体のNode.js設定は変更していない。

| 検証 | 結果 |
|---|---|
| `node --version` / `pnpm --version` | `v24.22.1` / `9.15.9` |
| 同梱Corepackによる`enable`・`prepare pnpm@9.15.9 --activate` | 成功 |
| 通常の`pnpm install` / `pnpm install --frozen-lockfile` | 成功 |
| 空の一時環境・専用の空ストアへのfrozen install | 成功。Opusは`npm_config_build_from_source=true`で実際にコンパイル |
| `pnpm --filter @sumirevox/bot exec prisma generate` | 成功。Prisma Client 6.19.2 |
| `pnpm build` | 全5ワークスペース成功。TypeScript型チェックを含む |
| `pnpm test` | 45ファイル・229テストすべて成功 |
| `node scripts/check-node-runtime.mjs bot` / `api` | 通常環境・空からインストールした環境の両方で成功 |
| VOICEVOXクライアントと一時HTTPモックの通信 | version・speakers・audio_query・synthesisが成功 |
| GitHub Actionsのactionlint 1.7.12 | 成功 |
| PR公開防止・バージョン指定・Docker全ステージの静的検証 | 成功 |
| `git diff --check` | 成功 |
| `pnpm audit --prod --audit-level=high` | **失敗**。既存の高重要度4件を含む31件 |
| Bot/API本番Dockerビルド | **未検証**。両コマンドともDockerデーモンに接続できずビルド開始前に終了 |
| 開発用Docker・migrate・Web/Admin Dockerビルド | **未検証**。同じDocker環境制約 |
| GitHub Actions上での実行 | **未実施**。push・PR作成は行っていない |

既存テストの内訳はshared 27、Bot 104、API 89、Web 7、Admin 2。Stripe Webhook、Discord API、権限、設定更新など既存モックテストが含まれる。実Discordログイン・シャードspawn・VC接続/音声再生、実DB/Redis連携、実OAuth2ログイン、実VOICEVOXエンジンとの通信は未検証。一時Honoサーバーの確認はHTTPアダプターの検証であり、DB接続を伴う実APIの起動確認ではない。

pnpm 9.15.9はNode.js 24.22.1で`DEP0169`（`url.parse()`）警告を出すが、インストール・テスト・ビルドは成功した。pnpmの更新は行っていない。

## 監査の未解決事項とCI

変更前の`origin/main`のロックファイルでも監査を実行し、同じ31件（high 4 / moderate 23 / low 4 / critical 0）であることを確認した。高重要度の対象は次のとおり。

| 既存パッケージ | 高重要度の指摘 | 修正版 |
|---|---|---|
| undici 7.29.0 | [WebSocketサブプロトコルによるDoS](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5)、[BalancedPoolのTLS検証回避](https://github.com/advisories/GHSA-w293-vg96-wgc3) | 7.29.1以上 |
| brace-expansion 5.0.9 | [ネストしたbraceによるDoS](https://github.com/advisories/GHSA-qhr7-859c-m2p7)、[parseCommaPartsによるDoS](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | 5.0.11以上で両方を修正 |

今回の承認済み計画に従い、Node.js互換性に必要な型定義以外の依存更新は行っていない。Node.js本体に含まれるUndiciの更新は、npm依存のundiciを更新するものではない。

CIの監査基準は維持している。この指摘が解消されるまでは監査ステップとテストジョブが失敗し、mainのイメージ公開も停止する。PRのテスト・ビルド・runtime確認は監査が失敗しても前段の準備が成功していれば実行し、各結果を取得する。監査失敗を成功として扱う設定は追加していない。

PRのDocker検証は読み取り権限で`push: false`・`load: true`とし、アプリ起動用entrypointを上書きして確認する。DBマイグレーションは実行しない。GHCR公開ジョブはmainへのpushに限定し、Pagesもmainへのpushのみで起動する。

本番デプロイ前には上記監査指摘の解消、LinuxでのBot/APIイメージビルドと実行確認、検証用Discord環境での接続・再生確認が必要。Docker・本番運用の完了条件は未達として扱う。

## コミット

- `f4b7f1c`: `chore: upgrade Node.js runtime and types to 24 LTS`
- `595f6a0`: `ci: validate Node.js 24 builds on pull requests`

push、本番デプロイ、稼働サービスの再起動は行っていない。元の作業ブランチと未pushの2コミットは保持した。
