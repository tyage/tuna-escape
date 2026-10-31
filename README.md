# まぐろ、海へ。 — MAGURO ESCAPE

1〜3マスのマグロを、頭の向きへ直進させて海へ送り出すパズルゲーム。仲間の体やしっぽが進路をふさいでいると移動できません。

全16ステージ。ヒント、1手戻す、やり直し、進行状況の端末内保存に対応しています。スマートフォンでもPCでも遊べます。

## 開発

Node.js 20以上、ビルドにはPython 3が必要です。外部パッケージのインストールは不要です。

```sh
npm run dev     # 開発サーバー（ポート3000、PORTで変更可）
npm test        # パズル・アップロード処理のテスト
npm run build   # 配布用ファイルとZIPを生成
```

Python製アップローダーのテスト：

```sh
python3 -m unittest discover -s tests -p 'upload_kit_test.py'
```

## 配布

`dist/` がWeb配信用、`maguro-escape.zip` がMeta Instant Gamesへのアップロード用です。

[Meta Instant Gamesへのデプロイ手順](docs/deploy-meta.md)
