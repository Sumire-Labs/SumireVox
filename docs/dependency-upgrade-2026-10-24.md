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
