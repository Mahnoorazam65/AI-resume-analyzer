import json
import os
import re

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from analyzer import extract_text, score_resume

load_dotenv()
client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from .env
MODEL = os.getenv("MODEL", "claude-sonnet-5-5")
app = FastAPI(title="AI Resume Analyzer")


class AnalyzeReq(BaseModel):
    resume: str
    jd: str = ""


class Msg(BaseModel):
    role: str
    content: str


class ChatReq(BaseModel):
    resume: str
    jd: str = ""
    score: int = 0
    missing: list[str] = []
    messages: list[Msg]


@app.post("/api/parse")
async def parse(file: UploadFile = File(...)):
    try:
        text = extract_text(await file.read(), file.filename or "")
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:
        raise HTTPException(400, "Could not read this file")
    return {"text": text}


@app.post("/api/analyze")
def analyze(req: AnalyzeReq):
    result = score_resume(req.resume, req.jd)
    prompt = (
        "You are an expert resume reviewer. Review this resume"
        + (" against the job description" if req.jd.strip() else "")
        + '. Respond ONLY with JSON: {"strengths":[],"weaknesses":[],"suggestions":[],'
        '"rewrites":[{"original":"","improved":""}]}. Max 4 items per list and max 3 rewrites of weak bullets. '
        "Use only facts in the resume; never invent numbers (use placeholders like [X%]).\n\n"
        f"RESUME:\n{req.resume[:7000]}\n\nJOB DESCRIPTION:\n{req.jd[:3000] or '(none)'}"
    )
    try:
        msg = client.messages.create(model=MODEL, max_tokens=1500,
                                     messages=[{"role": "user", "content": prompt}])
        raw = re.sub(r"^```(?:json)?|```$", "", msg.content[0].text.strip(), flags=re.M).strip()
        result["ai"] = json.loads(raw)
    except Exception as e:  # keep the score even if the AI call fails
        result["ai"] = None
        result["ai_error"] = str(e)
    return result


@app.post("/api/chat")
def chat(req: ChatReq):
    system = (
        "You are a concise, practical resume coach. Give specific, actionable suggestions and never invent "
        f"facts about the candidate.\n\nRESUME:\n{req.resume[:7000]}\n\nJOB DESCRIPTION:\n{req.jd[:3000] or '(none)'}"
        f"\n\nCOMPUTED SCORE: {req.score}/100. Missing keywords: {', '.join(req.missing) or 'n/a'}."
    )

    def gen():
        try:
            with client.messages.stream(model=MODEL, max_tokens=800, system=system,
                                        messages=[m.model_dump() for m in req.messages]) as s:
                for t in s.text_stream:
                    yield t
        except Exception as e:
            yield f"\n[Error: {e}]"

    return StreamingResponse(gen(), media_type="text/plain")
