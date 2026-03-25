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
| id | Int @id @default(autoincrement()) | |
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
| id | Int @id @default(autoincrement()) | |
| userId | String | |
| stripeCustomerId | String | |
| stripeSubscriptionId | String @unique | |
| status | Enum | ACTIVE / PAST_DUE / CANCELED / INCOMPLETE |
| currentPeriodEnd | DateTime | |
| boostCount | Int | 購入ブースト枠数 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

## Boost

| カラム | 型 | 備考 |
|---|---|---|
| id | Int @id @default(autoincrement()) | |
| subscriptionId | Int | Subscription への FK |
| guildId | String? | 割り当て先 (null=未割り当て) |
| assignedAt | DateTime? | |
| unassignedAt | DateTime? | クールダウン計算用 |
| createdAt | DateTime | |

## PREMIUM 判定ロジック

サーバーが PREMIUM である条件:
- `GuildSettings.manualPremium === true`、または
- そのサーバーに有効なブースト (active な Subscription に紐づき、guildId が割り当てられている Boost) が1つ以上ある

いずれも満たさない場合は FREE。
