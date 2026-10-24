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

`databaseConnectionConfig` は既存URLの `connection_limit`（Bot 3 / API 5）と `schema` を引き継ぐ。pgの単一接続待機タイムアウトへ `pool_timeout`（指定時）、それ以外は `connect_timeout`（既定5秒）を適用する。アイドル寿命は既定300秒、接続寿命は既定無制限。URLに接続数指定がない場合はpgの既定10接続となる。TLSオプションは接続文字列に残す。

`TEST_DATABASE_URL` にローカルの専用DB `sumirevox_upgrade_test` を指定して `node scripts/check-prisma-compatibility.mjs` を実行すると、新規のランダムスキーマ内だけで既存migration、JSON/日時/リレーション、トランザクションと既知例外を検証する。既存DBや本番の認証情報は利用しない。
