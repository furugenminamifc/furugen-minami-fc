# Ver.4.1 第1弾 導入マニュアル

## GitHub Pagesへ表示する
1. ZIPを解凍します。
2. `index.html`、`assets`、`manifest.webmanifest`をGitHubリポジトリの一番上へ上書きアップロードします。
3. GitHub Pagesを開き、古い表示ならSafariの再読み込みまたは履歴削除を行います。
4. 上部メニューに「AIアシスタント」「AI試合分析」「AI戦術提案」が表示されれば成功です。

## AIをDockerで使う
1. `.env.example`を複製して名前を`.env`に変更します。
2. `.env`の`OPENAI_API_KEY`へ自分のAPIキーを入力します。
3. ターミナルで、このフォルダへ移動します。
4. `docker compose up --build`を実行します。
5. ブラウザで `http://localhost:8000/health` を開き、statusがokなら成功です。
6. アプリの「設定」でAIサーバーURLを `http://localhost:8000` にします。

## 重要
GitHub Pagesを他の人が使う場合、各家庭の端末からあなたのMacのlocalhostには接続できません。全員でAIを利用するにはAIサーバーをRender、Railway、Fly.io等へ公開する必要があります。
