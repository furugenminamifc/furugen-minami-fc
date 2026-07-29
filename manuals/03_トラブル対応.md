# トラブル対応

## AIが未接続になる
- Docker Desktopが起動しているか確認します。
- `docker compose up --build` を実行します。
- `http://localhost:8000/health` が開くか確認します。
- AI設定URLの末尾に余分な `/` があっても自動調整されます。

## APIキー未設定と出る
- `.env` が `docker-compose.yml` と同じ階層にあるか確認します。
- `.env` のファイル名が `.env.txt` になっていないか確認します。
- 設定後にDockerを停止し、再度起動します。

## iPhoneでAIだけ動かない
`localhost` は、その端末自身を指します。iPhoneからはMacの `localhost` に接続できません。さらにGitHub PagesはHTTPSのため、家庭内HTTPサーバーへの接続が制限される場合があります。iPhone対応にはHTTPSで公開したAIサーバーが必要です。

## 選手データが消えたように見える
Supabase SQLを再実行せず、まず `config.js` と既存画面が維持されているか確認してください。本版は既存データを削除する処理を追加していません。
