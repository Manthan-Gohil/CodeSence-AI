import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ReaderPrism from "../components/ReaderPrism";
import MachineLens from "../components/MachineLens";
import { MessageSquare, GitBranch, Terminal, ArrowRight, ArrowUpRight, Cpu, Layers, Sparkles, CheckCircle2 } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const capabilities = [
    {
      num: "01",
      title: "neural code chat & rag",
      desc: "conversational comprehension over entire repositories — context-assembled prompt engineering, citations, and sub-3s answer generation",
      href: "/ai"
    },
    {
      num: "02",
      title: "ast dependency & file graph",
      desc: "parse imports, dependencies, language breakdowns, and directory trees without cloning the code locally",
      href: "/repo"
    },
    {
      num: "03",
      title: "multi-model fallback & resilience",
      desc: "seamless routing between Google Gemini 2.5 Flash and local Ollama Qwen2.5-Coder with zero rate limit exceptions",
      href: "/ai"
    },
    {
      num: "04",
      title: "real-time monaco editor preview",
      desc: "inspect repository files side-by-side with semantic search results and syntax highlighting",
      href: "/repo"
    }
  ];

  return (
    <div className="relative min-h-screen bg-ambient text-[#AEB4BD] flex flex-col">
      {/* Sticky Frosted Navbar */}
      <Navbar onOpenSidebar={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* Main Content Spine */}
      <div className="flex-1">
        {/* --- HERO SECTION --- */}
        <section className="relative overflow-hidden border-b border-hairline">
          <div className="mx-auto max-w-[1440px] px-6 py-16 md:px-10 md:py-24">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
              
              {/* Left Column: Copy */}
              <div className="flex flex-col items-start text-left">
                {/* Kicker */}
                <p className="label-mono mb-4 text-[#6E747D]">
                  <span className="block">CodeSense AI / Neural Codebase Intelligence</span>
                </p>

                {/* Editorial Headline */}
                <h1 className="text-[clamp(2.5rem,2rem+3vw,4.5rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[#F4F5F7]">
                  Codebases didn't<br />
                  die. They{" "}
                  <span className="relative inline-block">
                    <em className="chrome-text not-italic">multiplied</em>.
                  </span>
                </h1>

                {/* Lede */}
                <p className="mt-6 max-w-[48ch] text-[16px] md:text-[18px] leading-relaxed text-[#AEB4BD]">
                  Repository comprehension spanning every layer a machine or developer reads. From public GitHub URL through vector indexation to instant reasoned answers — one click, no manual setup.
                </p>

                {/* Action Buttons */}
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    to="/ai"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#F4F5F7] px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#0B0C0E] transition-all duration-200 hover:bg-white hover:shadow-lg hover:shadow-white/10"
                  >
                    <span>Launch AI Chat</span>
                    <ArrowRight size={14} />
                  </Link>

                  <Link
                    to="/repo"
                    className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-[#131518] px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#F4F5F7] transition-all duration-200 hover:border-[#6E747D] hover:bg-[#1A1D24]"
                  >
                    <span>Explore Repository</span>
                    <ArrowUpRight size={14} />
                  </Link>
                </div>

                {/* Micro Meta */}
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono text-[#6E747D]">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2EA043]" />
                    Qwen2.5-Coder (1.5B) + Gemini Flash
                  </span>
                  <span>·</span>
                  <span>768-dim FAISS Vectors</span>
                  <span>·</span>
                  <span>Sub-3s Response</span>
                </div>
              </div>

              {/* Right Column: Interactive Reader Prism */}
              <div className="flex justify-center lg:justify-end">
                <ReaderPrism />
              </div>

            </div>

            {/* Hero Foot Strip */}
            <div className="mt-16 flex flex-wrap items-center justify-between border-t border-hairline pt-6 text-xs font-mono text-[#6E747D]">
              <span>RAG Pipeline <span className="opacity-40">/</span> FAISS Vector Index <span className="opacity-40">/</span> Ollama CPU Engine <span className="opacity-40">/</span> Google Gemini</span>
              <a href="#the-thesis" className="flex items-center gap-1.5 text-[#AEB4BD] hover:text-white transition-colors">
                Follow the signal ↓
              </a>
            </div>
          </div>
        </section>

        {/* --- BODY SECTIONS WITH VERTICAL SPINE --- */}
        <div className="relative mx-auto max-w-[1440px] px-6 md:px-10">
          
          {/* Vertical Trace Line (Jamie McKaye spine) */}
          <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 hidden h-full w-12 md:block" fill="none">
            <defs>
              <linearGradient id="trace-chrome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4B515D" />
                <stop offset="50%" stopColor="#E9EBEF" />
                <stop offset="100%" stopColor="#4B515D" />
              </linearGradient>
            </defs>
            <path d="M 24 0 V 10000" stroke="url(#trace-chrome)" strokeWidth="1.5" />
          </svg>

          <div className="md:pl-14">

            {/* --- SECTION 1: THE THESIS --- */}
            <section id="the-thesis" className="relative scroll-mt-20 border-b border-hairline py-20 md:py-28">
              {/* Pulsing Trace Node */}
              <span aria-hidden="true" className="absolute -left-14 top-12 hidden h-[9px] w-[9px] border border-hairline-strong bg-[#131518] animate-trace-node md:block" />

              <p className="label-mono mb-6 text-[#6E747D]">the thesis</p>
              <h2 className="max-w-[28ch] text-[clamp(1.8rem,1.5rem+1.8vw,2.8rem)] font-semibold leading-[1.15] tracking-[-0.02em] text-[#F4F5F7]">
                Codebases multiplied — microservices, monorepos, dependencies. Legibility stopped being manual reading and became an{" "}
                <span className="chrome-text">engineering discipline</span>.
              </h2>

              <div className="mt-12 grid gap-px bg-hairline md:grid-cols-3 rounded-xl overflow-hidden border border-hairline">
                <div className="bg-[#0B0C0E] p-8 md:pr-10">
                  <p className="label-mono mb-3 text-[11px] text-[#AEB4BD]">one click</p>
                  <p className="max-w-[34ch] text-[14.5px] leading-relaxed text-[#AEB4BD]">
                    Input any public GitHub repository URL. Files are downloaded, chunked, and vector-embedded automatically in under 15 seconds.
                  </p>
                </div>
                <div className="bg-[#0B0C0E] p-8 md:pr-10">
                  <p className="label-mono mb-3 text-[11px] text-[#AEB4BD]">instrumented</p>
                  <p className="max-w-[34ch] text-[14.5px] leading-relaxed text-[#AEB4BD]">
                    Every response is grounded in real source chunks retrieved via FAISS vector similarity. Zero hallucinations, verified citations.
                  </p>
                </div>
                <div className="bg-[#0B0C0E] p-8 md:pr-10">
                  <p className="label-mono mb-3 text-[11px] text-[#AEB4BD]">sub-3s latency</p>
                  <p className="max-w-[34ch] text-[14.5px] leading-relaxed text-[#AEB4BD]">
                    Backed by local Qwen2.5-Coder (1.5B) for unmetered local execution and Google Gemini Flash for lightning cloud reasoning.
                  </p>
                </div>
              </div>
            </section>

            {/* --- SECTION 2: THREE DOORS --- */}
            <section className="relative border-b border-hairline py-20 md:py-28">
              <span aria-hidden="true" className="absolute -left-14 top-12 hidden h-[9px] w-[9px] border border-hairline-strong bg-[#131518] animate-trace-node md:block" />

              <p className="label-mono mb-8 text-[#6E747D]">three doors</p>

              <div className="grid gap-px bg-hairline md:grid-cols-3 rounded-xl overflow-hidden border border-hairline">
                
                {/* Door 01 */}
                <Link
                  to="/ai"
                  className="group relative flex flex-col justify-between bg-[#0B0C0E] p-8 md:p-10 no-underline transition-all duration-300 hover:bg-[#131518]"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-[#4B515D] via-[#E9EBEF] to-[#4B515D] transition-transform duration-500 ease-out group-hover:scale-x-100" />
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-xs text-[#6E747D]">01</span>
                      <span className="font-mono text-sm text-[#6E747D] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#F4F5F7]">→</span>
                    </div>
                    <h3 className="mt-6 text-xl font-semibold tracking-[-0.015em] text-[#F4F5F7]">The Chat</h3>
                    <p className="mt-4 text-[14.5px] leading-relaxed text-[#AEB4BD]">
                      Ask complex questions across hundreds of files. Get instant architectural overviews, bug traces, and implementation roadmaps.
                    </p>
                  </div>
                  <p className="label-mono mt-8 text-[11px] text-[#6E747D] group-hover:text-[#AEB4BD] transition-colors">
                    neural rag · multi-model
                  </p>
                </Link>

                {/* Door 02 */}
                <Link
                  to="/repo"
                  className="group relative flex flex-col justify-between bg-[#0B0C0E] p-8 md:p-10 no-underline transition-all duration-300 hover:bg-[#131518]"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-[#4B515D] via-[#E9EBEF] to-[#4B515D] transition-transform duration-500 ease-out group-hover:scale-x-100" />
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-xs text-[#6E747D]">02</span>
                      <span className="font-mono text-sm text-[#6E747D] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#F4F5F7]">→</span>
                    </div>
                    <h3 className="mt-6 text-xl font-semibold tracking-[-0.015em] text-[#F4F5F7]">The Tree</h3>
                    <p className="mt-4 text-[14.5px] leading-relaxed text-[#AEB4BD]">
                      Visual file structure, AST dependency imports, and code syntax highlighting without needing to run `git clone`.
                    </p>
                  </div>
                  <p className="label-mono mt-8 text-[11px] text-[#6E747D] group-hover:text-[#AEB4BD] transition-colors">
                    ast graph · file inspection
                  </p>
                </Link>

                {/* Door 03 */}
                <Link
                  to="/feedback"
                  className="group relative flex flex-col justify-between bg-[#0B0C0E] p-8 md:p-10 no-underline transition-all duration-300 hover:bg-[#131518]"
                >
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-[#4B515D] via-[#E9EBEF] to-[#4B515D] transition-transform duration-500 ease-out group-hover:scale-x-100" />
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-xs text-[#6E747D]">03</span>
                      <span className="font-mono text-sm text-[#6E747D] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#F4F5F7]">→</span>
                    </div>
                    <h3 className="mt-6 text-xl font-semibold tracking-[-0.015em] text-[#F4F5F7]">The Notes & Lab</h3>
                    <p className="mt-4 text-[14.5px] leading-relaxed text-[#AEB4BD]">
                      Developer feedback, performance diagnostics, benchmark readouts, and architectural telemetry.
                    </p>
                  </div>
                  <p className="label-mono mt-8 text-[11px] text-[#6E747D] group-hover:text-[#AEB4BD] transition-colors">
                    telemetry · direct line
                  </p>
                </Link>

              </div>
            </section>

            {/* --- SECTION 3: CAPABILITY INDEX --- */}
            <section className="relative border-b border-hairline py-20 md:py-28">
              <span aria-hidden="true" className="absolute -left-14 top-12 hidden h-[9px] w-[9px] border border-hairline-strong bg-[#131518] animate-trace-node md:block" />

              <p className="label-mono mb-8 text-[#6E747D]">capability index</p>

              <div className="divide-y divide-hairline">
                {capabilities.map((cap) => (
                  <Link
                    key={cap.num}
                    to={cap.href}
                    className="group flex items-baseline justify-between gap-6 py-6.5 no-underline transition-colors hover:bg-[#131518]/30 px-3 -mx-3 rounded-lg"
                  >
                    <span className="flex min-w-0 items-baseline gap-6">
                      <span className="font-mono text-xs text-[#6E747D]">{cap.num}</span>
                      <span className="min-w-0">
                        <span className="block text-[clamp(1.25rem,1.1rem+1vw,1.85rem)] font-semibold tracking-[-0.02em] text-[#AEB4BD] transition-colors duration-300 group-hover:text-[#F4F5F7]">
                          {cap.title}
                        </span>
                        <span className="mt-1.5 block max-w-[68ch] font-mono text-[11.5px] leading-relaxed text-[#6E747D]">
                          {cap.desc}
                        </span>
                      </span>
                    </span>
                    <span className="font-mono text-sm text-[#6E747D] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#F4F5F7]">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            {/* --- SECTION 4: THE MACHINE LENS --- */}
            <section className="relative border-b border-hairline py-20 md:py-28">
              <span aria-hidden="true" className="absolute -left-14 top-12 hidden h-[9px] w-[9px] border border-hairline-strong bg-[#131518] animate-trace-node md:block" />

              <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
                <p className="label-mono text-[#6E747D]">the machine lens</p>
                <p className="label-mono text-[10px] text-[#6E747D]">same repository · three live representations</p>
              </div>

              <MachineLens />
            </section>

            {/* --- SECTION 5: CTA DIRECT LINE PANEL --- */}
            <section className="relative py-20 md:py-28">
              <span aria-hidden="true" className="absolute -left-14 top-12 hidden h-[9px] w-[9px] border border-hairline-strong bg-[#131518] animate-trace-node md:block" />

              <div className="flex flex-wrap items-center justify-between gap-8 rounded-2xl border border-hairline-strong bg-[#0E1013] p-8 md:p-12 shadow-2xl">
                <div>
                  <p className="label-mono text-xs text-[#6E747D]">the direct line</p>
                  <h3 className="mt-3 max-w-[32ch] text-2xl font-bold tracking-[-0.02em] text-[#F4F5F7]">
                    Ready to understand your entire repository in under three seconds?
                  </h3>
                  <p className="mt-2 max-w-[48ch] text-sm text-[#AEB4BD]">
                    Paste any public GitHub repository URL into the chat and explore immediately. No cloning, no configuration.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link
                    to="/ai"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#F4F5F7] px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#0B0C0E] transition-all hover:bg-white hover:shadow-lg"
                  >
                    <span>Launch AI Chat</span>
                    <ArrowRight size={14} />
                  </Link>

                  <Link
                    to="/repo"
                    className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-[#131518] px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#F4F5F7] transition-all hover:border-[#6E747D] hover:bg-[#1A1D24]"
                  >
                    <span>Explore Repo</span>
                  </Link>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* --- MINIMALIST EDITORIAL FOOTER --- */}
      <footer className="border-t border-hairline bg-[#08090B] py-10">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-6 md:flex-row md:px-10 text-xs font-mono text-[#6E747D]">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[#F4F5F7]">
              codesense<span className="chrome-text">.ai</span>
            </span>
            <span>·</span>
            <span>&copy; {new Date().getFullYear()} CodeSense AI. All systems operational.</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-[#AEB4BD]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2EA043]" />
              Docker Network Active
            </span>
            <Link to="/feedback" className="hover:text-[#F4F5F7] transition-colors">feedback</Link>
            <Link to="/ai" className="hover:text-[#F4F5F7] transition-colors">chat</Link>
            <Link to="/repo" className="hover:text-[#F4F5F7] transition-colors">repo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
