# Ver.5 Phase 1 導入手順

## 1. GitHub Pagesへ上書きするもの
既存Ver.4を維持したまま、次をリポジトリ直下へ上書きします。

- `index.html`
- `assets` フォルダ
- `manifest.webmanifest`
- `sw.js`

`config.js` は現在のSupabase設定を維持するため、このZIPのものと現在GitHubのものが同じか確認してください。

## 2. AIサーバーをMacで起動
1. `.env.example` を複製して、名前を `.env` に変更します。
2. `.env` の `OPENAI_API_KEY=` の右側へAPIキーを入力します。
3. ターミナルでこのフォルダへ移動します。
4. `docker compose up --build` を実行します。
5. Safariで `http://localhost:8000/health` を開き、`"ok": true` を確認します。

## 3. アプリでAI設定
公開サイトの「🤖 AI」→「⚙️ AI設定」で、Macから使う場合は `http://localhost:8000` を保存します。

## 重要
APIキーを `config.js`、`index.html`、GitHubへ保存しないでください。
Mac以外のiPhoneからAIを使うには、AIサーバーをHTTPSで公開する作業が別途必要です。
