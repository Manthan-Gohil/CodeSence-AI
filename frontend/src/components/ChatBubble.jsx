import React from "react";
import ReactMarkdown from "react-markdown";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import py from "react-syntax-highlighter/dist/esm/languages/hljs/python";
import cpp from "react-syntax-highlighter/dist/esm/languages/hljs/cpp";
import java from "react-syntax-highlighter/dist/esm/languages/hljs/java";
import atomOneDark from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";
import { Trash2, Bot, User } from "lucide-react";

SyntaxHighlighter.registerLanguage("javascript", js);
SyntaxHighlighter.registerLanguage("python", py);
SyntaxHighlighter.registerLanguage("cpp", cpp);
SyntaxHighlighter.registerLanguage("java", java);

function detectLanguage(code = "") {
  if (/^\s*#include|std::|using\s+namespace\s+std/.test(code)) return "cpp";
  if (/^\s*import\s+\w+|def\s+\w+/.test(code) || /print\(.+\)/.test(code)) return "python";
  if (/^\s*public\s+class|System\.out\.println/.test(code)) return "java";
  if (/function\s*\(|const\s+\w+\s*=/.test(code) || /console\.log/.test(code)) return "javascript";
  return "text";
}

export default function ChatBubble({ sender, text, avatar, onDelete, canDelete, id }) {
  const isUser = sender === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-6 group`}>
      {/* AI Avatar */}
      {!isUser && (
        <div className="h-8 w-8 rounded-full border border-hairline bg-[#131518] flex items-center justify-center mr-3 mt-1 flex-shrink-0">
          <Bot size={16} className="text-[#E9EBEF]" />
        </div>
      )}

      <div
        className={`
          relative px-5 py-4 rounded-2xl max-w-[85vw] sm:max-w-[75%]
          ${isUser
            ? "bg-[#181B22] text-[#F4F5F7] border border-hairline-strong rounded-tr-sm"
            : "bg-[#111317] text-[#D1D5DB] border border-hairline rounded-tl-sm shadow-xl"}
        `}
        style={{ wordBreak: "break-word" }}
      >
        {/* Delete action button */}
        {canDelete && (
          <button
            className={`absolute top-2 ${isUser ? "right-2" : "right-2"} opacity-0 group-hover:opacity-80 transition-opacity rounded-md p-1.5 bg-[#0B0C0E]/80 hover:bg-red-500/20 text-[#6E747D] hover:text-red-400`}
            title="Delete message"
            onClick={() => onDelete(id)}
          >
            <Trash2 size={13} />
          </button>
        )}

        {/* Sender Label */}
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-mono text-[#6E747D]">
          <span>{isUser ? "DEVELOPER" : "CODESENSE NEURAL RAG"}</span>
        </div>

        <ReactMarkdown
          components={{
            strong: ({ node, ...props }) => <b className="font-semibold text-[#F4F5F7]" {...props} />,
            ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-3 mt-1.5 space-y-1" {...props} />,
            ol: ({ node, ...props }) => <ol className="list-decimal ml-5 mb-3 mt-1.5 space-y-1" {...props} />,
            li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
            h1: ({ node, ...props }) => <h1 className="text-lg font-bold mb-2 mt-4 text-[#F4F5F7]" {...props} />,
            h2: ({ node, ...props }) => <h2 className="text-base font-semibold mb-2 mt-3 text-[#F4F5F7]" {...props} />,
            h3: ({ node, ...props }) => <h3 className="text-sm font-semibold mb-1.5 mt-2 text-[#F4F5F7]" {...props} />,
            blockquote: ({ node, ...props }) => (
              <blockquote className="border-l-2 border-[#E9EBEF]/40 pl-3.5 italic my-3 text-[#AEB4BD]" {...props} />
            ),
            code({ node, inline, className, children, ...props }) {
              const code = String(children).replace(/\n$/, "");
              const lang = (className || "").replace("language-", "") || detectLanguage(code);
              
              if (inline) {
                return (
                  <code className="bg-[#1A1D24] px-1.5 py-0.5 rounded text-[12px] font-mono text-[#E9EBEF] border border-hairline" {...props}>
                    {children}
                  </code>
                );
              }
              
              return (
                <div className="my-3 overflow-hidden rounded-xl border border-hairline">
                  <div className="flex items-center justify-between bg-[#161920] px-3.5 py-1.5 text-[10px] font-mono text-[#6E747D] border-b border-hairline">
                    <span className="uppercase">{lang}</span>
                    <span>Syntax Highlighting</span>
                  </div>
                  <SyntaxHighlighter
                    style={atomOneDark}
                    language={lang}
                    customStyle={{
                      background: "#0E1014",
                      padding: "1rem",
                      fontSize: "12px",
                      margin: 0,
                      lineHeight: "1.5"
                    }}
                    PreTag="div"
                    showLineNumbers={true}
                    lineNumberStyle={{
                      color: "#4B515D",
                      fontSize: "11px",
                      paddingRight: "1em"
                    }}
                  >
                    {code}
                  </SyntaxHighlighter>
                </div>
              );
            },
            pre: ({ node, ...props }) => <div {...props} className="my-2" />,
            p: ({ node, ...props }) => <p className="mb-2.5 last:mb-0 leading-relaxed text-[13.5px]" {...props} />,
            a: ({ node, ...props }) => (
              <a 
                className="text-[#E9EBEF] underline underline-offset-4 decoration-hairline-strong hover:text-white transition-colors" 
                target="_blank" 
                rel="noopener noreferrer" 
                {...props} 
              />
            ),
            hr: ({ node, ...props }) => <hr className="border-hairline my-3" {...props} />,
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full border-collapse border border-hairline text-xs" {...props} />
              </div>
            ),
            th: ({ node, ...props }) => (
              <th className="border border-hairline px-3 py-2 bg-[#161920] font-semibold text-left text-[#F4F5F7]" {...props} />
            ),
            td: ({ node, ...props }) => (
              <td className="border border-hairline px-3 py-2 text-[#AEB4BD]" {...props} />
            ),
          }}
        >
          {text}
        </ReactMarkdown>
      </div>

      {/* User Avatar */}
      {isUser && (
        <img
          src={avatar || "/logo.png"}
          className="h-8 w-8 rounded-full border border-hairline ml-3 mt-1 flex-shrink-0 object-cover"
          alt="user"
        />
      )}
    </div>
  );
}