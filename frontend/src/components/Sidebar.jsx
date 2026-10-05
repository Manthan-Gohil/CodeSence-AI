import React, { useRef, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Brain,
  FolderGit2,
  Users,
  LogOut,
  KeyRound,
  CheckCircle2,
  Home,
  ChevronRight,
  Settings,
  Sparkles,
  Cpu,
  Layers,
  X
} from "lucide-react";
import { useLocation, Link } from "react-router-dom";

const RAW_BACKEND = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";
const BACKEND_BASE = RAW_BACKEND.replace(/\/+$/, "");
const api = (path) => `${BACKEND_BASE}${path.startsWith("/") ? path : `/${path}`}`;

const NAV = [
  { label: "Home", href: "/home", icon: Home },
  { label: "AI Chat", href: "/ai", icon: Brain },
  { label: "Repository Explorer", href: "/repo", icon: FolderGit2 },
  { label: "Feedback & Notes", href: "/feedback", icon: Users }
];

const Sidebar = ({ open, setOpen, onLogout }) => {
  const { user, logout, provider, setProvider } = useAuth();
  
  const avatar = user?.avatar_url || user?.picture || "/logo.png";
  const location = useLocation();
  const ref = useRef(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [storedApiKey, setStoredApiKey] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState("");
  const [apiKeyValid, setApiKeyValid] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const fetchKey = async () => {
      if (!user?.id) {
        setStoredApiKey("");
        return;
      }
      try {
        const res = await fetch(api("/api/ai/get_api_key"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, provider }) 
        });
        const data = await res.json();
        if (res.ok && data.exists) setStoredApiKey(data.masked_key);
        else setStoredApiKey("");
      } catch {
        setStoredApiKey("");
      }
    };
    fetchKey();
    setApiKeyInput("");
    setShowInput(false);
    setError("");
    setApiKeyValid(false);
    setValidating(false);
  }, [user?.id, provider]);

  const handleValidateKey = async () => {
    const key = apiKeyInput.trim();
    if (!key) {
      setError("Please enter your API key.");
      return;
    }
    if (!user?.id) {
      setError("User not found. Please log in again.");
      return;
    }
    setValidating(true);
    setError("");
    setApiKeyValid(false);
    try {
      const res = await fetch(api("/api/ai/validate_api_key"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          user_id: user.id,
          provider 
        })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setApiKeyValid(true);
        setShowInput(false);
        setApiKeyInput("");
        const keyRes = await fetch(api("/api/ai/get_api_key"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, provider })
        });
        const keyData = await keyRes.json();
        if (keyRes.ok && keyData.exists) setStoredApiKey(keyData.masked_key);
        else setStoredApiKey("");
      } else {
        setError(data.error || "Key validation failed.");
      }
    } catch {
      setError("Network error. Could not validate key.");
    } finally {
      setValidating(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!user?.id) {
      setError("User not found. Please log in again.");
      return;
    }
    setError("");
    setApiKeyValid(false);
    setApiKeyInput("");
    setShowInput(false);

    try {
      const res = await fetch(api("/api/ai/delete_api_key"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, provider })
      });
      const data = await res.json();
      if (res.ok && data.deleted) {
        setStoredApiKey("");
      } else {
        setError(data.detail || "Failed to delete API key.");
      }
    } catch {
      setError("Network error. Could not remove key.");
    }
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, setOpen]);

  return (
    <>
      {/* Floating expand button on right edge */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed top-20 right-0 z-30 flex items-center gap-1.5 rounded-l-lg border-y border-l border-hairline bg-[#131518]/90 px-3 py-2 text-xs font-mono text-[#AEB4BD] backdrop-blur-md shadow-2xl transition-all duration-200 hover:border-[#6E747D] hover:text-[#F4F5F7]"
          title="Open Settings"
          aria-label="Open Settings"
        >
          <Settings className="w-3.5 h-3.5 text-[#AEB4BD]" />
          <span className="hidden sm:inline">settings</span>
        </button>
      )}

      {/* Main Drawer */}
      <div
        ref={ref}
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] border-l border-hairline bg-[#0E1013] text-[#AEB4BD] shadow-2xl transition-transform duration-300 z-50 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline bg-[#131518] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#2EA043]" />
            <span className="label-mono text-xs text-[#F4F5F7]">system controls</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded p-1 text-[#6E747D] hover:bg-[#1A1D24] hover:text-[#F4F5F7] transition-colors"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* User Card */}
        <div className="flex flex-col items-center border-b border-hairline p-6 bg-[#0B0C0E]">
          <img
            src={avatar}
            className="h-16 w-16 rounded-full border border-hairline shadow-md object-cover"
            alt="User"
          />
          <span className="mt-3 text-sm font-semibold text-[#F4F5F7] text-center truncate max-w-full">
            {user?.name || user?.login || user?.email || "Authenticated User"}
          </span>
          <span className="text-[11px] font-mono text-[#6E747D] mt-0.5">{user?.email || "active session"}</span>

          <button
            onClick={onLogout || logout}
            className="mt-4 flex items-center gap-1.5 rounded-lg border border-hairline bg-[#131518] px-4 py-1.5 text-xs font-mono text-[#AEB4BD] hover:border-[#6E747D] hover:text-[#F4F5F7] transition-all"
          >
            <LogOut size={12} />
            <span>sign out</span>
          </button>
        </div>

        {/* Navigation */}
        <div className="p-4 border-b border-hairline">
          <p className="label-mono text-[10px] text-[#6E747D] mb-2 px-2">Navigation</p>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const isActive =
                location.pathname === item.href ||
                (item.href !== "/" && location.pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    isActive
                      ? "border border-hairline bg-[#1A1D24] text-[#F4F5F7]"
                      : "text-[#AEB4BD] hover:bg-[#131518] hover:text-[#F4F5F7]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} className={isActive ? "text-[#E9EBEF]" : "text-[#6E747D]"} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#2EA043]" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Model Selection & Telemetry */}
        <div className="p-4 flex-1 overflow-y-auto">
          <p className="label-mono text-[10px] text-[#6E747D] mb-2 px-2">Inference Engine</p>
          <div className="rounded-xl border border-hairline bg-[#131518] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#F4F5F7] flex items-center gap-2">
                <Sparkles size={14} className="text-[#2EA043]" />
                {provider === "gemini" ? "Google Gemini 2.5 Flash" : "Ollama Qwen2.5-Coder"}
              </span>
              <span className="label-mono text-[9px] text-[#2EA043] border border-[#2EA043]/30 px-1.5 py-0.5 rounded">
                Active
              </span>
            </div>
            
            <p className="text-[11px] text-[#6E747D] leading-relaxed">
              {provider === "gemini"
                ? "Sub-2s neural code reasoning via Google Gemini API with automatic local Ollama fallback on quota exhaustion."
                : "Fully unmetered offline execution via CPU-optimized qwen2.5-coder:1.5b with nomic-embed-text."}
            </p>

            <button
              onClick={() => setProvider(provider === "gemini" ? "ollama" : "gemini")}
              className="w-full rounded border border-hairline bg-[#1A1D24] py-1.5 text-center text-xs font-mono text-[#AEB4BD] hover:border-[#6E747D] hover:text-[#F4F5F7] transition-all"
            >
              Switch to {provider === "gemini" ? "Local Ollama" : "Google Gemini"}
            </button>
          </div>

          {/* API Key management */}
          <div className="mt-4 rounded-xl border border-hairline bg-[#131518] p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#F4F5F7] flex items-center gap-2">
                <KeyRound size={13} className="text-[#6E747D]" />
                API Key Override
              </span>
              {storedApiKey && (
                <span className="label-mono text-[9px] text-[#2EA043]">Configured</span>
              )}
            </div>

            {storedApiKey ? (
              <div className="flex items-center justify-between text-xs font-mono text-[#AEB4BD] pt-1">
                <span>{storedApiKey}</span>
                <button
                  onClick={handleRemoveKey}
                  className="text-[11px] text-[#6E747D] hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </div>
            ) : (
              <div className="pt-1">
                {!showInput ? (
                  <button
                    onClick={() => setShowInput(true)}
                    className="text-xs font-mono text-[#6E747D] hover:text-[#AEB4BD] underline transition-colors"
                  >
                    + Add personal {provider.toUpperCase()} key
                  </button>
                ) : (
                  <div className="space-y-2 pt-1">
                    <input
                      type="password"
                      placeholder={`Enter ${provider} key`}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="w-full rounded border border-hairline bg-[#0B0C0E] px-2.5 py-1.5 text-xs text-[#F4F5F7] placeholder-[#6E747D] outline-none focus:border-[#6E747D]"
                    />
                    {error && <div className="text-[11px] text-red-400">{error}</div>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleValidateKey}
                        disabled={validating}
                        className="rounded bg-[#F4F5F7] px-3 py-1 text-xs font-mono font-semibold text-[#0B0C0E] hover:bg-white"
                      >
                        {validating ? "Saving..." : "Save Key"}
                      </button>
                      <button
                        onClick={() => setShowInput(false)}
                        className="rounded border border-hairline px-3 py-1 text-xs font-mono text-[#6E747D]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-hairline bg-[#0B0C0E] p-4 text-[10px] font-mono text-[#6E747D] flex justify-between items-center">
          <span>CodeSense AI v2.0</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2EA043]" />
            Docker Compose Online
          </span>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;