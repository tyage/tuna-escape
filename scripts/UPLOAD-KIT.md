# まぐろ、海へ。アップロードキット

環境設定の画面を使わず、手元のターミナルからアップロードするためのキットです。Python 3 が必要です。追加パッケージは不要です。

## envファイルでアップロード

ZIPを展開し、`upload.py`、`maguro-escape.zip`、既存の `metagame.env` を同じフォルダーに置いて実行します。

```sh
python3 upload.py --env-file metagame.env
```

Windowsでは `py -3 upload.py --env-file metagame.env` を使います。ファイル内の `APP_ID` と `APP_SECRET` を読みます。値は表示せず、シェルとして実行しません。

## 対話入力でアップロード

1. この ZIP を展開します。`upload.py` と `maguro-escape.zip` は同じフォルダーに置いてください。
2. ターミナルでそのフォルダーに移動します。
3. macOS/Linux は `python3 upload.py`、Windows は `py -3 upload.py` を実行します。
4. App ID、続いて App Secret を入力します。App Secret は貼り付けても表示されません。入力後に Enter を押してください。

App ID と App Secret から `APP_ID|APP_SECRET` 形式の App Access Token をメモリー上で構成し、Meta の Hosting API に送信します。認証情報はファイルへ保存せず、URL・コマンド引数・ログにも出力しません。公開リポジトリや共有ファイルに実際の値を書かないでください。

`python3 upload.py --check`（Windows は `py -3 upload.py --check`）で、認証情報を入力せずゲーム ZIP の整合性だけ確認できます。

`--env-file metagame.env --check` では、送信せずにZIPの整合性と認証ファイルの形式を確認できます。トークンの有効性は確認しません。

アップロードの受理は、処理完了や一般公開とは別です。Meta 管理画面でビルド状態を確認してください。アップロードには、対象アプリの利用資格と権限が必要です。
