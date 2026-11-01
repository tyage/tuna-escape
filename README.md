# まぐろ、海へ。 — TUNA ESCAPE

1〜3マスのマグロを、頭の向きへ直進させて海へ送り出すパズルゲーム。仲間の体やしっぽが進路をふさいでいると移動できません。

全16ステージ。ヒント、1手戻す、やり直し、進行状況の端末内保存に対応しています。スマートフォンでもPCでも遊べます。

日本語・英語に対応しています。Metaの言語設定、Web版ではブラウザの言語設定から自動選択し、その他の言語では英語を表示します。画面上部の言語ボタンで切り替えると、その選択を端末内に保存します。進行状況は引き継がれます。

## 開発

Node.js 20以上、ビルドにはPython 3が必要です。外部パッケージのインストールは不要です。

```sh
npm run dev     # 開発サーバー（ポート3000、PORTで変更可）
npm test        # パズル・翻訳・アップロード処理のテスト
npm run build   # 配布用ファイルとZIPを生成
```

## 配布

`dist/` がWeb配信用、`maguro-escape.zip` がMeta Instant Gamesへのアップロード用です。

[Meta Instant Gamesへのデプロイ手順](docs/deploy-meta.md)

GitHub ActionsでPR・`main`へのpush時にテストとビルドを実行します。`main`では既存のActions Secretsを使い、検証済みZIPをMetaへアップロードします。本番切替はActionsの手動実行で `bundle_instance_id` を指定します。
