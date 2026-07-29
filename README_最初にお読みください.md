
# SOCCER VISION ANALYZER PRO — AI・クラウド接続版

このパッケージには次を含みます。

- `frontend/`：既存PRO版にAIアップロード・追跡・ハイライト作成UIを追加
- `supabase/schema.sql`：リアルタイム共有・権限管理用データベース
- `ai-server/`：FastAPI + Ultralytics YOLO + FFmpeg処理サーバー
- `docker-compose.yml`：MacでAIサーバーを起動
- `AIサーバー起動_Mac.command`：ダブルクリック起動用

## 1. MacでAIサーバーを試す

必要なもの：Docker Desktop

1. ZIPを解凍
2. `AIサーバー起動_Mac.command` をダブルクリック
3. 初回はモデルやライブラリのダウンロードで時間がかかります
4. ブラウザで `http://localhost:8000/health` を開き、`status: ok` を確認
5. `frontend/index.html` を開く
6. 設定画面の「AI API URL」に `http://localhost:8000` を入力
7. 動画解析画面で、動画アップロード → AI追跡 → ハイライト作成

## 2. Supabaseを接続

1. Supabaseプロジェクトを新規作成
2. SQL Editorで `supabase/schema.sql` を実行
3. Authenticationのメールログインを有効化
4. Project URLとAnon Keyをアプリの設定画面へ入力
5. 本番ではチーム作成・招待画面を追加し、ユーザーを`team_members`へ登録

## 3. 現在のAI追跡精度

標準モデルは一般物体の `person` と `sports ball` を追跡します。
サッカーの遠景映像ではボールが小さいため、正確な自動追跡には以下が必要です。

- サッカー映像で学習した専用モデル
- 1080p以上・固定カメラ・ピッチ全体が見える映像
- GPU搭載サーバー
- チーム色・背番号認識モデル

## 4. 本番公開に必要なもの

- Supabase Project URL / Anon Key
- AIサーバーの公開先（GPU対応クラウド推奨）
- 公開ドメイン
- 招待するコーチ・スタッフ・保護者のメールアドレス
- 動画保存容量・保存期間の方針

## セキュリティ

- Supabase Service Role Keyをフロントエンドへ入れないでください。
- `schema.sql` はRLSを有効にしています。
- 本番ではCORSを公開サイトのドメインだけに限定してください。
- 子どもの映像を扱うため、保護者同意・閲覧権限・保存期間を決めてください。
