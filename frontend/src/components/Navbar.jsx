import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Command, Search, Sparkles, FolderGit2, MessageSquare, Terminal, KeyRound, LogOut, ArrowRight, X } from "lucide-react";

export default function Navbar({ onOpenSidebar }) {
  const { user, logout, provider, setProvider } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const navLinks = [
    { label: "home", href: "/home" },
    { label: "ai chat", href: "/ai" },
    { label: "repo explorer", href: "/repo" },
    { label: "feedback", href: "/feedback" }
  ];

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const commandItems = [
    { title: "Open AI Chat", description: "Query active repository with Gemini or local Ollama", icon: MessageSquare, action: () => navigate("/ai") },
    { title: "Explore Code & Tree", description: "Inspect file hierarchy, AST dependencies & contributors", icon: FolderGit2, action: () => navigate("/repo") },
    { title: "Send Feedback", description: "Report a bug or feature request", icon: Terminal, action: () => navigate("/feedback") },
    { title: "Toggle Model Provider", description: `Current: ${provider.toUpperCase()}`, icon: Sparkles, action: () => setProvider(provider === "gemini" ? "ollama" : "gemini") },
    { title: "Manage Settings & Keys", description: "Configure API keys and active repository", icon: KeyRound, action: () => onOpenSidebar && onOpenSidebar() },
  ];

  const filteredItems = commandItems.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-hairline bg-[#0B0C0E]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3.5 md:px-10">
          {/* Brand */}
          <Link to="/home" className="group flex shrink-0 items-baseline gap-3 no-underline">
            <span className="whitespace-nowrap text-[16px] font-semibold tracking-[-0.02em] text-[#F4F5F7]">
              codesense<span className="chrome-text font-bold">.ai</span>
            </span>
            <span className="hidden text-[12px] font-mono text-[#6E747D] transition-colors group-hover:text-[#AEB4BD] lg:inline">
              code intelligence that ships
            </span>
          </Link>

          {/* Navigation links & Command badge */}
          <div className="flex items-center gap-6 md:gap-8">
            <nav aria-label="Primary" className="hidden sm:block">
              <ul className="flex items-baseline gap-6 md:gap-8">
                {navLinks.map((link) => {
                  const isActive = location.pathname === link.href;
                  return (
                    <li key={link.href}>
                      <Link
                        to={link.href}
                        className={`relative text-[13.5px] font-medium tracking-[0.005em] transition-colors duration-200 hover:text-[#F4F5F7] ${
                          isActive ? "text-[#F4F5F7] font-semibold after:w-full" : "text-[#AEB4BD] after:w-0"
                        } after:absolute after:-bottom-1.5 after:left-0 after:h-[1.5px] after:bg-gradient-to-r after:from-[#4B515D] after:via-[#E9EBEF] after:to-[#4B515D] after:transition-all after:duration-300 hover:after:w-full`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* ⌘K Command button */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="⌘K — Open Command Palette"
              className="hidden items-center gap-1.5 rounded border border-hairline bg-[#131518] px-2.5 py-1 text-[11px] font-mono text-[#AEB4BD] transition-all duration-200 hover:border-[#6E747D] hover:text-[#F4F5F7] md:flex"
            >
              <Command size={12} className="text-[#6E747D]" />
              <span className="tracking-widest">⌘K</span>
            </button>

            {/* Profile / Sidebar trigger */}
            {user ? (
              <button
                type="button"
                onClick={onOpenSidebar}
                className="group relative flex items-center gap-2 rounded-full border border-hairline bg-[#131518] p-0.5 pr-2.5 transition-all duration-200 hover:border-[#E9EBEF]/40"
                aria-label="Account & settings"
              >
                <img
                  src={user?.avatar_url || user?.picture || "/logo.png"}
                  alt={user?.name || "User"}
                  className="h-7 w-7 rounded-full object-cover"
                />
                <span className="hidden max-w-[100px] truncate text-xs font-medium text-[#AEB4BD] group-hover:text-[#F4F5F7] md:inline">
                  {user?.name?.split(" ")[0] || "Account"}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#2EA043]" />
              </button>
            ) : (
              <Link
                to="/"
                className="rounded border border-hairline bg-[#131518] px-3.5 py-1.5 text-xs font-medium text-[#F4F5F7] transition-all hover:border-[#6E747D] hover:bg-[#1A1D24]"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Interactive Command Palette Modal */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 pt-[15vh] backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl rounded-xl border border-hairline-strong bg-[#131518] shadow-2xl overflow-hidden">
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
              <Search size={18} className="text-[#6E747D]" />
              <input
                type="text"
                autoFocus
                placeholder="Type a command or navigate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-[#F4F5F7] placeholder-[#6E747D] outline-none"
              />
              <button
                onClick={() => setPaletteOpen(false)}
                className="rounded p-1 text-[#6E747D] hover:bg-[#1A1D24] hover:text-[#F4F5F7]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results list */}
            <div className="max-h-[320px] overflow-y-auto p-2">
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#6E747D]">
                Actions & Quick Navigation
              </div>
              {filteredItems.length > 0 ? (
                filteredItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      item.action();
                      setPaletteOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#1A1D24] group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded border border-hairline bg-[#0B0C0E] p-2 text-[#AEB4BD] group-hover:text-[#F4F5F7]">
                        <item.icon size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[#F4F5F7]">{item.title}</div>
                        <div className="text-[11px] text-[#6E747D]">{item.description}</div>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-[#6E747D] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[#E9EBEF]" />
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#6E747D]">
                  No matching commands found.
                </div>
              )}
            </div>

            {/* Footer with key hints */}
            <div className="flex items-center justify-between border-t border-hairline bg-[#0B0C0E] px-4 py-2 text-[10px] font-mono text-[#6E747D]">
              <span>Use <kbd className="rounded bg-[#1A1D24] px-1 py-0.5 text-[#AEB4BD]">ESC</kbd> to dismiss</span>
              <span>CodeSense AI v2.0</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
