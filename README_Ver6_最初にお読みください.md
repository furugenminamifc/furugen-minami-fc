# 古堅南FC Ver.6 クラウドAIレポート完成版

## Ver.6の追加機能
- AI試合レポート（コーチ用・保護者向け・次回練習）
- 作成したAIレポートをSupabaseへ保存
- 動画タイムスタンプメモ（動画ファイルをアップロードせず場面を管理）
- 動画メモをAI試合分析へ送信
- Ver.5の選手・試合・ランキング・AI会話を継承

## 最初に行うこと
1. SupabaseのSQL Editorで `Ver6追加設定.sql` を1回だけ実行します。
2. `.env.example` をコピーして `.env` を作り、OpenAI APIキーを設定します。
3. Docker Desktopを起動します。
4. このフォルダで `docker compose up --build` を実行します。
5. 別のターミナルで `python3 -m http.server 5500` を実行します。
6. Safariで `http://localhost:5500` を開きます。

## GitHubへアップロードするファイル
`index.html`、`assets`、`config.js`、`manifest.webmanifest`、`sw.js`、`.nojekyll` をアップロードします。

## 絶対にGitHubへアップロードしないもの
`.env`（OpenAI APIキーが入っています）

## 注意
GitHub PagesだけではAIサーバーは動きません。Mac上のDockerを起動している間はローカルAIが使えます。外出先やチーム全体でAIを使うには、次の段階でAIサーバーをRender等へ公開します。
