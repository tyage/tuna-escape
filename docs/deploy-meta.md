# Meta Instant Gamesへのデプロイ

GitHub Actionsの「CI and Meta upload」でテスト・ビルド・アップロードを行います。

- PRでは `npm test` と `npm run build` を実行します。
- `main`へのpushでは、検証したゲームZIPをMetaへアップロードします。
- 手動で実行する場合は、Actionsから `main` を選んで「Run workflow」を実行します。

ビルドコメントには対象コミットのSHAが入り、ゲームZIPはActionsの成果物として14日間保存されます。

## 認証

既存のリポジトリActions Secrets `META_APP_ID` と `META_APP_SECRET` を使います。値をソースやworkflowファイルへ記載しないでください。Secretsが参照できない場合、アップロードジョブはエラーになります。

送信先は `https://graph-video.facebook.com/{app-id}/assets` です。`scripts/upload.mjs` がApp Access Tokenをメモリー上で構成し、ログやコマンド引数へ出さずに送信します。

## ステージング

このworkflowはアップロードまでを自動化しています。MetaのWebホスティング画面で対象コミットのビルドをステージングへ切り替え、起動・言語表示・操作を確認してください。Actionsの成功だけではステージングへの反映は確認できません。

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
