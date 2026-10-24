# データモデル (Prisma スキーマ)

## GuildSettings

サーバー単位の設定。

| カラム                  | 型 | 備考 |
|----------------------|---|---|
| guildId              | String @id | |
| manualPremium        | Boolean | デフォルト false。Bot 管理者手動 PREMIUM |
| maxReadLength        | Int | デフォルト 50。読み上げ時に PREMIUM 状態でクランプ (FREE:50, PREMIUM:200) |
| readName             | Boolean | 名前読み上げ。デフォルト OFF |
| honorific            | Boolean | さん付け |
| romajiRead           | Boolean | ローマ字読み |
| joinLeaveNotify      | Boolean | 入退室通知 |
| greeting             | Boolean | Bot 入室挨拶 |
| customEmojiMode      | Enum | READ_NAME / REMOVE |
| readTargetType       | Enum | TEXT_ONLY / TEXT_STICKER / TEXT_STICKER_ATTACHMENT |
| defaultTextChannelId | String? | デフォルト読み上げチャンネル |
| defaultSpeakerId     | Int? | デフォルト話者 |
| adminRoleId          | String? | 管理ロール |
| dictPermission       | Enum | ALL_USERS / ADMIN_ONLY。デフォルト ADMIN_ONLY |
| createdAt            | DateTime | |
| updatedAt            | DateTime | |
| botInstanceSettings  | JsonB | インスタンスごとの自動接続設定 |

## UserVoiceSetting

ユーザー単位の音声設定 (全サーバー共通)。

| カラム | 型 | 備考 |
|---|---|---|
| userId | String @id | |
| speakerId | Int? | |
| speedScale | Float | デフォルト 1.0 |
| pitchScale | Float | デフォルト 0.0 |

## GlobalDictionary

| カラム | 型 | 備考 |
|---|---|---|
| word | String @unique | |
| reading | String | |
| registeredBy | String | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

## GlobalDictionaryRequest

| カラム | 型 | 備考 |
|---|---|---|
| id | String @id @default(cuid()) | |
| word | String | |
| reading | String | |
| reason | String? | |
| requestedBy | String | |
| guildId | String | 申請元サーバー |
| status | Enum | PENDING / APPROVED / REJECTED |
| createdAt | DateTime | |
| updatedAt | DateTime | |

## ServerDictionary

| カラム | 型 | 備考 |
|---|---|---|
| guildId | String | |
| word | String | |
| reading | String | |
| registeredBy | String | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

@@unique([guildId, word])

## Subscription

| カラム | 型 | 備考 |
|---|---|---|
| userId | String | |
| stripeCustomerId | String | |
| stripeSubscriptionId | String @unique | |
| status | Enum | ACTIVE / PAST_DUE / CANCELED / INCOMPLETE |
| currentPeriodEnd | DateTime | |
| boostCount | Int | 購入ブースト枠数 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

主キーは `@@id([userId, stripeSubscriptionId])`。

## Boost

| カラム | 型 | 備考 |
|---|---|---|
| id | String @id @default(cuid()) | |
| subscriptionId | String | `Subscription.stripeSubscriptionId` への FK |
| guildId | String? | 割り当て先 (null=未割り当て) |
| assignedAt | DateTime? | |
| unassignedAt | DateTime? | クールダウン計算用 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

## BoostRevocation

強制失効した boost の監査ログ。

| カラム | 型 | 備考 |
|---|---|---|
| id | String @id @default(cuid()) | |
| boostId | String | 元の Boost ID |
| subscriptionId | String | 対象サブスクリプション |
| guildId | String? | 解除元ギルド |
| assignedAt | DateTime? | 元の割り当て日時 |
| revokedAt | DateTime | 失効日時 |
| reason | String | 失効理由 |

## PREMIUM 判定ロジック

サーバーが PREMIUM である条件:
- `GuildSettings.manualPremium === true`、または
- そのサーバーに有効なブースト (active な Subscription に紐づき、guildId が割り当てられている Boost) が1つ以上ある

いずれも満たさない場合は FREE。

## Announcement

運営からユーザーへ公開するお知らせ。`published = true` かつ `publishedAt <= 現在時刻` のレコードだけを公開 API から返す。

| カラム | 型 | 備考 |
|---|---|---|
| id | String | CUID の主キー |
| title | String | 最大120文字 |
| body | String | Markdown原文、最大20,000文字。表示時にHTMLと画像を無効化 |
| type | String | `info` / `update` / `maintenance` / `important` |
| published | Boolean | 公開状態。デフォルト false |
| publishedAt | DateTime? | 公開日時。未来日時で予約公開可能 |
| createdAt | DateTime | 作成日時 |
| updatedAt | DateTime | 更新日時 |

## Prisma 7 接続設定

Prisma CLI / Client / PostgreSQL adapter は同じ `7.10.1` を使う。スキーマの接続URLは `apps/bot/prisma.config.ts` に移し、Bot/APIの実行時は設定モジュールの `DATABASE_URL` を `PrismaPg` に渡す。テーブル、カラム、既存migrationは変更しない。

`databaseConnectionConfig` は既存URLの `connection_limit`（Bot 3 / API 5）と `schema` を引き継ぐ。`connect_timeout` は接続確立の上限（既定5秒）、`pool_timeout` はプール待機の上限（既定10秒）として独立に読む。`pool_timeout` 省略時に `connect_timeout` を流用しない。pgのPoolには `pool_timeout` を、Poolが生成するClientには専用のClientクラスを通じて `connect_timeout` を設定する。どちらも0はそのタイマーを無効化する。アイドル寿命は既定300秒、接続寿命は既定無制限。URLに接続数指定がない場合はpgの既定10接続となる。TLSオプションは接続文字列に残す。

`TEST_DATABASE_URL` にローカルの専用DB `sumirevox_upgrade_test` を指定して `node scripts/check-prisma-compatibility.mjs` を実行すると、新規のランダムスキーマ内だけで既存migration、JSON/日時/リレーション、トランザクションと既知例外を検証する。既存DBや本番の認証情報は利用しない。

### タイムアウトの互換性と制約

Prisma 6のRust connectorは接続確立とプール取得に別のタイマーを持つ。Prisma 7の `PrismaPg` はpgのPool設定をそのまま利用し、pg自体の既定値は両方とも0（上限なし）。このアプリでは旧Prismaの既定5秒/10秒を明示する。

pg 8.23.1のPoolの `connectionTimeoutMillis` はキュー待機だけでなく、新規Client接続中にも適用される。そのため接続確立は、有効な `connect_timeout` と `pool_timeout` の短い方に制限される。例: connect=7/pool=2なら接続も最大2秒、connect=0/pool=10なら接続も最大10秒。pool=0/connect=5ならキュー待機は無制限、接続確立は5秒。両方0の場合だけ両方無制限。キュー待機から接続生成へ移る際のタイマーはpgの方式に従い、旧Prismaと完全な時間互換性は保証しない。独自キューやタイムアウト後も接続を取得し続けるPromise競争は導入せず、pgの解放処理を使用する。

時間は秒単位の非負整数のみ許可する。空文字、小数、負数、非数値、安全な整数を超える値、Node.jsのタイマー上限（2,147,483,647ms）を超える秒数は起動時にエラーとする。エラーにはオプション名だけを含め、接続URLや認証情報を含めない。不正なURLも認証情報を含まないエラーに変換する。schema、connection_limit、TLS URLパラメータの既存の扱いは維持する。

根拠:

- [Prisma 6 PostgreSQL URL設定](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql#connection-details)
- [Prisma 6.19 connector実装](https://github.com/prisma/prisma-engines/blob/6.19.0/quaint/src/connector/postgres/url.rs)
- [Prisma 7 driver adapterのプール設定](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool)
- [node-postgres Pool API](https://node-postgres.com/apis/pool)、[pg 8.23.1 Pool実装](https://github.com/brianc/node-postgres/blob/pg%408.23.1/packages/pg-pool/index.js)

`check-prisma-compatibility.mjs` は同じ隔離DBでpg/PrismaPgのプール枯渇、待機タイムアウト後の再取得、接続確立タイムアウトを検証する。接続確立の検証には、PostgreSQLのハンドシェイクに応答しないローカルTCPサーバーを使用する。本番DBや外部ネットワークは使用しない。
