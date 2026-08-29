# ブースト（課金）システム

## 概要

ユーザー個人が Stripe でサブスクリプション（ブースト枠）を購入 → 参加サーバーに割り当て → PREMIUM 化。

## 料金

月額300円 / 1ブースト。年額プランなし。

## 仕様

- 複数ブースト枠購入可能
- 1ユーザーあたりの契約は1サブスクリプションに統一し、数量変更は Billing Portal から行う
- 1ブースト = 1サーバー PREMIUM
- 自分が参加しているサーバーにのみ割り当て可能
- 割り当て → 即座に PREMIUM、外す → 即座に FREE

## 付け替えクールダウン

- ブースト枠をサーバーから外した場合、7日間 (`BOOST_COOLDOWN_DAYS`) のクールダウン
- クールダウン中は別サーバーに割り当て不可
- `Boost.unassignedAt` からの経過時間で判定

## PREMIUM 判定

以下のいずれかで PREMIUM:
1. `GuildSettings.manualPremium === true`
2. 有効なブースト (active Subscription + guildId 割り当て済み Boost) が1つ以上

## Stripe 連携

- Stripe Checkout Session 方式で決済
- Webhook でサブスクリプションステータス管理 (支払い成功/失敗/解約等)
- 解約しても現請求期間終了まではブースト有効
- `PAST_DUE` に遷移したサブスクリプションのブーストは即時解除
- サブスクリプション数量減少で強制的に失効したブーストは監査用テーブルへ退避する

## Webhook 受信と処理モデル（outbox）

- エンドポイント: `POST /api/stripe/webhook`（`Stripe-Signature` ヘッダ + raw body で署名検証）
- 署名検証成功後、イベントを `stripe_events` に `PENDING` 状態で永続化（outbox）してから `200` を返す
  - Stripe は応答待ち時間が短い（約10秒）ため、業務処理そのものはレスポンス後に非同期実行する
  - 永続化を `200` 応答の前に行うことで、後続処理の失敗・プロセスクラッシュ・デプロイ中断があっても
    イベントが失われず、`drainStripeEventOutbox` が必ず再生する
  - 永続化自体が失敗した場合は `500` を返し、Stripe に再送させる
- 業務処理は `drainStripeEventOutbox` が `PENDING` イベントを古い順に処理し、成功時に `PROCESSED` へ更新する
  - 実行タイミング: 受信直後・サーバー起動時・定期整合処理時
  - 失敗したイベントは `PENDING` のまま残り、`attempts` / `last_error` を更新して次回再試行する
  - 再試行回数が上限（100回）を超えたイベントはドレイン対象から外す（死票化）。恒久失敗する毒行が
    キューの先頭に居座って後続イベントを恒久的にブロックするのを防ぐ。死票行は `attempts` / `last_error` で特定できる
- 冪等性: イベントは `stripe_events` の主キー（event id）で一意。再配信・同時配信は enqueue 時に
  既存レコードとして扱われ、二重処理されない
- 未知のイベント種別は成功扱い（`200`）でスキップする
- 対象リソースが Stripe 上で削除済み（`resource_missing` / 404）の場合も成功扱いでスキップする
- `STRIPE_SECRET_KEY` を設定して Stripe を有効化する場合は `STRIPE_WEBHOOK_SECRET` が必須
  （未設定だと起動エラー。空のまま署名検証に失敗して全配信が 400 になるのを防ぐ）

## 定期整合処理

Webhook 配信失敗や遅延による DB と Stripe の不整合を修復するため、API サーバーは起動後1インターバル経過後から定期的に整合処理を実行する。同時に、未処理の Stripe イベント（outbox の `PENDING` 行）のドレインも実行する。

- 実行間隔: `STRIPE_RECONCILE_INTERVAL_MS`（デフォルト1時間）
- 対象: DB 上で `ACTIVE` または `PAST_DUE` の全サブスクリプション
- 処理内容:
  - Stripe 側が `canceled` / `incomplete_expired` → DB を `CANCELED` に更新し、割り当て済みブーストを解除
  - Stripe 側に存在しない (404) → 同上
  - status / currentPeriodEnd / boostCount に差分あり → DB を Stripe の値で上書き
  - `PAST_DUE` に変化かつ割り当て済みブーストあり → 即時解除
  - boostCount 増減 → ブースト枠を追加または削除 (減少時は `adjustBoostSlots` で監査ログ付き強制解除)
- Stripe API の rate limit 対策として各リクエスト間に 200ms の delay を挿入
- 1件の処理失敗は他のサブスクリプションに影響しない

## FREE と PREMIUM の機能差

| 機能 | FREE | PREMIUM |
|---|---|---|
| 読み上げ最大文字数 | 50 | 200 |
| ユーザー設定 (話者/速度/ピッチ) 適用 | ✓ | ✓ |
| 複数チャンネル読み上げ | ✗ | ✓ (将来) |
| サーバー辞書エントリ上限 | 30件 | 300件 |
| 利用可能 Bot 数 | 1台 | ブースト数 + 1台 (最大5台) |

利用可能な Bot 台数は `min(有効Boost数 + 1, MAX_BOT_INSTANCES)` で決まる。1号機は常に利用でき、2号機以降はそれぞれ 1、2、3、4 Boost で解禁される。`manualPremium` のサーバーでは全アクティブインスタンスを利用できる。

## PREMIUM → FREE 移行時

- DB 上の設定値は保持 (再度 PREMIUM で復帰)
- 読み上げ時に FREE 上限でクランプ
- 辞書エントリは削除しないが、上限超過時は新規追加禁止
