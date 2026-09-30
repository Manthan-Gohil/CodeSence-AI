import React, { useRef, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Brain,
  FolderGit2,
  Users,
  LogOut,
  KeyRound,
  XCircle,
  CheckCircle2,
  Home,
  ChevronRight,
  Settings,
  Sparkles
} from "lucide-react";

import { useLocation, Link } from "react-router-dom";

const RAW_BACKEND = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";
const BACKEND_BASE = RAW_BACKEND.replace(/\/+$/, "");
const api = (path) => `${BACKEND_BASE}${path.startsWith("/") ? path : `/${path}`}`;

const NAV = [
  { label: "Home", href: "/home", icon: Home },
  { label: "AI", href: "/ai", icon: Brain },
  { label: "Repo", href: "/repo", icon: FolderGit2 },
  { label: "Feedback", href: "/feedback", icon: Users }
];

const ToggleSwitch = ({ label, isOn, onToggle }) => (
  <button
    onClick={onToggle}
    className={`flex items-center w-full px-3 py-2 rounded-lg transition-colors ${
      isOn ? "bg-[#238636] text-white" : "bg-[#161b22] text-gray-300 hover:bg-[#20252b]"
    }`}
  >
    <span className={`flex-1 text-left font-semibold`}>{label}</span>
    <div className={`relative w-10 h-5 flex items-center rounded-full transition-all ${isOn ? "bg-green-300" : "bg-gray-500"}`}>
      <div
        className={`absolute w-4 h-4 bg-white rounded-full shadow-md transition-transform ${
          isOn ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </div>
  </button>
);
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
          body: JSON.stringify({ user_id: user.id, provider }) // Uses global provider
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
        body: JSON.stringify({ user_id: user.id, provider }) // Uses global provider
      });
      const data = await res.json();
      if (res.ok && data.deleted) {
        setStoredApiKey("");
      } else {
        setError(data.detail || "Failed to delete API key from server.");
      }
    } catch {
      setError("Network error. Could not remove key from server.");
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
      {/* Floating expand button on right edge when sidebar is minimized */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed top-16 right-0 z-30 flex items-center gap-1.5 px-3 py-2 bg-[#20252b] hover:bg-[#238636] text-gray-300 hover:text-white rounded-l-xl border-l border-t border-b border-gray-700/80 shadow-2xl transition-all duration-200 cursor-pointer group text-xs font-semibold"
          title="Open AI & Settings Sidebar"
          aria-label="Open AI and Settings Sidebar"
        >
          <Settings className="w-4 h-4 text-[#2ea043] group-hover:text-white transition-colors" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      )}

      <div
        ref={ref}
        className={`fixed top-0 right-0 h-full bg-gradient-to-br from-[#23272f] to-[#181b20] text-gray-100 shadow-2xl transition-transform duration-300 z-50 border-l border-gray-800 ${
          open ? "translate-x-0" : "translate-x-full"
        } rounded-l-3xl overflow-y-auto w-72 max-w-[85vw] flex flex-col`}
      >
        {/* Minimize Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-800/80">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#2ea043]" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Settings & AI</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-400 hover:text-white bg-[#161b22] hover:bg-[#21262d] rounded-lg border border-gray-700/60 transition cursor-pointer"
            title="Minimize sidebar"
            aria-label="Minimize sidebar"
          >
            <span>Minimize</span>
            <ChevronRight className="w-4 h-4 text-[#2ea043]" />
          </button>
        </div>

        <div className="flex flex-col items-center mt-6 mb-6">
          <img src={avatar} className="h-16 w-16 rounded-full border-4 border-[#238636] shadow-lg" alt="User" />
          <span className="mt-3 text-lg font-semibold text-gray-200 break-all text-center">
            {user?.name || user?.login || user?.email}
          </span>
          <span className="text-xs text-gray-400 mb-2">{user?.email || ""}</span>
          <button
            onClick={onLogout || logout}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-[#238636] hover:bg-[#2ea043] text-white font-bold transition-all shadow mt-2"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>

        <nav className="flex flex-col gap-2 px-3">
          {NAV.map((item) => {
            const isActive =
              location.pathname === item.href ||
              (item.href !== "/" && location.pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-2 rounded-2xl text-base font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-[#21262d] text-[#238636] shadow border border-[#238636] font-bold"
                    : "hover:bg-[#232b36] hover:text-[#238636] text-gray-300"
                }`}
              >
                <Icon className="w-5 h-5" /> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-gray-700 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">AI Engine</span>
          </div>

          <div className="p-3 rounded-xl bg-[#161b22] border border-emerald-500/30 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                Google Gemini
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                Default
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Powered by Google Gemini LLM via server configuration for high-speed neural code comprehension.
            </p>

            <div className="mt-1 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
              <span>Status</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Connected
              </span>
            </div>
          </div>
        </div>
      </div>


      {open && (
        <div
          className="fixed inset-0 z-30 backdrop-blur-[2px] bg-black/30"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;