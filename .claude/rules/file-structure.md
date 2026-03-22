# ファイル分割・レイヤー規約

## レイヤー構成

依存方向: `commands → services → infrastructure`。逆方向禁止。同一レイヤー内の横方向依存は許可。

### commands 層
- スラッシュコマンドハンドラ + View インタラクションハンドラ
- ユーザー入力の受け取りと応答の組み立てのみ
- ビジネスロジックは services 層に委譲

### services 層
- ビジネスロジック (テキスト前処理、音声合成、キュー管理、辞書管理、設定管理)
- infrastructure 層を組み合わせてユースケースを実現

### infrastructure 層
- 外部システムとの通信の薄いラッパー (Prisma, Redis, VOICEVOX API, Discord API)

### shared (packages/shared/)
- 型定義、定数、ユーティリティ。全レイヤーから参照可能

## ファイル分割

- 1ファイル1エクスポート
- ファイル名 = エクスポート名の kebab-case (例: `createAudioResource` → `create-audio-resource.ts`)
