import React from "react";
import { Github, Star, GitFork, Globe2, BadgeCheck, BookOpen, XCircle, ArrowUpRight } from "lucide-react";

export default function RepoPanel({ repoData, handleNewRepo }) {
  if (!repoData) return null;

  return (
    <div 
      data-lenis-prevent="true"
      className="w-full md:w-80 flex flex-col justify-between rounded-2xl border border-hairline bg-[#0E1013] p-5 shadow-2xl flex-shrink-0 md:h-full overflow-y-auto [scrollbar-width:thin]"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline pb-4 text-xs font-mono text-[#6E747D]">
          <span className="label-mono text-[#AEB4BD]">Active Repository</span>
          <span className="flex items-center gap-1.5 text-[#2EA043]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2EA043] animate-pulse" />
            Synchronized
          </span>
        </div>

        {/* Owner & Repo Title */}
        <div className="mt-4 flex items-start gap-3">
          {repoData.avatar_url && (
            <img
              src={repoData.avatar_url}
              alt={repoData.owner || "Owner"}
              className="h-10 w-10 rounded-full border border-hairline object-cover flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <a
              href={repoData.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1.5 text-base font-semibold text-[#F4F5F7] hover:text-white no-underline truncate"
            >
              <span className="truncate">{repoData.name}</span>
              <ArrowUpRight size={13} className="text-[#6E747D] group-hover:text-[#F4F5F7] transition-transform" />
            </a>
            <div className="text-[11px] font-mono text-[#6E747D]">
              by <span className="text-[#AEB4BD]">{repoData.owner}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        {repoData.description && (
          <p className="mt-3 text-xs leading-relaxed text-[#AEB4BD] line-clamp-3">
            {repoData.description}
          </p>
        )}

        {/* Stats Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 border-y border-hairline py-3 text-xs font-mono text-[#AEB4BD]">
          <div className="flex items-center gap-1.5">
            <Star size={13} className="text-[#6E747D]" />
            <span>{repoData.stars?.toLocaleString() || 0} stars</span>
          </div>
          <div className="flex items-center gap-1.5">
            <GitFork size={13} className="text-[#6E747D]" />
            <span>{repoData.forks?.toLocaleString() || 0} forks</span>
          </div>
          {repoData.main_language && (
            <div className="flex items-center gap-1.5">
              <BookOpen size={13} className="text-[#6E747D]" />
              <span className="truncate">{repoData.main_language}</span>
            </div>
          )}
          {repoData.license && (
            <div className="flex items-center gap-1.5">
              <BadgeCheck size={13} className="text-[#6E747D]" />
              <span className="truncate">{repoData.license}</span>
            </div>
          )}
        </div>

        {/* Topics */}
        {repoData.topics && repoData.topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {repoData.topics.slice(0, 6).map((t) => (
              <span
                key={t}
                className="rounded border border-hairline bg-[#131518] px-2 py-0.5 text-[10px] font-mono text-[#AEB4BD]"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Switch Repo Button */}
      <button
        onClick={handleNewRepo}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-[#131518] py-2.5 text-xs font-mono text-[#AEB4BD] transition-all hover:border-[#6E747D] hover:bg-[#1A1D24] hover:text-[#F4F5F7]"
      >
        <XCircle size={14} className="text-[#6E747D]" />
        <span>Switch Repository</span>
      </button>
    </div>
  );
}
