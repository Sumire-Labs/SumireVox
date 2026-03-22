---
paths:
  - "apps/web/**"
  - "apps/admin/**"
---

# フロントエンド固有ルール

## 技術

- React + Vite (SPA)
- HeroUI (旧 NextUI) — UI コンポーネントの主軸
- Tailwind CSS — カスタムスタイル
- React Router — クライアントサイドルーティング

## UIライブラリ

HeroUI を主要コンポーネントに使用する。Tailwind CSS + React Aria ベース。HeroUI のテーマ設定 (カラーパレット等) と Tailwind 基本設定は web/ と admin/ で共有する。

## 構成

- web/ と admin/ は独立した Vite プロジェクト
- 共通 UI パッケージは設けない
- 共通化が必要になったら packages/ui/ を切り出す

## 認証フロー

1. `/auth/login` で Discord OAuth2 認可画面にリダイレクト
2. `/auth/callback` でトークン交換、セッション作成
3. 以降は Cookie セッションで API にアクセス
4. `/auth/me` でセッションのユーザー情報取得
