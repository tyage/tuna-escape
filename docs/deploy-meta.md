# Meta Instant Gamesへのデプロイ

## ビルド

```sh
npm test
npm run build
```

`maguro-escape.zip` の直下に `index.html` と `fbapp-config.json` が含まれます。Metaの対象アプリのWebホスティングにアップロードし、処理完了後にテストビルドを起動してください。アップロードと一般公開は別の操作です。

## APIでアップロード

curlをインストールし、以下を環境変数で設定します。

| 変数 | 内容 |
| --- | --- |
| `META_APP_ID` | 対象アプリの数値ID |
| `META_UPLOAD_TOKEN` | 対象アプリのApp Access Tokenまたはアップロード用トークン |
| `META_GRAPH_VERSION` | 任意。`vXX.X` 形式のAPIバージョン。未指定時はアプリ既定 |
| `META_BUILD_COMMENT` | 任意。ビルドの説明 |

```sh
npm run upload
```

`APP_ID` と `APP_SECRET`（または `META_APP_ID` と `META_APP_SECRET`）を設定する方式も使えます。`APP_ID|APP_SECRET` 形式のApp Access Tokenをメモリー上で組み立てます。`META_UPLOAD_TOKEN` がある場合はそちらを優先します。

既存のenvファイルを使う場合は、Node.js 20.6以上で次を実行できます。

```sh
npm run build
node --env-file=/path/to/credentials.env scripts/upload.mjs
```

認証情報をソース・公開リポジトリ・ログへ含めないでください。`.env`、`.env.*`、`*.env` はGitの追跡対象から除外しています。

APIの送信先は `https://graph-video.facebook.com/{app-id}/assets` です。HTTPSの通信許可が必要です。`CONNECT 403` は中継サーバーによる接続拒否を示し、その時点ではMeta APIの認証は実行されていません。

[Meta: App Access Tokens](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens#apptokens)

## 対話入力でアップロード

ビルドで生成される `maguro-upload-kit.zip` を展開し、同梱のREADMEに従って `python3 upload.py`（Windowsは `py -3 upload.py`）を実行します。App Secretは非表示入力で、ファイルには保存しません。

## 実行時の動作

Meta上ではSDKの初期化後にゲームを開始します。localhostではSDKを使わず、その他のWeb環境でもSDKが使えなければWeb版として起動します。

進行状況は端末内保存です。アカウント間の同期、広告、課金、ランキングは実装していません。
