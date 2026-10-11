import io
import re
from collections import Counter

import docx
import pdfplumber

STOP = set(
    "a an the and or of to in for with on at by from as is are be will we you your our this that it their "
    "they can must should have has years year experience work working ability strong etc using use new such "
    "including include other more all any who what about into able also not but if than then them these those "
    "per via job role team company candidate looking responsibilities requirements required preferred skills".split()
)
VERBS = (
    "built developed designed led created implemented managed improved increased reduced launched delivered "
    "optimized analyzed automated deployed collaborated engineered trained integrated achieved organized established"
).split()
SECTIONS = [r"summary|objective|profile", r"skills", r"experience|internship|employment",
            r"education", r"projects?", r"certif|achievements|awards"]


def extract_text(data: bytes, filename: str) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return "\n".join((p.extract_text() or "") for p in pdf.pages).strip()
    if name.endswith(".docx"):
        return "\n".join(p.text for p in docx.Document(io.BytesIO(data)).paragraphs).strip()
    raise ValueError("Only PDF and DOCX files are supported")


def key_terms(jd: str, n: int = 30) -> list[str]:
    words = [w.rstrip(".-") for w in re.findall(r"[a-z][a-z+#.\-]+", jd.lower())]
    words = [w for w in words if len(w) > 1 and w not in STOP]
    counts = Counter(words)
    counts.update(f"{a} {b}" for a, b in zip(words, words[1:]))
    return [k for k, v in counts.most_common() if " " not in k or v >= 2][:n]


def keyword_match(resume: str, jd: str) -> dict:
    terms, low = key_terms(jd), resume.lower()
    found = [t for t in terms if t in low]
    missing = [t for t in terms if t not in low]
    return {"found": found, "missing": missing, "pct": len(found) / len(terms) if terms else 0}


def score_resume(resume: str, jd: str = "") -> dict:
    low, words = resume.lower(), len(resume.split())
    parts, match = [], None
    if jd.strip():
        match = keyword_match(resume, jd)
        parts.append({"name": "Keyword match", "weight": 40, "value": match["pct"]})
    parts.append({"name": "Section coverage", "weight": 20,
                  "value": sum(bool(re.search(s, low)) for s in SECTIONS) / len(SECTIONS)})
    verbs = sum(bool(re.search(r"\b" + v, low)) for v in VERBS)
    nums = len(re.findall(r"\d+\s?%|\$\s?\d+|\b\d{2,}\b", resume))
    parts.append({"name": "Action verbs & impact", "weight": 20,
                  "value": min(1, verbs / 8) * 0.5 + min(1, nums / 6) * 0.5})
    length = words / 150 if words < 150 else 1 if words <= 800 else max(0.3, 1 - (words - 800) / 800)
    parts.append({"name": "Length & format", "weight": 10, "value": length})
    contact = [re.search(r"[\w.+-]+@[\w-]+\.\w+", resume), re.search(r"\+?\d[\d\s\-()]{8,}", resume),
               re.search(r"linkedin\.com", low), re.search(r"github\.com", low)]
    parts.append({"name": "Contact & links", "weight": 10, "value": sum(bool(c) for c in contact) / 4})
    total = round(sum(p["weight"] * p["value"] for p in parts) / sum(p["weight"] for p in parts) * 100)
    return {"total": total, "parts": parts, "match": match, "words": words}
