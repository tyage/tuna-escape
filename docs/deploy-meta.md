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

## GitHub Actions

`.github/workflows/ci-meta.yml` はPR・`main`へのpushでNode.jsとPythonのテスト、翻訳の検証、ビルドを実行し、ゲームZIPとアップロードキットを14日間保存します。外部パッケージのインストールは不要です。

`main`へのpush、または `main`を選んだ手動実行では、同じ実行内で検証したZIPをダウンロードしてMetaへ送信します。PRからのアップロードは行いません。ビルドコメントには対象コミットのSHAを記録します。

初回のみ、GitHubのリポジトリ設定 → Secrets and variables → Actions に次のリポジトリSecretsを設定してください。実際の値をソースやworkflowファイルへ記載しないでください。

| Secret | 内容 |
| --- | --- |
| `META_APP_ID` | 対象MetaアプリのApp ID |
| `META_APP_SECRET` | 同じアプリのApp Secret |

Secretsが未設定の場合、テスト・ビルドは実行され、アップロードジョブは設定不足を明示して失敗します。設定後はActionsの「CI and Meta upload」から `main`を選んで再実行できます。

このworkflowが自動化するのはアップロードの受理までです。デプロイ完了には、MetaのWebホスティング画面で対象コミットのビルドをステージングへ切り替え、起動・言語表示・操作を確認する必要があります。workflowの成功をステージング反映の証拠にはしないでください。

## 対話入力でアップロード

ビルドで生成される `maguro-upload-kit.zip` を展開し、同梱のREADMEに従って `python3 upload.py`（Windowsは `py -3 upload.py`）を実行します。App Secretは非表示入力で、ファイルには保存しません。

既存の認証ファイルを使う場合は `python3 upload.py --env-file /path/to/credentials.env` で、入力を省略できます。

## 実行時の動作

Meta上ではSDKの初期化後にゲームを開始します。localhostではSDKを使わず、その他のWeb環境でもSDKが使えなければWeb版として起動します。

進行状況は端末内保存です。アカウント間の同期、広告、課金、ランキングは実装していません。
