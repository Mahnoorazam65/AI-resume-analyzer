export interface Part { name: string; weight: number; value: number }
export interface Match { found: string[]; missing: string[]; pct: number }
export interface AI {
  strengths: string[]; weaknesses: string[]; suggestions: string[];
  rewrites: { original: string; improved: string }[];
}
export interface Analysis {
  total: number; parts: Part[]; match: Match | null; words: number;
  ai: AI | null; ai_error?: string;
}
export interface Msg { role: "user" | "assistant"; content: string }

async function check(r: Response) {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `Request failed (${r.status})`);
  return r;
}

export async function parseFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await check(await fetch("/api/parse", { method: "POST", body: fd }));
  return (await r.json()).text;
}

export async function analyze(resume: string, jd: string): Promise<Analysis> {
  const r = await check(await fetch("/api/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume, jd }),
  }));
  return r.json();
}

export async function streamChat(
  resume: string, jd: string, score: number, missing: string[],
  messages: Msg[], onChunk: (t: string) => void
) {
  const r = await check(await fetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume, jd, score, missing, messages }),
  }));
  const reader = r.body!.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(dec.decode(value, { stream: true }));
  }
}
