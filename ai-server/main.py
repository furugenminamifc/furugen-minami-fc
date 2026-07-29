import os
from typing import Any, Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

app=FastAPI(title="古堅南FC AI Server",version="4.1")
origins=[x.strip() for x in os.getenv("ALLOWED_ORIGINS","http://localhost:8080,http://127.0.0.1:8080").split(",") if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=False,allow_methods=["GET","POST"],allow_headers=["*"])

class AIRequest(BaseModel):
    type:str
    payload:Dict[str,Any]

def prompt_for(t:str,p:dict)->str:
    base="あなたは古堅南FCを支援する日本語の育成年代サッカーAIコーチです。安全、前向き、簡潔で実行可能な助言をしてください。勝利だけでなく成長、主体性、失敗から学ぶ姿勢を重視してください。"
    if t=="chat": return base+f"\n相談：{p.get('question','')}"
    if t=="match": return base+f"\n次の試合を『良かった点・改善点・次回練習・選手への声かけ』で分析してください。大会:{p.get('tournament')} 対戦相手:{p.get('opponent')} 結果:{p.get('ourScore')}-{p.get('theirScore')} メモ:{p.get('notes')}"
    if t=="tactics": return base+f"\n次の条件で『守備・攻撃・切替・セットプレー・短い声かけ』を提案してください。年代:{p.get('age')} 配置:{p.get('formation')} 相手:{p.get('opponentFeatures')} 自チーム課題:{p.get('teamIssues')}"
    raise HTTPException(400,"未対応のAI種別です")

@app.get('/health')
def health(): return {"status":"ok","service":"furugen-minami-fc-ai","version":"4.1"}

@app.post('/api/ai')
def ai(req:AIRequest):
    key=os.getenv("OPENAI_API_KEY")
    if not key: raise HTTPException(503,"OPENAI_API_KEYが設定されていません")
    client=OpenAI(api_key=key)
    response=client.responses.create(model=os.getenv("OPENAI_MODEL","gpt-5-mini"),input=prompt_for(req.type,req.payload))
    return {"answer":response.output_text}
