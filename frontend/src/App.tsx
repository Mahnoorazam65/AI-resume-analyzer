import { useRef, useState } from "react";
import { analyze, parseFile, streamChat, type Analysis, type Msg } from "./api";

const CHIPS = ["Rewrite my summary", "Make my bullets stronger", "What skills am I missing?", "How do I fit this on one page?"];
const card = "bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm";

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mb-3">
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <ul className="list-disc pl-5 text-sm space-y-1">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

export default function App() {
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState<Analysis | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [typing, setTyping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(f?: File) {
    if (!f) return;
    setStatus(`Parsing ${f.name}...`);
    try {
      const t = await parseFile(f);
      setResume(t);
      setStatus(`Extracted ${t.split(/\s+/).length} words from ${f.name}${t.length < 50 ? " (very little text. Scanned PDF?)" : ""}`);
    } catch (e) { setStatus((e as Error).message); }
  }

  async function run() {
    if (resume.trim().length < 50) return setStatus("Upload a resume or paste a few lines first.");
    setBusy(true); setMsgs([]); setA(null);
    try { setA(await analyze(resume, jd)); } catch (e) { setStatus((e as Error).message); }
    setBusy(false);
  }

  async function send(text: string) {
    text = text.trim();
    if (!text || !a || typing) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs([...next, { role: "assistant", content: "" }]); setQ(""); setTyping(true);
    const add = (c: string) => setMsgs(cur => {
      const copy = [...cur]; const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, content: last.content + c }; return copy;
    });
    try { await streamChat(resume, jd, a.total, a.match?.missing ?? [], next, add); }
    catch (e) { add(`Error: ${(e as Error).message}`); }
    setTyping(false);
  }

  const color = !a ? "" : a.total >= 75 ? "#16a34a" : a.total >= 50 ? "#d97706" : "#dc2626";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold">AI Resume Analyzer</h1>
      <p className="text-slate-500 mb-5">Upload a resume, add a job description, get a score, keyword gaps, AI feedback and a coach chatbot.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className={card}>
          <h2 className="font-semibold mb-2">1. Resume (PDF or DOCX)</h2>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
            className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-500 cursor-pointer hover:border-indigo-500 hover:text-indigo-600"
          >Drop file here or click to upload</div>
          <input ref={fileRef} type="file" accept=".pdf,.docx" hidden onChange={e => onFile(e.target.files?.[0])} />
          <p className="text-xs text-slate-500 my-2">{status || "Or paste resume text below."}</p>
          <textarea value={resume} onChange={e => setResume(e.target.value)} placeholder="Extracted resume text (editable)"
            className="w-full h-36 border border-slate-200 rounded-lg p-2 text-sm" />
        </div>
        <div className={card}>
          <h2 className="font-semibold mb-2">2. Job description (optional)</h2>
          <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the job description to enable keyword matching"
            className="w-full h-64 border border-slate-200 rounded-lg p-2 text-sm" />
        </div>
      </div>

      <button onClick={run} disabled={busy} className="bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl disabled:opacity-50 mb-4">
        {busy ? "Analyzing..." : "Analyze resume"}
      </button>

      {a && (<>
        <div className={`${card} flex flex-wrap items-center gap-6`}>
          <div className="w-28 h-28 rounded-full grid place-items-center shrink-0"
            style={{ background: `conic-gradient(${color} ${a.total * 3.6}deg, #e2e8f0 0)` }}>
            <div className="w-20 h-20 rounded-full bg-white grid place-items-center text-3xl font-bold">{a.total}</div>
          </div>
          <div className="flex-1 min-w-56">
            {a.parts.map(p => (
              <div key={p.name} className="flex items-center gap-2 my-1.5 text-sm">
                <span className="w-36">{p.name}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded"><div className="h-2 bg-indigo-500 rounded" style={{ width: `${Math.round(p.value * 100)}%` }} /></div>
                <span className="w-10 text-right">{Math.round(p.value * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className={card}>
          <h2 className="font-semibold mb-2">Keyword match{a.match && `: ${Math.round(a.match.pct * 100)}%`}</h2>
          {a.match ? (<>
            <p className="text-xs text-slate-500">Found in your resume</p>
            <div className="flex flex-wrap gap-1.5 mb-3">{a.match.found.map(k => <span key={k} className="text-xs border border-green-600 text-green-700 rounded-full px-2 py-0.5">{k}</span>)}</div>
            <p className="text-xs text-slate-500">Missing (add where truthful)</p>
            <div className="flex flex-wrap gap-1.5">{a.match.missing.map(k => <span key={k} className="text-xs border border-red-500 text-red-600 rounded-full px-2 py-0.5">{k}</span>)}</div>
          </>) : <p className="text-sm text-slate-500">Paste a job description to compare keywords.</p>}
        </div>

        <div className={card}>
          <h2 className="font-semibold mb-2">AI feedback</h2>
          {a.ai ? (<>
            <List title="Strengths" items={a.ai.strengths} />
            <List title="Weaknesses" items={a.ai.weaknesses} />
            <List title="Suggestions" items={a.ai.suggestions} />
            {a.ai.rewrites?.map((r, i) => (
              <div key={i} className="border-l-4 border-indigo-500 pl-3 my-2 text-sm">
                <s className="text-slate-400">{r.original}</s><br />{r.improved}
              </div>
            ))}
          </>) : <p className="text-sm text-red-600">AI feedback unavailable: {a.ai_error}</p>}
        </div>

        <div className={card}>
          <h2 className="font-semibold mb-2">Resume coach chatbot</h2>
          <div className="h-72 overflow-y-auto flex flex-col gap-2 mb-3">
            <div className="max-w-[85%] bg-slate-100 rounded-xl px-3 py-2 text-sm">Hi! I've reviewed your resume (score {a.total}/100). Ask me anything or tap a suggestion below.</div>
            {msgs.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "self-end bg-indigo-600 text-white" : "bg-slate-100"}`}>{m.content || "..."}</div>
            ))}
          </div>
          <div className="mb-2">{CHIPS.map(c => <button key={c} onClick={() => send(c)} className="text-xs border border-slate-300 rounded-lg px-2.5 py-1 mr-1.5 mb-1.5 text-indigo-600">{c}</button>)}</div>
          <div className="flex gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && send(q)}
              placeholder="Ask how to improve your resume..." className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <button onClick={() => send(q)} disabled={typing} className="bg-indigo-600 text-white px-4 rounded-lg disabled:opacity-50">Send</button>
          </div>
        </div>
      </>)}
    </div>
  );
}
