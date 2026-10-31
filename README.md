# まぐろ、海へ。 — MAGURO ESCAPE

Meta Instant Games 向けの、マグロ脱出パズル。1〜3マスの長さのマグロが混在し、体のどこをタップしても頭の方向へ直進します。進路に別のマグロの体やしっぽがあると移動できません。順番を考えて、全員を盤面の外へ送り出すとクリアです。

## 開発

Node.js 20 以上、ビルド用に Python 3 が必要です。外部パッケージのインストールは不要です。

```sh
npm run dev     # ポート3000で起動（PORTで変更可）
npm test        # 16ステージの解法・衝突判定を検証
npm run build   # dist/ と maguro-escape.zip を生成
```

HTML / CSS / JavaScript（ES Modules）で構成し、画像・フォント・ゲームエンジンへの外部依存はありません。スマートフォン・PC、タッチ・キーボード操作に対応しています。

## 遊べる機能

- 1・2・3マスのマグロを混ぜた、必ず解ける16ステージ。クリアすると次のステージが開放されます。
- ヒント、1手戻す、やり直し、任意のクリア済みステージへの移動。
- 進行状況・サウンド設定をローカル保存。ストレージが使えない場合もプレイ可能です。
- 効果音（初期はオフ）、モーション軽減設定への対応。

## Meta Instant Games へのアップロード

1. `npm test` と `npm run build` を実行します。
2. Meta for Developers で Instant Games を利用できるアプリを用意し、Web ホスティングのビルドアップロード画面に `maguro-escape.zip` をアップロードします。ZIP 直下には `index.html` と `fbapp-config.json` が入っています。
3. 開発ビルドを Meta のテスト環境で起動して動作確認します。公開には、アプリの設定、画像素材、プライバシーポリシー、Meta 側の必要な審査などを別途完了してください。管理画面の項目名・利用要件は Meta の現行仕様を確認してください。

Meta ホスト環境では公式 SDK `https://connect.facebook.net/en_US/fbinstant.7.1.js` を読み込み、`initializeAsync` → `setLoadingProgress(100)` → `startGameAsync` の順で開始します。SDK が使えない通常の Web 環境では Web 版として動作します。localhost では SDK を読み込みません。Meta 実機での起動・公開は別途検証が必要です。

広告・課金・ランキング・プレイヤー情報の取得は未実装です。進行状況は端末内保存で、Meta アカウント間の同期は行いません。アプリIDやアクセストークンをソースに書き込む必要はありません。

## アップロードの自動化

クラウドの設定画面を使わない場合は、`npm run build` で生成される `maguro-upload-kit.zip` を手元で展開し、`python3 upload.py`（Windows は `py -3 upload.py`）を実行できます。App ID と App Secret を対話入力する方式で、App Secret は非表示、認証情報はファイルへ保存しません。詳しくはキットの README を参照してください。

`npm run upload` でテスト → ZIP 作成 → Meta Hosting API への送信をまとめて実行できます。curl が必要です。認証情報がない場合は送信前に停止します。

環境設定で以下を用意してください。トークンはチャットやソースコードに書かず、シークレットとして保存してください。

- `META_APP_ID`: Instant Games の Meta アプリ ID（数値）。
- `META_UPLOAD_TOKEN`: 対象アプリの App Access Token、またはアップロード用アクセストークン。App Secret 自体をそのまま設定するものではありません。
- ネットワーク許可: `graph-video.facebook.com`。

任意で `META_GRAPH_VERSION`（`vXX.X` 形式、未指定時はアプリ既定の API バージョン）と `META_BUILD_COMMENT` を設定できます。

App ID と App Secret がある場合、Meta がサポートする `APP_ID|APP_SECRET` 形式の App Access Token を使えます。縦棒 `|` は半角で、前後に空白を入れません。実際の値は環境設定の `META_UPLOAD_TOKEN` シークレットに保存し、ソースコード・フロントエンド・チャット・コマンド引数へ書かないでください。スクリプトはこの形式もそのまま Authorization ヘッダーで送信します。別途 `META_APP_ID` には数値の App ID を設定します。

[Meta: App Access Tokens](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens#apptokens)

スクリプトは `POST https://graph-video.facebook.com/{app-id}/assets` に `type=BUNDLE` と ZIP を送信します。トークンは標準入力経由の Authorization ヘッダーで渡し、URL・コマンド引数・ログへ出力しません。アップロード後の処理完了、テスト用ビルドの選択、公開・審査は別途確認が必要です。

API リクエスト・エラー処理はモックテスト済みですが、実際の Meta アプリへのアップロードは認証情報の設定後に検証が必要です。API の利用可否・権限・現行仕様は対象アプリで確認してください。

## 構成

- `src/puzzle.js`: 頭を基準とした体の占有マス・進路判定と決定的なステージ生成。体の重なりを避け、後から配置した魚から順に脱出できる逆生成方式。
- `src/main.js`: 画面操作、アニメーション、保存、オーディオ、Meta SDK 接続。
- `src/style.css`: レスポンシブ画面。
- `scripts/`: 依存パッケージ不要の開発サーバーと ZIP ビルド。
