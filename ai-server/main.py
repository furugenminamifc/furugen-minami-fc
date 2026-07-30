import os
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="古堅南FC AI Coach Server", version="7.0.0")

origins = [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

Role = Literal["user", "assistant"]
Mode = Literal["chat", "training", "tactics", "match", "player"]

class HistoryItem(BaseModel):
    role: Role
    content: str = Field(min_length=1, max_length=12000)

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    mode: Mode = "chat"
    system_instruction: str = Field(default="", max_length=4000)
    context: dict[str, Any] = Field(default_factory=dict)
    history: list[HistoryItem] = Field(default_factory=list, max_length=12)

class ReportRequest(BaseModel):
    report_type: Literal["coach", "parents", "training"] = "coach"
    context: dict[str, Any] = Field(default_factory=dict)
    system_instruction: str = Field(default="", max_length=4000)

MODE_INSTRUCTIONS = {
    "chat": "相談に直接答え、必要に応じて確認質問を1つだけしてください。",
    "training": "目的、対象年代、合計時間、用具、人数、各メニューの時間配分、進め方、コーチングポイント、安全面、雨天代替を見出し付きで示してください。",
    "tactics": "小学生にも伝わる言葉で、狙い、立ち位置、合図、攻撃時、守備時、練習方法、試合中の短い声かけを示してください。",
    "match": "事実と推測を分け、良かった点、改善点、次回の優先課題、具体的な練習、選手への前向きな声かけを示してください。データが少ない場合はその限界も明記してください。",
    "player": "選手を順位付けせず、強み、伸ばしたい点、次の具体目標、練習例、本人への前向きな伝え方を示してください。出場時間だけで能力を断定しないでください。",
}

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "古堅南FC AIコーチサーバー Ver.7",
        "version": "7.0.0",
        "model": os.getenv("OPENAI_MODEL", "gpt-5-mini"),
        "api_key_configured": bool(os.getenv("OPENAI_API_KEY")),
        "chat_endpoint": "/v1/ai/chat",
    }

REPORT_INSTRUCTIONS = {
    "coach": "コーチ向けに、事実、良かった点、改善点、優先課題、次回練習、試合中の声かけを見出し付きで作成してください。",
    "parents": "保護者向けに、結果だけで選手を評価せず、努力・成長・次への期待を温かく簡潔に伝える報告文を作成してください。個人を責めないでください。",
    "training": "試合内容に基づき、小学生向け60〜90分の練習メニューを、時間配分、目的、用具、進め方、コーチングポイント、安全面付きで作成してください。",
}

@app.post("/v1/ai/report")
async def report(req: ReportRequest) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEYが設定されていません。")
    context_text = "\n".join(f"{k}: {v}" for k, v in req.context.items() if v not in (None, "", [], {}))
    instructions = "\n".join([
        "あなたは古堅南FCを支援する日本語の小学生年代サッカーAIコーチです。",
        "入力された事実と推測を分け、安全・成長・楽しさを優先してください。",
        REPORT_INSTRUCTIONS[req.report_type],
        req.system_instruction,
    ]).strip()
    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-5-mini"),
        "instructions": instructions,
        "input": f"次の試合データを使ってレポートを作成してください。\n{context_text}",
        "max_output_tokens": int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "2200")),
    }
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post("https://api.openai.com/v1/responses", headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI APIへ接続できませんでした: {exc}") from exc
    if response.status_code >= 400:
        try:
            detail = response.json().get("error", {}).get("message", response.text)
        except Exception:
            detail = response.text
        raise HTTPException(status_code=response.status_code, detail=detail)
    data = response.json()
    answer = data.get("output_text", "")
    if not answer:
        answer = "\n".join(content.get("text", "") for item in data.get("output", []) for content in item.get("content", []) if content.get("type") == "output_text")
    if not answer:
        raise HTTPException(status_code=502, detail="AIレポートを取得できませんでした。")
    return {"answer": answer, "report_type": req.report_type, "model": data.get("model", payload["model"]), "usage": data.get("usage", {})}

@app.post("/v1/ai/chat")
async def chat(req: ChatRequest) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEYが設定されていません。")

    context_lines = []
    for key, value in req.context.items():
        if value not in (None, "", [], {}):
            context_lines.append(f"{key}: {value}")

    instructions = "\n".join([
        "あなたは古堅南FCを支援する、日本語の小学生年代サッカーAIコーチです。",
        "安全、成長、楽しさ、失敗から学ぶ姿勢を優先してください。",
        "選手個人を断定的に評価せず、医療判断や危険な練習は避けてください。",
        "回答は読みやすい日本語で、実行できる具体案を中心にしてください。",
        MODE_INSTRUCTIONS[req.mode],
        req.system_instruction,
        ("チームデータ:\n" + "\n".join(context_lines)) if context_lines else "",
    ]).strip()

    conversation: list[dict[str, str]] = []
    for item in req.history[-10:]:
        conversation.append({"role": item.role, "content": item.content})
    conversation.append({"role": "user", "content": req.message})

    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-5-mini"),
        "instructions": instructions,
        "input": conversation,
        "max_output_tokens": int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "1800")),
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI APIへ接続できませんでした: {exc}") from exc

    if response.status_code >= 400:
        try:
            detail = response.json().get("error", {}).get("message", response.text)
        except Exception:
            detail = response.text
        raise HTTPException(status_code=response.status_code, detail=detail)

    data = response.json()
    answer = data.get("output_text", "")
    if not answer:
        parts: list[str] = []
        for item in data.get("output", []):
            for content in item.get("content", []):
                if content.get("type") == "output_text" and content.get("text"):
                    parts.append(content["text"])
        answer = "\n".join(parts)
    if not answer:
        raise HTTPException(status_code=502, detail="AI回答を取得できませんでした。")

    usage = data.get("usage", {})
    return {
        "answer": answer,
        "mode": req.mode,
        "model": data.get("model", os.getenv("OPENAI_MODEL", "gpt-5-mini")),
        "usage": usage,
    }
