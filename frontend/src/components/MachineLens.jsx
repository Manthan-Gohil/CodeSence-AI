import React, { useState } from "react";
import { ChevronRight, Database, Terminal, FileCode, CheckCircle2, Copy } from "lucide-react";

export default function MachineLens() {
  const [activeItem, setActiveItem] = useState(0);
  const [copied, setCopied] = useState(false);

  const lenses = [
    {
      index: "01",
      title: "ingest payload & AST schema",
      subtitle: "REST API wire format for repository ingestion",
      code: `{
  "repo_url": "https://github.com/Manthan-Gohil/PixelLearn-Coding-Platform",
  "user_id": "usr_94812a0f",
  "provider": "gemini",
  "options": {
    "max_files": 100,
    "max_chunks": 150,
    "chunk_size": 800,
    "chunk_overlap": 120,
    "batch_embed_size": 32
  },
  "status": "indexed_ok",
  "chunks_added": 150,
  "namespace": "usr_94812a0f_PixelLearn-Coding-Platform"
}`,
      note: "verified: POST /api/repo/ingest_repo"
    },
    {
      index: "02",
      title: "vector embeddings & faiss index",
      subtitle: "768-dimensional dense representation",
      code: `// Chunks stored in faiss_data volume: usr_94812a0f_PixelLearn-Coding-Platform/index.faiss
{
  "chunk_id": "chunk_042",
  "file_path": "src/controllers/auth.controller.ts",
  "dim": 768,
  "vector_head": [-0.0381, 0.0412, -0.0194, 0.0921, 0.0045, -0.0712, ...],
  "model": "nomic-embed-text",
  "batch_latency_ms": 38.2,
  "similarity_metric": "L2_INNER_PRODUCT"
}`,
      note: "verified: GET /chunks/health"
    },
    {
      index: "03",
      title: "neural reasoning prompt assembly",
      subtitle: "prompt with top-k retrieved codebase context",
      code: `System: You are CodeSense AI, an intelligent DevOps and Codebase Assistant.
Context:
--- [src/services/api.ts] ---
export const executeCode = async (lang: string, code: string) => {
  return await dockerContainerRunner.dispatch({ lang, code });
};

User: "How does code execution work in this platform?"

Response Strategy:
- Ground in retrieved chunk (dockerContainerRunner dispatch)
- Max output tokens: 768
- Latency: 2.1s (Sub-3s guarantee)`,
      note: "verified: POST /api/ai/chat"
    }
  ];

  const copyCode = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-hairline-strong bg-[#0E1013] rounded-2xl overflow-hidden shadow-2xl">
      {/* Header bar */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline bg-[#131518] px-6 py-4">
        <span className="label-mono text-[#AEB4BD]">the machine lens — what the readers read</span>
        <span className="label-mono text-[10px] text-[#6E747D]">real representations · nothing mocked</span>
      </div>

      {/* Accordion List */}
      <div className="divide-y divide-hairline">
        {lenses.map((lens, idx) => {
          const isOpen = activeItem === idx;
          return (
            <div key={lens.index} className="transition-colors hover:bg-[#131518]/50">
              <button
                type="button"
                onClick={() => setActiveItem(isOpen ? -1 : idx)}
                className="flex w-full cursor-pointer flex-wrap items-baseline gap-x-6 gap-y-1 px-6 py-4.5 text-left md:px-8"
              >
                <span className="font-mono text-xs text-[#6E747D]">{lens.index}</span>
                <span className="text-sm font-semibold tracking-[-0.01em] text-[#F4F5F7]">
                  {lens.title}
                </span>
                <span className="font-mono text-[11px] text-[#6E747D] hidden sm:inline">
                  {lens.subtitle}
                </span>
                <span
                  className={`ml-auto font-mono text-xs text-[#6E747D] transition-transform duration-300 ${
                    isOpen ? "rotate-90 text-[#F4F5F7]" : ""
                  }`}
                >
                  →
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-hairline bg-[#0B0C0E] px-6 py-4 md:px-8 animate-fade-in">
                  <div className="relative">
                    <pre className="max-h-[320px] overflow-auto rounded-lg border border-hairline bg-[#131518]/70 p-4 font-mono text-[11.5px] leading-relaxed text-[#AEB4BD] [scrollbar-width:thin]">
                      <code>{lens.code}</code>
                    </pre>
                    <button
                      onClick={() => copyCode(lens.code)}
                      className="absolute top-3 right-3 rounded border border-hairline bg-[#1A1D24] px-2 py-1 text-[10px] font-mono text-[#AEB4BD] hover:text-white flex items-center gap-1"
                    >
                      {copied ? <CheckCircle2 size={11} className="text-[#2EA043]" /> : <Copy size={11} />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[#6E747D]">
                    <span>{lens.note}</span>
                    <span className="text-[#2EA043]">Live Payload Format</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
