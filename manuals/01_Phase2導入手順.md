# Ver.5 Phase 2 導入手順

## 1. `.env`を作成

`.env.example`を複製し、名前を`.env`へ変更します。

```env
OPENAI_API_KEY=ここにOpenAI_APIキー
OPENAI_MODEL=gpt-5-mini
OPENAI_MAX_OUTPUT_TOKENS=1800
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,https://furugenminamifc.github.io
```

## 2. Phase 2 AIサーバーを起動

ターミナルでこのフォルダへ移動して実行します。

```bash
docker compose up --build
```

Phase 2は8001番を使用します。Safariで次を確認します。

```text
http://localhost:8001/health
```

`api_key_configured: true`なら準備完了です。

## 3. Macで画面を確認

別のターミナルで実行します。

```bash
python3 -m http.server 5500
```

Safariで開きます。

```text
http://localhost:5500
```

「🤖 AI」→「⚙️ AI設定」でURLを次にします。

```text
http://localhost:8001
```

接続確認後、AIへ質問してください。

## 4. GitHubへ反映

Macで選手36人・試合・ランキング・AI会話が正常であることを確認してから、次をGitHubへ上書きします。

- `index.html`
- `assets`フォルダ
- `manifest.webmanifest`
- `sw.js`

`config.js`は現在のSupabase設定と同じことを確認した場合だけ上書きします。

GitHubへアップロードしないもの：

- `.env`
- `ai-server`
- `docker-compose.yml`

GitHub Pagesは画面部分のみです。AIサーバーはMacのDockerで動かします。
