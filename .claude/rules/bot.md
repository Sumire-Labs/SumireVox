---
paths:
  - "apps/bot/**"
---

# Bot 固有ルール

## エントリポイント

ShardingManager がエントリポイント。子プロセスとしてシャードを spawn。

## View コンポーネント

- Collector ではなく `client.on('interactionCreate')` の永続ハンドラ方式
- customId 構造: `コマンド名:操作:ユーザーID:タイムスタンプ`
- 有効期限15分。期限切れは Ephemeral で通知
- customId 内のユーザーID以外が操作したら拒否

## コマンドエラー

- 全て Ephemeral メッセージで通知

## ログ

- pino JSON 構造化ログ。`LOG_LEVEL` で制御
- 開発環境 (`NODE_ENV=development`) は pino-pretty
- メモリ使用量の監視ログを定期出力

## Redis Pub/Sub チャンネル

- 設定変更、辞書更新、ユーザー音声設定変更のイベント
- 辞書更新はトライ木の無効化フラグのみ。再構築は遅延実行

## セッション復元

- シャード再起動時に Redis から前回の VC 接続情報を読み取り自動再参加
