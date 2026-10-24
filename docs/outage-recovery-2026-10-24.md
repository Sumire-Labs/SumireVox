# 2026-10-24 停止障害と復旧手順

## 原因とリポジトリの対応

調査報告書では、BotはUndici 8.12.3のHTTP/2応答ヘッダー変換で起動に失敗していた。Discord関連だけを要求範囲内のUndici 6.29.1へ固定する。詳細は [依存更新記録](dependency-upgrade-2026-10-24.md#2026-10-24-discord起動障害の修正) を参照。

別の障害として、本番Nginxは静的な `upstream api { server api:3000; }` を読み込み、API再作成前のIPを保持していた。リポジトリの `nginx/nginx.prod.conf` と `nginx/nginx.conf` は既に `resolver 127.0.0.11 valid=10s` と変数を使った `proxy_pass` に対応している。本番の旧設定を最新ファイルへ反映する必要があり、Bot/APIのイメージ更新だけではホストからマウントした設定は更新されない。

動的名前解決は [Nginx公式仕様](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass) に従う。URI・クエリ文字列は `$request_uri` で保持し、Webhookの本文・署名ヘッダーも転送する。DNSキャッシュの失効と再接続まで、一時的な失敗は発生し得る。

## 再発防止の自動検証

リポジトリルートで `node scripts/check-nginx-routing.mjs` を実行する。Dockerが必要。通常版・本番版それぞれの実ファイルをマウントし、`nginx -t`、API転送、URI・クエリ、Webhookの本文・署名ヘッダー、通常版のWeb/Admin転送を確認する。APIだけを異なるIPへ再作成し、Nginxの再起動・再読み込みなしで30秒以内に復帰することを確認する。

検証には専用の一時ネットワーク・コンテナ・loopback公開のランダムポートを使う。既存Composeや.envは読み込まず、終了時に作成したコンテナとネットワークを削除する。CIでも実行し、失敗時はBot/APIイメージの公開を止める。

IPはDockerの自動割り当てを使用する。旧APIがネットワークに接続している間に同じ `api` エイリアスの置換先を起動し、inspectで新旧のIPが異なることを確認してから旧APIを削除する。置換中はAPIへの検証リクエストを送らず、削除後に置換先だけへ転送されることを確認する。自動サブネットに対する `--ip` 指定は一部のDocker Engineで拒否されるため使用しない。固定サブネットの追加や既存ネットワークの変更も不要となる。

## 本番反映の手順（本作業では未実施）

以下は運用担当者が本番反映を行う際の手順。本作業ではSSH・push・公開・再起動を行わない。

1. 本番で実際に使用しているComposeファイル、プロジェクト名、overrideファイルを確認する。以降のコマンド例は `/opt/sumirevox` で `docker-compose.prod.yml` のみを使う構成を示す。稼働中の構成が異なる場合は同じComposeオプションに揃える。
2. 現在のBot/APIイメージのタグ・digestとNginx設定を保存する。旧イメージがレジストリから再取得できることを確認する。Watchtowerが旧版へ戻したコンテナを直ちに更新しないよう、反映・切り戻し中の自動更新を運用側で制御する。VOICEVOXのdigest固定・除外やDB/Redisの設定は維持する。
3. 修正済みコミットのBot/APIイメージを通常の公開手順で取得し、対象サービスだけに反映する。全Composeの一括更新やDBリセットは行わない。この修正にDBスキーマ・migrationの追加はない。
4. `docker inspect` の `Mounts` で、Nginxの `/etc/nginx/nginx.conf` が実際にどのホストファイルを参照しているか確認する。報告書の構成では `/opt/sumirevox/nginx/nginx.prod.conf`。バックアップ後、このファイルへリポジトリの本番設定を反映する。通常版の `conf.d/default.conf` 用設定と混同しない。
5. ホスト側だけでなく `docker compose -f docker-compose.prod.yml exec -T nginx nginx -T` の出力で動的resolverと変数の `proxy_pass` が読み込まれることを確認する。出力に機密設定が含まれ得るため、そのまま共有しない。
6. 構文が正しい場合のみ再読み込みする。

```bash
docker compose -f docker-compose.prod.yml exec -T nginx nginx -t
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
```

ファイルを置換した結果、単一ファイルのbind mountが古いinodeを保持している場合は、reloadだけでは新設定が反映されない。新設定を一時Nginxコンテナで検証したうえで、Nginxだけを再作成する。

```bash
docker run --rm --network none \
  --mount type=bind,src=/opt/sumirevox/nginx/nginx.prod.conf,dst=/etc/nginx/nginx.conf,readonly \
  nginx:alpine nginx -t
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate nginx
docker compose -f docker-compose.prod.yml exec -T nginx nginx -t
```

## 復旧確認と切り戻し（本作業では未実施）

- 4つのBotすべてがreadyに到達し、少なくとも5分間は再起動回数が増えず、同じヘッダー変換エラーが発生しないことを確認する。テスト用サーバーでVC参加と日本語の読み上げも確認する。
- NginxコンテナからAPIの `/health` と、ホスト側の `curl --fail --max-time 5 http://127.0.0.1:8080/health` の両方で200と `{"status":"ok"}` を確認する。外部ドメイン経由でも同じ結果を確認する。
- ステージングでAPIを異なるIPへ再作成し、Nginxをreloadせずに30秒以内に回復することを確認する。本番で検証する場合は別途停止時間を調整する。
- 復旧しない場合は、保存した既知の正常なBot/APIイメージと設定へ戻す。今回の停止を起こしたUndici 8.12.3のイメージは復旧用の正常版として扱わない。Nginxの旧静的設定を戻す場合も、その時点のAPI IPを使うため再読み込みが必要で、動的追従の恒久対応は引き続き必要となる。

## この修正で実施した検証

- Node.js 24.22.1 / pnpm 9.15.9でfrozen install、Prisma生成、全289テスト、全workspaceのビルドが成功。本番依存監査は既知の脆弱性0件。
- Undici 8.12.3を含む修正前のBotイメージで、外部ネットワークを無効にしたTLS回帰テストが報告書と同じ例外を再現。修正後の通常版・本番版Botイメージでは同じ検証が成功。
- Bot/API × 通常版・本番版の4イメージをローカルでビルドし、Node.js 24.22.1 / pnpm 9.15.9とruntime検証の成功を確認。
- Nginxの通常版・本番版で構文、API/Auth/Web/Adminの対応ルート、URI・クエリ、Webhookの本文バイト列・署名ヘッダーの転送が成功。APIを異なるIPに変更した後も、同じNginxコンテナのまま30秒以内に復帰した。作成したテストコンテナ・ネットワークは削除済み。
- Workflow YAMLの構文、Nginx変更時の実行条件、Nginx検証失敗時の公開停止条件、スクリプトの構文、差分の空白検証が成功。GitHub Actions上での実行は未実施。
- 本番4 Botのready到達・再起動回数の安定・読み上げと、本番Nginx経由のヘルス応答は未実施。上記の運用手順で確認する。

### CIのDockerネットワーク互換性修正

初回のGitHub Actions実行では、自動サブネット上の `--ip` 指定が拒否されて失敗した。固定IP指定を削除し、新旧APIの同時接続によって異なるIPを自動割り当てする方式へ修正した。

- Node.js 24.22.1と隔離Docker Engine 27.5.1で、修正前にCIと同じエラー（終了コード125）が再現し、修正後は通常版・本番版ともに成功した。
- Docker Engine 29.8.0でも通常版・本番版の検証が成功した。両環境で実際の新旧IPの相違、Nginxを再読み込みしない30秒以内の復帰、URI・クエリ・Webhook本文・署名ヘッダー保持を確認した。
- 修正後のGitHub Actions再実行は未実施。
