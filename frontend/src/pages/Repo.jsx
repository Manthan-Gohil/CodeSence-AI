import React, { useEffect, useState } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import atomOneDark from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";
import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import py from "react-syntax-highlighter/dist/esm/languages/hljs/python";
import cpp from "react-syntax-highlighter/dist/esm/languages/hljs/cpp";
import java from "react-syntax-highlighter/dist/esm/languages/hljs/java";
import jsonLang from "react-syntax-highlighter/dist/esm/languages/hljs/json";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { 
  Folder, 
  FileCode, 
  ChevronRight, 
  GitBranch, 
  Layers, 
  Copy, 
  CheckCircle2, 
  ExternalLink,
  Code2,
  Terminal,
  Activity
} from "lucide-react";

SyntaxHighlighter.registerLanguage("javascript", js);
SyntaxHighlighter.registerLanguage("python", py);
SyntaxHighlighter.registerLanguage("cpp", cpp);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("json", jsonLang);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";

// Collapsible card
function CollapsibleCard({ title, num, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-hairline bg-[#0E1013] overflow-hidden shadow-lg transition-colors">
      <button
        className="w-full flex items-center justify-between p-3.5 text-left font-mono text-xs text-[#AEB4BD] hover:bg-[#131518] hover:text-[#F4F5F7] transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          {num && <span className="text-[#6E747D]">{num}</span>}
          <span className="font-semibold uppercase tracking-wider">{title}</span>
        </div>
        <ChevronRight size={14} className={`text-[#6E747D] transition-transform duration-200 ${isOpen ? 'rotate-90 text-[#F4F5F7]' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3.5 border-t border-hairline bg-[#0B0C0E]/50">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// File Tree Recursive
function FileTree({ tree, onFileClick, selectedFile, path = "" }) {
  const [openDirs, setOpenDirs] = useState({});
  if (!tree) return null;
  const toggleDir = (dirPath) => setOpenDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));

  return (
    <ul className="text-xs font-mono space-y-0.5">
      {Object.entries(tree).map(([key, value]) => {
        const fullPath = path ? `${path}/${key}` : key;
        const isDirectory = typeof value === "object" && value !== null;

        if (isDirectory) {
          const isOpen = openDirs[fullPath];
          return (
            <li key={fullPath}>
              <button
                onClick={() => toggleDir(fullPath)}
                className="w-full text-left flex items-center gap-1.5 py-1 px-1.5 rounded-md hover:bg-[#131518] text-[#AEB4BD] hover:text-[#F4F5F7] transition-colors"
              >
                <ChevronRight size={12} className={`text-[#6E747D] transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`} />
                <Folder size={13} className="text-[#AEB4BD]" />
                <span className="truncate">{key}</span>
              </button>
              {isOpen && (
                <div className="ml-3 pl-1.5 border-l border-hairline">
                  <FileTree tree={value} path={fullPath} onFileClick={onFileClick} selectedFile={selectedFile} />
                </div>
              )}
            </li>
          );
        } else {
          const isSelected = selectedFile === fullPath;
          return (
            <li key={fullPath}>
              <button
                className={`w-full text-left flex items-center gap-1.5 py-1 px-2 rounded-md transition-all ${
                  isSelected
                    ? 'border border-hairline-strong bg-[#161920] text-[#F4F5F7] font-semibold'
                    : 'text-[#6E747D] hover:bg-[#131518] hover:text-[#AEB4BD]'
                }`}
                onClick={() => onFileClick(fullPath)}
              >
                <FileCode size={13} className={isSelected ? "text-[#E9EBEF]" : "text-[#6E747D]"} />
                <span className="truncate">{key}</span>
              </button>
            </li>
          );
        }
      })}
    </ul>
  );
}

// Language Distribution Bar
function LanguageBar({ languages }) {
  if (!languages || Object.keys(languages).length === 0) return null;
  const colors = ["#E9EBEF", "#6E747D", "#2EA043", "#4B515D", "#AEB4BD", "#3572A5"];
  const keys = Object.keys(languages);
  const total = Object.values(languages).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2">
      <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-[#131518] border border-hairline">
        {keys.map((lang, i) => (
          <div
            key={lang}
            style={{
              width: `${((languages[lang] / total) * 100).toFixed(2)}%`,
              background: colors[i % colors.length],
            }}
            title={`${lang}: ${languages[lang]} bytes`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-[#6E747D]">
        {keys.map((lang, i) => (
          <span key={lang} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: colors[i % colors.length] }}
            />
            <span className="text-[#AEB4BD]">{lang}</span>
            <span>{((languages[lang] / total) * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Repo() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fileTree, setFileTree] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [dependencyGraph, setDependencyGraph] = useState(null);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchRepoMeta() {
      if (!user?.id) return;
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${BACKEND_URL}/api/repo/metadata`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id }),
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Failed to load repo metadata.");
        const data = await res.json();
        setFileTree(data.file_tree);
        setAnalytics(data.analytics);
        setDependencyGraph(data.dependency_graph);
      } catch (err) {
        setError(err.message || "Error loading repo.");
      } finally {
        setLoading(false);
      }
    }
    fetchRepoMeta();
  }, [user?.id]);

  const handleFileClick = async (filePath) => {
    setSelectedFile(filePath);
    setFileContent("");
    setFileLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/repo/get_file_content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user?.id, file_path: filePath }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to load file content.");
      const data = await res.json();
      setFileContent(data.content);
    } catch (err) {
      setFileContent(`// Error loading file: ${err.message}`);
    } finally {
      setFileLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen bg-ambient text-[#AEB4BD] flex flex-col overflow-hidden">
      <Navbar onOpenSidebar={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} onLogout={logout} />

      <main className="flex-1 flex flex-col p-4 md:p-6 max-w-[1520px] mx-auto w-full min-h-0">
        
        {/* Top Header Strip */}
        <div className="flex flex-wrap items-center justify-between border-b border-hairline pb-4 mb-4 text-xs font-mono text-[#6E747D]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2EA043] animate-pulse" />
            <span className="label-mono text-[#F4F5F7]">
              {analytics?.repo_name || "Repository Workbench"}
            </span>
            {analytics?.owner && (
              <span className="text-[#6E747D]">by {analytics.owner}</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span>{analytics?.stars?.toLocaleString() || 0} stars</span>
            <span>·</span>
            <span>{analytics?.forks?.toLocaleString() || 0} forks</span>
            <span>·</span>
            <span className="text-[#2EA043]">AST Ready</span>
          </div>
        </div>

        {/* 3-Column IDE Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[calc(100vh-170px)]">
          
          {/* Col 1: File Tree (3 cols) */}
          <div className="lg:col-span-3 rounded-2xl border border-hairline bg-[#0E1013] p-4 flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-hairline pb-3 mb-3 text-xs font-mono text-[#6E747D]">
              <span className="label-mono text-[#AEB4BD]">File Explorer</span>
              <span>Tree Index</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {loading ? (
                <div className="py-8 text-center font-mono text-xs text-[#6E747D] animate-pulse">
                  Scanning repository tree...
                </div>
              ) : error ? (
                <div className="py-8 text-center font-mono text-xs text-red-400">
                  {error}
                </div>
              ) : fileTree ? (
                <FileTree tree={fileTree} onFileClick={handleFileClick} selectedFile={selectedFile} />
              ) : (
                <div className="py-8 text-center font-mono text-xs text-[#6E747D]">
                  No active repository found. Go to AI Chat to index one.
                </div>
              )}
            </div>
          </div>

          {/* Col 2: Central Code Viewer (6 cols) */}
          <div className="lg:col-span-6 rounded-2xl border border-hairline bg-[#0E1013] flex flex-col shadow-xl overflow-hidden">
            {/* Code Header Bar */}
            <div className="flex items-center justify-between border-b border-hairline bg-[#131518] px-4 py-2.5 text-xs font-mono">
              <span className="truncate text-[#F4F5F7] font-semibold">
                {selectedFile || "Select a file to inspect AST source"}
              </span>

              {selectedFile && fileContent && (
                <button
                  onClick={handleCopy}
                  className="rounded border border-hairline bg-[#1A1D24] px-2.5 py-1 text-[11px] font-mono text-[#AEB4BD] hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <CheckCircle2 size={12} className="text-[#2EA043]" /> : <Copy size={12} />}
                  <span>{copied ? "Copied" : "Copy Source"}</span>
                </button>
              )}
            </div>

            {/* Viewer Body */}
            <div className="flex-1 overflow-auto p-4 bg-[#08090B] font-mono text-xs leading-relaxed [scrollbar-width:thin]">
              {fileLoading ? (
                <div className="h-full flex items-center justify-center font-mono text-xs text-[#6E747D]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#2EA043] animate-ping" />
                    <span>Loading file payload...</span>
                  </div>
                </div>
              ) : selectedFile && fileContent ? (
                <SyntaxHighlighter
                  language={selectedFile.split('.').pop() || "text"}
                  style={atomOneDark}
                  customStyle={{ background: "transparent", padding: 0, margin: 0, fontSize: "12px", lineHeight: "1.6" }}
                  showLineNumbers={true}
                  lineNumberStyle={{ color: "#3B4252", paddingRight: "1.5em", fontSize: "11px" }}
                >
                  {fileContent}
                </SyntaxHighlighter>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#6E747D]">
                  <Terminal size={32} className="mb-3 opacity-40" />
                  <p className="font-semibold text-sm text-[#AEB4BD]">No file currently selected</p>
                  <p className="mt-1 text-xs max-w-xs leading-relaxed">
                    Click any file from the explorer on the left to preview syntax highlighting and AST dependencies.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Col 3: Details & Analytics (3 cols) */}
          <div className="lg:col-span-3 rounded-2xl border border-hairline bg-[#0E1013] p-4 flex flex-col shadow-xl overflow-y-auto space-y-4 [scrollbar-width:thin]">
            <div className="flex items-center justify-between border-b border-hairline pb-3 text-xs font-mono text-[#6E747D]">
              <span className="label-mono text-[#AEB4BD]">Repository Telemetry</span>
              <span>Metrics</span>
            </div>

            {/* Language Breakdown Card */}
            <CollapsibleCard title="Languages" num="01">
              <LanguageBar languages={analytics?.languages} />
            </CollapsibleCard>

            {/* Repo Summary Card */}
            <CollapsibleCard title="Overview" num="02">
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#6E747D]">Default Branch</span>
                  <span className="text-[#F4F5F7]">main</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E747D]">License</span>
                  <span className="text-[#F4F5F7]">{analytics?.license || "MIT / Standard"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E747D]">Top Contributor</span>
                  <span className="text-[#F4F5F7] truncate max-w-[120px]">
                    {analytics?.contributors?.[0]?.login || "N/A"}
                  </span>
                </div>
              </div>
            </CollapsibleCard>

            {/* AST Imports Graph Card */}
            <CollapsibleCard title="AST Imports" num="03" defaultOpen={false}>
              <div className="max-h-56 overflow-auto font-mono text-[11px] text-[#AEB4BD] rounded border border-hairline bg-[#08090B] p-2.5 [scrollbar-width:thin]">
                {dependencyGraph && Object.keys(dependencyGraph).length > 0 ? (
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(dependencyGraph, null, 2)}
                  </pre>
                ) : (
                  <span className="text-[#6E747D]">No AST dependencies extracted.</span>
                )}
              </div>
            </CollapsibleCard>
          </div>

        </div>
      </main>
    </div>
  );
}
