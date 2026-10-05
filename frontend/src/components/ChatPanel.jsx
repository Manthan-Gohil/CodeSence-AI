import React from "react";
import { Send, Sparkles, Terminal, CornerDownLeft } from "lucide-react";
import ChatBubble from "./ChatBubble";

export default function ChatPanel({
  chat,
  msg,
  setMsg,
  loadingChat,
  onSend,
  canChat,
  chatRef,
  onDeleteMessage
}) {
  return (
    <div className="flex-1 flex flex-col bg-[#0E1013] border border-hairline rounded-2xl shadow-2xl relative overflow-hidden h-[calc(100vh-140px)]">
      {/* Top Panel Bar */}
      <div className="flex items-center justify-between border-b border-hairline bg-[#131518] px-5 py-3">
        <div className="flex items-center gap-2 text-xs font-mono text-[#AEB4BD]">
          <Terminal size={14} className="text-[#6E747D]" />
          <span>codebase_chat.sh</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-[#6E747D]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2EA043] animate-pulse" />
            RAG Active
          </span>
          <span>·</span>
          <span>Top-4 Chunks</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 [scrollbar-width:thin]"
      >
        {chat.map((c, i) => (
          <ChatBubble
            key={c.id ?? i}
            sender={c.sender}
            text={c.text}
            avatar={c.avatar}
            id={c.id}
            onDelete={onDeleteMessage}
            canDelete={typeof c.id === "number"}
          />
        ))}

        {loadingChat && (
          <div className="flex justify-start mb-4">
            <div className="px-4 py-3 rounded-xl bg-[#131518] border border-hairline text-xs font-mono text-[#AEB4BD] flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-[#2EA043] animate-ping" />
              <span>Synthesizing response from vector context...</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Input Area */}
      <div className="border-t border-hairline bg-[#111317] p-4 flex-shrink-0">
        <form
          onSubmit={onSend}
          className="relative flex items-center gap-2"
        >
          <input
            className="flex-1 bg-[#161920] border border-hairline rounded-xl px-4 py-3 text-xs md:text-sm text-[#F4F5F7] placeholder-[#6E747D] outline-none transition-all focus:border-[#6E747D] focus:ring-1 focus:ring-[#6E747D]"
            placeholder={canChat ? "Ask about functions, architecture, bugs or dependencies..." : "Ingest a repository above to enable chat..."}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            spellCheck={false}
            autoFocus={canChat}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && canChat) {
                e.preventDefault();
                onSend(e);
              }
            }}
            disabled={loadingChat || !canChat}
          />

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4F5F7] px-4 py-3 text-xs font-mono font-semibold uppercase text-[#0B0C0E] transition-all hover:bg-white hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            disabled={!msg.trim() || loadingChat || !canChat}
          >
            <span>{loadingChat ? "Thinking..." : "Send"}</span>
            <CornerDownLeft size={13} />
          </button>
        </form>

        <div className="mt-2 flex items-center justify-between px-1 text-[10px] font-mono text-[#6E747D]">
          <span>Press <kbd className="rounded bg-[#1A1D24] px-1 text-[#AEB4BD]">Enter ↵</kbd> to send</span>
          <span>Max Output: 768 tokens · Sub-3s Guarantee</span>
        </div>
      </div>
    </div>
  );
}