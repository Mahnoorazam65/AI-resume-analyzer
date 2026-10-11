# AI-Powered Resume Analyzer

Upload a resume (PDF/DOCX), compare it with a job description, get a score, keyword gaps,
AI feedback, and chat with a real-time resume coach.

**Stack:** React + TypeScript + Tailwind (Vite) | FastAPI | pdfplumber, python-docx | Claude API (streaming)

## Run it

### 1. Backend (Python 3.10+)
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows  (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env         # Mac/Linux: cp .env.example .env  -> add your ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

### 2. Frontend (Node 18+)
```bash
cd frontend
npm install
npm run dev                    # opens http://localhost:5173
```
Vite proxies `/api` to the backend, so no CORS setup is needed.

## How it works
| Feature | Where |
|---|---|
| Text extraction (PDF/DOCX) | `backend/analyzer.py` -> `extract_text` |
| Keyword matching vs job description | `analyzer.py` -> `key_terms`, `keyword_match` |
| Score (5 weighted parts) | `analyzer.py` -> `score_resume` |
| AI feedback (strengths, weaknesses, rewrites) | `main.py` -> `/api/analyze` |
| Real-time chatbot (streaming) | `main.py` -> `/api/chat`, `frontend/src/api.ts` -> `streamChat` |

Score weights: keywords 40%, sections 20%, action verbs and numbers 20%, length 10%, contact links 10%
(without a job description the rest are rescaled).

## Limitations / future work
Scanned PDFs need OCR (e.g. pytesseract); add auth + saved history (Supabase); export report as PDF.
