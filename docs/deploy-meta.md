# Meta Instant Gamesへのデプロイ

GitHub Actionsの「CI and Meta upload」でテスト・ビルド・アップロードを行います。

- PRでは `npm test` と `npm run build` を実行します。
- `main`へのpushでは、検証したゲームZIPをMetaへアップロードします。
- 手動で実行する場合は、Actionsから `main` を選んで「Run workflow」を実行します。

ビルドコメントには対象コミットのSHAが入り、ゲームZIPはActionsの成果物として14日間保存されます。

## 認証

既存のリポジトリActions Secrets `META_APP_ID` と `META_APP_SECRET` を使います。値をソースやworkflowファイルへ記載しないでください。Secretsが参照できない場合、アップロードジョブはエラーになります。

送信先は `https://graph-video.facebook.com/{app-id}/assets` です。`scripts/upload.mjs` がApp Access Tokenをメモリー上で構成し、ログやコマンド引数へ出さずに送信します。

## 本番切り替え

アップロードと本番切り替えは別の操作です。Actionsの「CI and Meta upload」で `main` を選び、手動実行の `bundle_instance_id` にMeta上の対象ビルドIDを指定すると、その既存ビルドを本番へ切り替えます。この場合、重複アップロードはしません。表示用のバージョン番号やコミットSHAではなく、`bundle_instance_id` を指定してください。

既存のApp IDとApp Secretを使い、[Meta公式の本番切替API](https://developers.facebook.com/documentation/games/launch/upload-bundle) `POST https://api.facebook.com/instant-games/assets/{app-id}/push-to-production` に送信します。本番切替要求が受理された後、配信版の起動・言語表示・操作を確認してください。

ローカルから実行する場合：

```sh
node --env-file=/path/to/credentials.env scripts/upload.mjs --promote BUNDLE_INSTANCE_ID
```

現在の旧アップロードAPIはビルドIDを返しません。IDを得られる公式の新アップロードAPIは、アプリの管理者・開発者権限を持つUserまたはSystem User Access Tokenを要求し、App IDとApp Secretだけの認証ではバイナリ送信が拒否されました。そのため、現状のpush時の自動処理はアップロードまでで、本番切替は対象ビルドIDを指定して実行します。

## ローカルビルド

Node.js 20以上、Python 3が必要です。外部パッケージのインストールは不要です。

```sh
npm test
npm run build
```

Web配信用ファイルは `dist/`、Metaへのアップロード用は `maguro-escape.zip` です。ZIPの直下に `index.html` と `fbapp-config.json` が含まれます。

## 実行時の動作

Meta上ではSDKの初期化後にゲームを開始します。localhostではSDKを使わず、その他のWeb環境でもSDKが使えなければWeb版として起動します。

進行状況は端末内保存です。アカウント間の同期、課金、ランキングは実装していません。
