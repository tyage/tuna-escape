# Meta Instant Gamesへのデプロイ

GitHub Actionsの「CI and Meta deploy」で、テスト・ビルド・アップロード・本番切替を実行します。

- PRではテストとビルドを実行します。
- `main`へのpushでは、検証したゲームZIPをアップロードし、その応答の `bundle_instance_id` を自動的に本番切替APIへ渡します。
- 再実行する場合は、Actionsから `main` を選んで「Run workflow」を実行します。ビルドIDの入力は不要です。

本番切替の成功応答を確認できなければ、Actionsは失敗になります。ビルドコメントにはコミットSHAが入り、ゲームZIPはActionsの成果物として14日間保存されます。

## 認証

リポジトリのActions Secretsを使います。値をソースやworkflowファイルへ記載しないでください。

| Secret | 用途 |
| --- | --- |
| `META_APP_ID` | 対象MetaアプリのApp ID |
| `META_APP_SECRET` | Meta OAuthでApp Access Tokenを発行するためのApp Secret |
| `META_UPLOAD_TOKEN` | 対象アプリの管理者・開発者のUser Access Token、またはアプリの管理権限を持つSystem User Token |

既存のApp IDとApp Secretから、`graph.facebook.com/oauth/access_token` の `client_credentials` で正式なApp Access Tokenを発行します。App Secret自体をアップロード用トークンとして送りません。Secretと発行したトークンはログ・URL・コマンド引数・ファイルに出力しません。取得済みのApp Access Tokenを使う場合は `META_APP_ACCESS_TOKEN` 環境変数でも指定できます。

## APIの流れ

[Meta公式のアップロード手順](https://developers.facebook.com/documentation/games/launch/upload-bundle)に従います。

1. App IDとApp SecretからApp Access Tokenを発行します（既存トークンを指定した場合は省略）。
2. `graph.facebook.com/v24.0/{app-id}/uploads` でアップロードセッションを取得します。
3. `rupload.facebook.com` へZIPを送信します。GGトークンは `gg_graph_api`、EAAトークンは `fb_game_bundle` を使います。
4. 応答のビルドIDを文字列として保持し、`api.facebook.com/instant-games/assets/{app-id}/push-to-production` に送信します。本番切替APIでは `GG|{app-id}|...` の先頭の `GG|` を外します。

アップロードでIDが取得できなければ、本番切替を停止します。切替時にMetaが処理中または汎用の処理失敗を返す場合は、同じIDに対して最大6回、20秒間隔で再試行します。成功応答の後、実際の配信への反映には数分かかる場合があります。

## ローカルビルド

Node.js 20以上、Python 3が必要です。外部パッケージのインストールは不要です。

```sh
npm test
npm run build
```

Web配信用ファイルは `dist/`、Metaへのアップロード用は `tuna-escape.zip` です。ZIPの直下に `index.html` と `fbapp-config.json` が含まれます。

## 実行時の動作

Meta上ではSDKの初期化後にゲームを開始します。localhostではSDKを使わず、その他のWeb環境でもSDKが使えなければWeb版として起動します。

進行状況は端末内保存です。アカウント間の同期、課金、ランキングは実装していません。
