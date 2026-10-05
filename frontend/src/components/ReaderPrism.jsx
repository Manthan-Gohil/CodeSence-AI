import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, Bot, Code2, Sparkles, Database, Layers, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function ReaderPrism() {
  const [activeTab, setActiveTab] = useState(0);

  const readers = [
    {
      id: "developers",
      name: "Developers",
      icon: Users,
      surface: "Interactive Codebase Explorer",
      title: "Code you can comprehend in seconds.",
      desc: "Instant AST dependency graphs, syntax highlighted tree traversal, and direct line-by-line inspection.",
      cta: "Explore repository",
      href: "/repo",
      sheet: (
        <div className="h-full flex flex-col justify-between p-5 bg-[#131518] text-[#F4F5F7]">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#6E747D] border-b border-hairline pb-3">
            <span className="flex items-center gap-1.5 text-[#AEB4BD]">
              <span className="h-2 w-2 rounded-full bg-[#2EA043]" />
              src/kernel/rag_pipeline.py
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[#6E747D]">AST: Parsed</span>
          </div>

          <div className="my-3 space-y-1.5 font-mono text-[12px] leading-relaxed text-[#AEB4BD]">
            <p className="text-[#6E747D]"># Vector similarity search over chunks</p>
            <p><span className="text-[#E9EBEF] font-semibold">def</span> <span className="text-[#2EA043]">query_codebase</span>(query: str, top_k=4):</p>
            <p className="pl-4">embedding = <span className="text-[#E9EBEF]">embedder</span>.embed_query(query)</p>
            <p className="pl-4">context = <span className="text-[#E9EBEF]">vectorstore</span>.search(embedding, k=top_k)</p>
            <p className="pl-4"><span className="text-[#E9EBEF] font-semibold">return</span> <span className="text-[#2EA043]">llm</span>.generate(prompt=QA_PROMPT, context=context)</p>
          </div>

          <div className="pt-3 border-t border-hairline flex items-center justify-between text-[11px] font-mono text-[#6E747D]">
            <span>Latency: 2.1s</span>
            <span className="text-[#2EA043]">Ollama & Gemini Neural Engine</span>
          </div>
        </div>
      )
    },
    {
      id: "search",
      name: "Vectors",
      icon: Search,
      surface: "Semantic Vector Space",
      title: "Index meaning, not just exact keywords.",
      desc: "Batched 768-dimensional embeddings generated with nomic-embed-text and queried with FAISS indexation.",
      cta: "Test vector search",
      href: "/ai",
      sheet: (
        <div className="h-full flex flex-col justify-between p-5 bg-[#0e1013] text-[#F4F5F7]">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#6E747D] border-b border-hairline pb-3">
            <span className="text-[#AEB4BD]">FAISS Vector Index (768-dim)</span>
            <span className="text-[10px] text-[#2EA043]">nomic-embed-text</span>
          </div>

          <div className="my-2 space-y-2 font-mono text-[11px] text-[#AEB4BD]">
            <div className="rounded border border-hairline bg-[#131518] p-2.5">
              <div className="flex justify-between text-[10px] text-[#6E747D]">
                <span>CHUNK #042 · Similarity: 0.941</span>
                <span>428 tokens</span>
              </div>
              <p className="mt-1 text-[#E9EBEF] text-[11px] line-clamp-2">
                "Authentication layer orchestrating OAuth credentials and HMAC sessions."
              </p>
            </div>
            <div className="rounded border border-hairline bg-[#131518]/60 p-2.5">
              <div className="flex justify-between text-[10px] text-[#6E747D]">
                <span>CHUNK #089 · Similarity: 0.887</span>
                <span>312 tokens</span>
              </div>
              <p className="mt-1 text-[#AEB4BD] text-[11px] line-clamp-2">
                "Data extraction pipeline downloading GitHub zipball archives."
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-hairline flex items-center justify-between text-[11px] font-mono text-[#6E747D]">
            <span>150 Chunks indexed</span>
            <span className="text-[#2EA043]">Batch: 32 chunks/s</span>
          </div>
        </div>
      )
    },
    {
      id: "agents",
      name: "Agents",
      icon: Bot,
      surface: "LLM Reasoning Engine",
      title: "Ground truth answers from your repository.",
      desc: "Zero hallucination DevOps assistant capable of explaining architecture, troubleshooting errors, and generating code.",
      cta: "Launch AI chat",
      href: "/ai",
      sheet: (
        <div className="h-full flex flex-col justify-between p-5 bg-[#121419] text-[#F4F5F7]">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#6E747D] border-b border-hairline pb-3">
            <span className="text-[#AEB4BD]">AI Reasoning Loop</span>
            <span className="text-[10px] text-[#2EA043]">qwen2.5-coder & Gemini</span>
          </div>

          <div className="my-3 space-y-2 text-xs">
            <div className="rounded-lg border border-hairline bg-[#1A1D24] p-2.5">
              <div className="text-[10px] font-mono text-[#6E747D]">Prompt</div>
              <p className="mt-0.5 text-[#F4F5F7]">"How does the database migration handle OAuth user tokens?"</p>
            </div>
            <div className="rounded-lg border border-[#2EA043]/30 bg-[#2EA043]/5 p-2.5">
              <div className="text-[10px] font-mono text-[#2EA043]">Reasoned Output</div>
              <p className="mt-0.5 text-[#AEB4BD] text-[11.5px] leading-relaxed">
                "User credentials are encrypted via Fernet symmetric keys in PostgreSQL before persistence."
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-hairline flex items-center justify-between text-[11px] font-mono text-[#6E747D]">
            <span>Capped: 768 tokens</span>
            <span className="text-[#2EA043]">Zero Rate Limit Failures</span>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="relative w-full max-w-lg rounded-2xl border border-hairline bg-[#0E1013] p-6 shadow-2xl overflow-hidden">
      {/* Top Line */}
      <div className="flex items-center justify-between border-b border-hairline pb-4 text-xs font-mono text-[#6E747D]">
        <span className="flex items-center gap-2 text-[#AEB4BD]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2EA043] animate-pulse" />
          One codebase. Every reader.
        </span>
        <Layers size={14} className="text-[#6E747D]" />
      </div>

      {/* 3D Stage with stacked card preview */}
      <div className="relative my-6 h-[260px] w-full perspective-[1000px]">
        <div className="relative h-full w-full">
          {readers.map((r, idx) => {
            const isSelected = activeTab === idx;
            const offset = (idx - activeTab + readers.length) % readers.length;
            
            return (
              <motion.div
                key={r.id}
                initial={false}
                animate={{
                  top: offset === 0 ? "0px" : offset === 1 ? "14px" : "28px",
                  left: offset === 0 ? "0px" : offset === 1 ? "10px" : "20px",
                  scale: offset === 0 ? 1 : offset === 1 ? 0.95 : 0.9,
                  zIndex: offset === 0 ? 30 : offset === 1 ? 20 : 10,
                  opacity: offset === 0 ? 1 : offset === 1 ? 0.45 : 0.25,
                }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 h-[220px] w-full rounded-xl border border-hairline-strong shadow-xl overflow-hidden cursor-pointer"
                onClick={() => setActiveTab(idx)}
              >
                {r.sheet}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Reader selector tabs */}
      <div className="grid grid-cols-3 gap-2 border-t border-hairline pt-4" role="group" aria-label="Choose perspective">
        {readers.map((r, idx) => {
          const isSelected = activeTab === idx;
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              onClick={() => setActiveTab(idx)}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-medium transition-all ${
                isSelected
                  ? "border-[#E9EBEF]/40 bg-[#16191E] text-[#F4F5F7] shadow-sm"
                  : "border-transparent bg-transparent text-[#6E747D] hover:bg-[#131518] hover:text-[#AEB4BD]"
              }`}
            >
              <Icon size={14} className={isSelected ? "text-[#E9EBEF]" : "text-[#6E747D]"} />
              <span>{r.name}</span>
            </button>
          );
        })}
      </div>

      {/* Description readout */}
      <div className="mt-4 border-t border-hairline pt-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[#6E747D]">
          {readers[activeTab].surface}
        </div>
        <h4 className="mt-1 text-sm font-semibold text-[#F4F5F7]">
          {readers[activeTab].title}
        </h4>
        <p className="mt-1.5 text-xs leading-relaxed text-[#AEB4BD]">
          {readers[activeTab].desc}
        </p>
        <Link
          to={readers[activeTab].href}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-[#E9EBEF] hover:text-white transition-colors group"
        >
          <span>{readers[activeTab].cta}</span>
          <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
}
