import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { Bug, AlertTriangle, MessageSquare, Send, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:8000";

const feedbackCategories = [
  { id: "bug", icon: Bug, title: "Bug Report", description: "Unexpected errors, 502/500 faults, or RAG failures" },
  { id: "feature", icon: AlertTriangle, title: "Feature Request", description: "Propose new models, language support, or UI capabilities" },
  { id: "general", icon: MessageSquare, title: "General Notes", description: "Feedback on accuracy, latency, and engineering ergonomics" },
];

export default function Feedback() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: "bug",
    title: "",
    description: "",
    steps: "",
    expectedBehavior: "",
    actualBehavior: "",
    browserInfo: "",
    additionalInfo: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const browserInfo = `Browser: ${navigator.userAgent}\nScreen: ${screen.width}x${screen.height}\nTimezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    setFormData((prev) => ({ ...prev, browserInfo }));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const orNA = (v, fallback = "N/A") => {
    if (v === null || v === undefined) return fallback;
    if (typeof v === "string" && v.trim() === "") return fallback;
    return v;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: orNA(user?.name || user?.login || "Anonymous User"),
        time: new Date().toLocaleString(),
        from_email: user?.email || null,
        category: orNA(formData.category?.toUpperCase()),
        title: orNA(formData.title),
        description: orNA(formData.description),
        steps: orNA(formData.steps),
        expected_behavior: orNA(formData.expectedBehavior),
        actual_behavior: orNA(formData.actualBehavior),
        browser_info: orNA(formData.browserInfo),
        additional_info: orNA(formData.additionalInfo, "None"),
      };

      const res = await fetch(`${BACKEND_URL}/api/discuss/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Submit failed (${res.status})`);
      }

      setSubmitted(true);
      setFormData({
        category: "bug",
        title: "",
        description: "",
        steps: "",
        expectedBehavior: "",
        actualBehavior: "",
        browserInfo: formData.browserInfo,
        additionalInfo: "",
      });
    } catch (error) {
      alert(error.message || "Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-ambient text-[#AEB4BD] flex flex-col justify-between">
      <Navbar onOpenSidebar={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} onLogout={logout} />

      <main className="flex-1 mx-auto max-w-[960px] w-full px-6 py-12 md:py-16">
        {submitted ? (
          <div className="rounded-2xl border border-hairline-strong bg-[#0E1013] p-10 md:p-14 text-center shadow-2xl animate-fade-in">
            <CheckCircle2 size={48} className="text-[#2EA043] mx-auto mb-4" />
            <span className="label-mono text-xs text-[#2EA043]">submission received</span>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-[#F4F5F7]">
              Thank You for Your Feedback
            </h2>
            <p className="mt-3 text-sm text-[#AEB4BD] max-w-md mx-auto leading-relaxed">
              Your note has been registered in our database. We use community feedback to continuously optimize latency and reasoning quality.
            </p>

            <div className="mt-8 flex justify-center gap-4">
              <button
                onClick={() => setSubmitted(false)}
                className="rounded-xl border border-hairline bg-[#131518] px-5 py-2.5 text-xs font-mono text-[#AEB4BD] hover:border-[#6E747D] hover:text-[#F4F5F7] transition-all"
              >
                Send Another Note
              </button>
              <Link
                to="/ai"
                className="rounded-xl bg-[#F4F5F7] px-6 py-2.5 text-xs font-mono font-semibold uppercase text-[#0B0C0E] hover:bg-white transition-all"
              >
                Return to AI Chat
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-hairline bg-[#0E1013] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E9EBEF]/40 to-transparent" />

            <div className="border-b border-hairline pb-6">
              <span className="label-mono text-xs text-[#6E747D]">the direct line · telemetry & notes</span>
              <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-[-0.02em] text-[#F4F5F7]">
                Submit Field Notes & Feedback
              </h1>
              <p className="mt-2 text-xs md:text-sm text-[#AEB4BD] leading-relaxed">
                Direct channel to the engineering team. Report unexpected model outputs, suggest features, or log performance metrics.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {/* Category Selector */}
              <div>
                <label className="label-mono text-[11px] text-[#6E747D] block mb-2">Category</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {feedbackCategories.map((c) => {
                    const isSelected = formData.category === c.id;
                    const Icon = c.icon;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setFormData((prev) => ({ ...prev, category: c.id }))}
                        className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? "border-hairline-strong bg-[#161920] text-[#F4F5F7] shadow-sm"
                            : "border-hairline bg-[#131518]/60 text-[#6E747D] hover:bg-[#131518] hover:text-[#AEB4BD]"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={14} className={isSelected ? "text-[#E9EBEF]" : "text-[#6E747D]"} />
                          <span className="text-xs font-semibold">{c.title}</span>
                        </div>
                        <span className="text-[11px] leading-relaxed opacity-80">{c.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="label-mono text-[11px] text-[#6E747D] block mb-2">Subject / Title</label>
                <input
                  type="text"
                  name="title"
                  placeholder="Concise summary of the finding..."
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-xl border border-hairline bg-[#131518] px-4 py-2.5 text-xs md:text-sm text-[#F4F5F7] placeholder-[#6E747D] outline-none transition-all focus:border-[#6E747D] focus:ring-1 focus:ring-[#6E747D]"
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="label-mono text-[11px] text-[#6E747D] block mb-2">Detailed Notes</label>
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Describe what occurred, prompt query used, or suggested improvement..."
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-xl border border-hairline bg-[#131518] p-4 text-xs md:text-sm text-[#F4F5F7] placeholder-[#6E747D] outline-none transition-all focus:border-[#6E747D] focus:ring-1 focus:ring-[#6E747D]"
                />
              </div>

              {/* Conditional Fields for Bugs */}
              {formData.category === "bug" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-mono text-[11px] text-[#6E747D] block mb-2">Steps to Reproduce</label>
                    <textarea
                      name="steps"
                      rows={3}
                      placeholder="1. Ingest repo... 2. Prompt query..."
                      value={formData.steps}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-hairline bg-[#131518] p-3 text-xs text-[#F4F5F7] placeholder-[#6E747D] outline-none focus:border-[#6E747D]"
                    />
                  </div>
                  <div>
                    <label className="label-mono text-[11px] text-[#6E747D] block mb-2">Expected vs Actual</label>
                    <textarea
                      name="expectedBehavior"
                      rows={3}
                      placeholder="Expected sub-3s answer, but timed out after 300s..."
                      value={formData.expectedBehavior}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-hairline bg-[#131518] p-3 text-xs text-[#F4F5F7] placeholder-[#6E747D] outline-none focus:border-[#6E747D]"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4 border-t border-hairline flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#6E747D]">
                  Logged as: {user?.email || "Anonymous"}
                </span>

                <button
                  type="submit"
                  disabled={isSubmitting || !formData.title.trim() || !formData.description.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#F4F5F7] px-6 py-3 text-xs font-mono font-semibold uppercase text-[#0B0C0E] transition-all hover:bg-white hover:shadow-lg disabled:opacity-40"
                >
                  <Send size={13} />
                  <span>{isSubmitting ? "Dispatching..." : "Transmit Note"}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-hairline bg-[#08090B] py-8">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 text-xs font-mono text-[#6E747D]">
          <span>&copy; {new Date().getFullYear()} CodeSense AI. All rights reserved.</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2EA043]" />
            Telemetry Endpoint 200 OK
          </span>
        </div>
      </footer>
    </div>
  );
}