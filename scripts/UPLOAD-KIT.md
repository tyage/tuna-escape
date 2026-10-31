# まぐろ、海へ。アップロードキット

環境設定の画面を使わず、手元のターミナルからアップロードするためのキットです。Python 3 が必要です。追加パッケージは不要です。

1. この ZIP を展開します。`upload.py` と `maguro-escape.zip` は同じフォルダーに置いてください。
2. ターミナルでそのフォルダーに移動します。
3. macOS/Linux は `python3 upload.py`、Windows は `py -3 upload.py` を実行します。
4. App ID、続いて App Secret を入力します。App Secret は貼り付けても表示されません。入力後に Enter を押してください。

App ID と App Secret から `APP_ID|APP_SECRET` 形式の App Access Token をメモリー上で構成し、Meta の Hosting API に送信します。認証情報はファイルへ保存せず、URL・コマンド引数・ログにも出力しません。ChatGPT やリポジトリに実際の値を書かないでください。

`python3 upload.py --check`（Windows は `py -3 upload.py --check`）で、認証情報を入力せずゲーム ZIP の整合性だけ確認できます。

アップロードの受理は、処理完了や一般公開とは別です。Meta 管理画面でビルド状態を確認してください。実際の Meta アプリでの認証・アップロードは、アプリの利用資格と権限が必要です。このキットでは実際の認証情報を使った送信は未検証です。
