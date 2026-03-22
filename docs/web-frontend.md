# Web フロントエンド

## 全体構成

2つの独立した Vite SPA。UIライブラリは HeroUI (旧 NextUI)、スタイリングは Tailwind CSS、ルーティングは React Router。

| アプリ | ドメイン | 対象 |
|---|---|---|
| メインサイト (web/) | sumirevox.com | 全ユーザー |
| 管理者ダッシュボード (admin/) | admin.sumirevox.com | Bot 管理者のみ |

## nginx 構成

1つの nginx コンテナで2ドメインをホストベースルーティング。

- sumirevox.com: `/api/*`, `/auth/*` → Hono API。それ以外 → web/ ビルド成果物 (SPA fallback)
- admin.sumirevox.com: `/api/*`, `/auth/*` → 同じ Hono API。それ以外 → admin/ ビルド成果物 (SPA fallback)

## メインサイト (sumirevox.com) ページ構成

### 公開ページ (認証不要)

| パス | 内容 |
|---|---|
| / | トップページ (Bot 紹介、特徴、導入ボタン、料金比較) |
| /commands | コマンド一覧・使い方 |
| /credits | VOICEVOX クレジット表記 |
| /terms | 利用規約 |
| /privacy | プライバシーポリシー |
| /legal | 特定商取引法に基づく表記 |

### ダッシュボード (認証必要)

| パス | 対象 | 内容 |
|---|---|---|
| /dashboard | 全ログインユーザー | マイページ (ブースト枠一覧、サブスク状況) |
| /dashboard/boost | 全ログインユーザー | ブースト購入・管理 |
| /dashboard/servers | サーバー管理者 | 管理サーバー一覧 |
| /dashboard/servers/:guildId | サーバー管理者 | サーバー設定 |
| /dashboard/servers/:guildId/dictionary | サーバー管理者 | サーバー辞書管理 |

## 管理者ダッシュボード (admin.sumirevox.com)

Bot 管理者 (BOT_ADMIN_USER_IDS) のみ。

| パス | 内容 |
|---|---|
| / | 概要 (接続サーバー数等の統計) |
| /servers | 全サーバー一覧、手動 PREMIUM 切替 |
| /dictionary | グローバル辞書管理 |
| /requests | グローバル辞書申請管理 |

## フロントエンド共通方針

- HeroUI のテーマ設定 (カラーパレット等) と Tailwind 基本設定のみ共有
- 共通 UI パッケージは設けない (将来必要なら packages/ui/ を切り出し)
- 認証: Discord OAuth2 → Cookie セッション
