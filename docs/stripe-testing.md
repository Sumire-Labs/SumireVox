# Stripe Sandbox のローカルテスト環境

## 構成と分離

`pnpm stripe:test setup` は専用のPostgreSQL 16（127.0.0.1:15446）、Redis 7（127.0.0.1:16446）、ローカル設定 `.env.stripe-test.local` を準備する。通常の `.env` は読み込まない。DB名は `sumirevox_stripe_test`、Compose projectは `sumirevox-stripe-test`。既存のmigrationを専用DBに適用し、本番モデルやmigrationは変更しない。

APIは `pnpm stripe:test api` で127.0.0.1:3146に起動する。本物のアプリ、Webhook署名検証、outbox、定期整合処理を使う。Discord/Bot/VOICEVOXは起動しない。Checkout用の一時セッションを専用Redisに作るため、Discordログインは不要。テスト用セッションは本番Redisに作れず、APIにも認証迂回を追加しない。

Stripe CLIとNode.js 24.22.1は `.stripe-test/tools` にインストールする（アプリ依存の更新なし）。CLIの認証設定は `.stripe-test/cli.toml`、環境変数は `.env.stripe-test.local` に保存し、Gitから除外する。スクリプトは本番キー、専用ポート/DB以外の接続先を拒否する。Stripeのアカウント既定APIや既存Webhook endpointは変更しない。

## 準備

すべてリポジトリルートで実行する。Docker Desktopとpnpm 9.15.9が必要。

```bash
pnpm stripe:test setup
pnpm stripe:test login
```

ブラウザーで既存Stripeアカウントにログインし、CLIの接続を承認する。DashboardのSandbox一覧でテスト専用Sandboxを作成または選択する。既存本番設定をコピーする場合も、操作対象がSandboxであることを確認する。Sandbox内のテスト用シークレットキー `sk_test_...` を `.env.stripe-test.local` の `STRIPE_SECRET_KEY` に設定する。キーはチャットやGitへ貼らない。

```bash
pnpm stripe:test configure
```

テスト用月額300円のPriceを冪等に作成し、同じテストキーでCLIのWebhook署名secretを取得して設定ファイルへ保存する。Priceが既に設定済みならtest mode・通貨・金額・周期を確認する。

## 起動とCheckout

ターミナルを2つ開く。

```bash
# ターミナル1: WebhookをローカルAPIへ転送（本番イベントは転送しない）
pnpm stripe:test listen

# ターミナル2: ローカルAPI
pnpm stripe:test api
```

別のターミナルからCheckoutを作成する。表示されるStripe Checkout URLをブラウザーで開く。

```bash
pnpm stripe:test checkout
pnpm stripe:test status
```

テストカードは `4242 4242 4242 4242`、有効期限は未来、CVCは任意の3桁を使う。実カードは使わない。Checkoutの `billing_mode: classic` は実アプリの実装をそのまま使う。完了後はローカルの案内画面へ戻る。デフォルトのテストユーザーIDは `900000000000000046`、別ユーザーは `pnpm stripe:test checkout 900000000000000047` と指定する。既存契約が有効なユーザーにはCheckoutを重複作成しない。

## 確認するシナリオ

1. Checkout完了 → outboxがPROCESSED、SubscriptionがACTIVE、購入数量分のBoostがある。
2. Sandboxの決済画面で部分返金 → 契約とBoostを維持する。
3. 残額も返金して全額返金 → 対象契約だけCANCELED、対象Boostだけ削除する。
4. 同じ顧客に別契約を持たせても、返金対象でない契約が維持される。契約外の支払いは警告 `stripe_refund_unresolved` を記録する。
5. Webhook再送後もBoostが増えたり破損したりしない。`status` でイベントID、status、attempts、lastErrorを確認する。
6. 500/429/通信障害、DBロールバック、解約レスポンス消失はモック回帰テストでも確認する。本物のStripe APIで意図的な障害を起こさない。

```bash
pnpm --filter @sumirevox/api test -- src/services/__tests__/stripe-webhook-handler.test.ts src/services/__tests__/stripe-refund-subscriptions.test.ts src/services/__tests__/stripe-event-outbox.test.ts
node --test scripts/stripe-test-config.test.mjs
```

CLIの `trigger` はテスト用の汎用fixtureを作るため、実Checkoutの返金検証の代わりにはならない。今回の修正は実際に作ったSandboxのInvoice/Chargeを返金して確認する。アプリが処理する6種のイベントだけを転送し、接続先Sandboxと設定キーを統一する。

## 停止・再開

APIとlistenはCtrl+Cで停止する。`pnpm stripe:test down` は専用コンテナを止めるがデータボリュームを削除しない。再開はsetup後にlisten/apiを起動する。設定ファイルは既存値を上書きしない。同じSandboxのキーを変更したらconfigureを再実行してAPI/listenを再起動する。別のSandboxへ変更する場合は `STRIPE_PRICE_ID` と `STRIPE_WEBHOOK_SECRET` を空にしてからconfigureを実行する。

参照: [Stripe Sandbox](https://docs.stripe.com/sandboxes)、[CLI listen](https://docs.stripe.com/cli/listen)、[テストカード](https://docs.stripe.com/testing)。
