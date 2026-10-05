// src/pages/Ai.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import LoadingScreen from "../components/LoadingScreen";
import { useAuth } from "../context/AuthContext";
import RepoPanel from "../components/RepoPanel";
import ChatPanel from "../components/ChatPanel";
import { Github, FolderGit2, Sparkles, Terminal, ArrowRight, CheckCircle2, Layers, Cpu } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";

const loadingMessages = {
  ingest: [
    "Fetching repository archive from GitHub API…",
    "Parsing AST syntax trees & dependencies…",
    "Generating 768-dim batched vector embeddings…",
    "Indexing chunks in FAISS vector store…",
    "Assembling repository neural memory…"
  ],
  chatHistory: [
    "Retrieving conversation memory…",
    "Loading encrypted vector history…"
  ],
  switchRepo: [
    "Deallocating active repository context…",
    "Preparing clean vector environment…"
  ],
  deleteMessage: [
    "Purging record from PostgreSQL…"
  ],
  restore: [
    "Restoring previous repository session…"
  ]
};

/** Inline progress UI with checkpoints */
function IngestProgress({ visible, progress, checkpoints, onCancel }) {
  if (!visible) return null;
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl border border-hairline-strong bg-[#0E1013] p-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <div>
            <span className="label-mono text-[#6E747D]">indexing pipeline</span>
            <h3 className="mt-1 text-base font-semibold text-[#F4F5F7]">Vectorizing Repository Codebase</h3>
          </div>
          <button
            className="rounded border border-hairline bg-[#131518] px-3 py-1 text-xs font-mono text-[#6E747D] hover:text-[#F4F5F7] transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-xs font-mono text-[#6E747D] mb-2">
            <span>Progress Status</span>
            <span className="text-[#F4F5F7]">{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#131518] border border-hairline overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#6E747D] via-[#E9EBEF] to-[#2EA043] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Checkpoint checklist */}
        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {checkpoints.map((cp, idx) => (
            <li
              key={idx}
              className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-xs font-mono transition-all ${
                cp.done
                  ? "border-hairline-strong bg-[#131518] text-[#F4F5F7]"
                  : "border-hairline bg-[#0B0C0E] text-[#6E747D]"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${cp.done ? "bg-[#2EA043]" : "bg-[#4B515D]"}`} />
              <span className="truncate">{cp.label}</span>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-[11px] font-mono text-[#6E747D] leading-relaxed border-t border-hairline pt-4">
          Chat becomes active once the FAISS vector index is populated with chunks. Sub-3s response guaranteed.
        </p>
      </div>
    </div>
  );
}

export default function Ai() {
  const { user, logout, provider } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [apiKeyExists, setApiKeyExists] = useState(undefined);
  const [repoData, setRepoData] = useState(null);
  const [chat, setChat] = useState([
    { sender: "ai", text: "Paste a public GitHub repo URL above to index its architecture and start chatting.", avatar: "/logo.png" }
  ]);
  const [msg, setMsg] = useState("");
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [globalLoading, setGlobalLoading] = useState({ show: false, messages: ["Loading..."], subtext: "" });
  const [submitted, setSubmitted] = useState(false);

  const chatRef = useRef();

  // Ingest progress UI state
  const [showIngestOverlay, setShowIngestOverlay] = useState(false);
  const [ingestProgress, setIngestProgress] = useState(0);
  const initialCheckpoints = useMemo(
    () => [
      { key: "kickoff", label: "Request dispatched", done: false },
      { key: "streaming", label: "Downloading archive files", done: false },
      { key: "chunking", label: "Token-aware chunking", done: false },
      { key: "upserting", label: "Batched vector embeddings", done: false },
      { key: "analytics", label: "AST graph & metrics", done: false },
      { key: "ready", label: "Neural memory ready", done: false }
    ],
    []
  );
  const [checkpoints, setCheckpoints] = useState(initialCheckpoints);
  const progressTimerRef = useRef(null);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    async function checkKey() {
      if (!user?.id) {
        setApiKeyExists(false);
        return;
      }
      try {
        const res = await fetch(`${BACKEND_URL}/api/ai/get_api_key`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, provider }),
        });
        const data = await res.json();
        setApiKeyExists(res.ok && data.exists);
      } catch {
        setApiKeyExists(false);
      }
    }
    checkKey();
  }, [user, provider]);

  useEffect(() => {
    async function restoreActiveRepo() {
      if (!user?.id) return;
      try {
        const res = await fetch(`${BACKEND_URL}/api/repo/get_active_repo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.repo_url) {
          setRepoUrl(data.repo_url);
          setSubmitted(true);
          await fetchRepoMeta(data.repo_url);
          await fetchUserChatHistory(user.id);
        }
      } catch {}
    }
    restoreActiveRepo();
  }, [user]);

  async function fetchUserChatHistory(userId) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/get_chat_history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setChat(
            data.messages.map((m) => ({
              id: m.id,
              sender: m.role === "user" ? "user" : "ai",
              text: m.content,
              avatar: m.role === "user" ? (user?.avatar_url || user?.picture || "/logo.png") : "/logo.png"
            }))
          );
        } else {
          setChat([
            { sender: "ai", text: "Repository indexed. Ask any questions about its structure, logic, or dependencies.", avatar: "/logo.png" }
          ]);
        }
      }
    } catch {}
  }

  async function fetchRepoMeta(url) {
    if (!user?.id) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/repo/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, repo_url: url }),
      });
      if (!res.ok) {
        setRepoData(null);
        return;
      }

      const data = await res.json();
      const analytics = data.analytics;

      setRepoData({
        name: analytics.repo_name,
        owner: analytics.owner,
        avatar_url: analytics.contributors?.[0]?.avatar_url || "/logo.png",
        stars: analytics.stars,
        forks: analytics.forks,
        description: analytics.description,
        html_url: `https://github.com/${analytics.owner}/${analytics.repo_name}`,
        homepage: analytics.homepage,
        main_language: analytics.languages ? Object.keys(analytics.languages)[0] : "Code",
        license: analytics.license,
        topics: analytics.topics || [],
        profile: {
          name: analytics.owner,
          avatar_url: analytics.contributors?.[0]?.avatar_url || "/logo.png",
          github: `https://github.com/${analytics.owner}`,
        },
      });
    } catch {
      setRepoData(null);
    }
  }

  function startProgressUI() {
    setShowIngestOverlay(true);
    setIngestProgress(10);
    setCheckpoints((prev) => prev.map(c => c.key === "kickoff" ? { ...c, done: true } : c));
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setIngestProgress((p) => (p < 92 ? p + 2 : p));
    }, 300);
    setTimeout(() => setCheckpoints((prev) => prev.map(c => c.key === "streaming" ? { ...c, done: true } : c)), 800);
    setTimeout(() => setCheckpoints((prev) => prev.map(c => c.key === "chunking" ? { ...c, done: true } : c)), 2200);
    setTimeout(() => setCheckpoints((prev) => prev.map(c => c.key === "upserting" ? { ...c, done: true } : c)), 3800);
  }

  function stopProgressUI(finalizeReady = false) {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (finalizeReady) {
      setIngestProgress(100);
      setCheckpoints((prev) =>
        prev.map((c) =>
          c.key === "analytics" || c.key === "ready" ? { ...c, done: true } : c
        )
      );
      setTimeout(() => setShowIngestOverlay(false), 500);
    } else {
      setShowIngestOverlay(false);
    }
  }

  async function handleRepoSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!repoUrl.trim()) {
      alert("Please enter a GitHub repository URL.");
      return;
    }
    setLoadingRepo(true);
    setCheckpoints(initialCheckpoints);
    startProgressUI();

    try {
      const res = await fetch(`${BACKEND_URL}/api/repo/ingest_repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          repo_url: repoUrl,
          provider: provider,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Ingestion failed.");
      }

      // Poll metadata
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const r = await fetch(`${BACKEND_URL}/api/repo/metadata`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id }),
          });
          if (r.ok) {
            const meta = await r.json();
            if (meta?.analytics?.repo_name) {
              setCheckpoints((prev) => prev.map(c => c.key === "analytics" ? { ...c, done: true } : c));
              await fetchRepoMeta(repoUrl);
              await fetchUserChatHistory(user.id);
              setSubmitted(true);
              setCheckpoints((prev) => prev.map(c => c.key === "ready" ? { ...c, done: true } : c));
              stopProgressUI(true);
            }
          }
        } catch {}
      }, 1000);
    } catch (err) {
      alert("Error ingesting repository: " + err.message);
      setSubmitted(false);
      stopProgressUI(false);
    } finally {
      setLoadingRepo(false);
    }
  }

  async function handleSend(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!msg.trim() || !user || !repoData) return;

    const newChat = [
      ...chat,
      { sender: "user", text: msg, avatar: user.avatar_url || user.picture || "/logo.png" }
    ];
    setChat(newChat);
    const sentMsg = msg;
    setMsg("");
    setLoadingChat(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          message: sentMsg,
          provider: provider,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChat((prev) => [
          ...prev,
          { sender: "ai", text: data.result, avatar: "/logo.png" }
        ]);
        await fetchUserChatHistory(user.id);
      } else {
        setChat((prev) => [
          ...prev,
          { sender: "ai", text: "Error: " + (data.detail || "Could not get AI answer."), avatar: "/logo.png" }
        ]);
      }
    } catch {
      setChat((prev) => [
        ...prev,
        { sender: "ai", text: "Network error while calling neural reasoning engine.", avatar: "/logo.png" }
      ]);
    } finally {
      setLoadingChat(false);
    }
  }

  async function handleNewRepo() {
    if (!user?.id) return;
    try {
      await fetch(`${BACKEND_URL}/api/repo/switch_repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
    } catch {}
    setSubmitted(false);
    setRepoData(null);
    setRepoUrl("");
    setChat([{ sender: "ai", text: "Repository cleared. Enter a new GitHub URL to analyze.", avatar: "/logo.png" }]);
  }

  async function handleDeleteMessage(msgId) {
    if (!user?.id || !msgId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/delete_message?msg_id=${encodeURIComponent(msgId)}&user_id=${encodeURIComponent(user.id)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setChat((prev) => prev.filter((m) => m.id !== msgId));
      }
    } catch {}
  }

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-ambient text-[#AEB4BD] flex flex-col overflow-hidden">
      {globalLoading.show && (
        <LoadingScreen messages={globalLoading.messages} subtext={globalLoading.subtext} />
      )}

      {/* Ingest Progress Modal */}
      <IngestProgress
        visible={showIngestOverlay}
        progress={ingestProgress}
        checkpoints={checkpoints}
        onCancel={() => stopProgressUI(false)}
      />

      <Navbar onOpenSidebar={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} onLogout={logout} />

      <main className="flex-1 flex flex-col p-4 md:p-8 max-w-[1440px] mx-auto w-full">
        {!submitted ? (
          /* Unindexed State — Minimal Ingest Terminal */
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="w-full max-w-2xl rounded-2xl border border-hairline-strong bg-[#0E1013] p-8 md:p-12 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E9EBEF]/40 to-transparent" />

              <div className="text-center">
                <span className="label-mono text-xs text-[#6E747D]">repository ingest gateway</span>
                <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-[-0.02em] text-[#F4F5F7]">
                  Analyze Any GitHub Repository with <span className="chrome-text">AI</span>
                </h2>
                <p className="mt-3 text-xs md:text-sm text-[#AEB4BD] leading-relaxed max-w-lg mx-auto">
                  Instant token-aware chunking, 768-dim FAISS vector search, and sub-3s reasoning via Google Gemini 2.5 Flash and local Qwen-Coder.
                </p>
              </div>

              {/* Form Bar */}
              <form onSubmit={handleRepoSubmit} className="mt-8 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="url"
                    placeholder="https://github.com/owner/repository"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    required
                    disabled={loadingRepo}
                    className="w-full rounded-xl border border-hairline bg-[#131518] px-4 py-3 text-xs md:text-sm text-[#F4F5F7] placeholder-[#6E747D] outline-none transition-all focus:border-[#6E747D] focus:ring-1 focus:ring-[#6E747D]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingRepo || !repoUrl.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4F5F7] px-6 py-3 text-xs font-mono font-semibold uppercase text-[#0B0C0E] transition-all hover:bg-white hover:shadow-lg disabled:opacity-40"
                >
                  <span>{loadingRepo ? "Vectorizing..." : "Index Repo"}</span>
                  <ArrowRight size={14} />
                </button>
              </form>

              {/* Example Shortcuts */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#6E747D]">
                <span>Sample repositories:</span>
                <button
                  type="button"
                  onClick={() => setRepoUrl("https://github.com/Manthan-Gohil/PixelLearn-Coding-Platform")}
                  className="rounded border border-hairline bg-[#131518] px-2 py-0.5 text-[#AEB4BD] hover:border-[#6E747D] hover:text-[#F4F5F7] transition-all"
                >
                  PixelLearn-Coding-Platform
                </button>
                <button
                  type="button"
                  onClick={() => setRepoUrl("https://github.com/expressjs/express")}
                  className="rounded border border-hairline bg-[#131518] px-2 py-0.5 text-[#AEB4BD] hover:border-[#6E747D] hover:text-[#F4F5F7] transition-all"
                >
                  expressjs/express
                </button>
              </div>

              {/* Feature telemetry */}
              <div className="mt-8 grid grid-cols-3 gap-3 border-t border-hairline pt-6 text-center">
                <div className="rounded-xl border border-hairline bg-[#131518]/40 p-3">
                  <div className="label-mono text-[9px] text-[#6E747D]">Batch Embedding</div>
                  <div className="mt-1 text-xs font-semibold text-[#F4F5F7]">32 chunks / sec</div>
                </div>
                <div className="rounded-xl border border-hairline bg-[#131518]/40 p-3">
                  <div className="label-mono text-[9px] text-[#6E747D]">Vector Storage</div>
                  <div className="mt-1 text-xs font-semibold text-[#F4F5F7]">Persistent FAISS</div>
                </div>
                <div className="rounded-xl border border-hairline bg-[#131518]/40 p-3">
                  <div className="label-mono text-[9px] text-[#6E747D]">Quota Shield</div>
                  <div className="mt-1 text-xs font-semibold text-[#F4F5F7]">Auto Fallback</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Indexed State — Split Panel View */
          <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
            {repoData && <RepoPanel repoData={repoData} handleNewRepo={handleNewRepo} />}
            <ChatPanel
              chat={chat}
              msg={msg}
              setMsg={setMsg}
              loadingChat={loadingChat}
              onSend={handleSend}
              canChat={true}
              chatRef={chatRef}
              onDeleteMessage={handleDeleteMessage}
            />
          </div>
        )}
      </main>
    </div>
  );
}
