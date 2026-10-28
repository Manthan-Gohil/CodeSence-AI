import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  GitBranch, 
  Layers, 
  Cpu, 
  ExternalLink, 
  Sparkles, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Info, 
  ChevronRight, 
  Search, 
  Share2,
  Boxes,
  Activity,
  FileCode,
  ShieldAlert,
  ArrowRight
} from "lucide-react";

const TIER_CONFIG = {
  route: { label: "API & Routes", color: "#38BDF8", bg: "rgba(56, 189, 248, 0.15)", border: "rgba(56, 189, 248, 0.4)" },
  service: { label: "Services & Logic", color: "#A855F7", bg: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.4)" },
  model: { label: "Models & Data", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)" },
  util: { label: "Utilities & Libs", color: "#10B981", bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.4)" },
  ui: { label: "UI Components", color: "#EC4899", bg: "rgba(236, 72, 153, 0.15)", border: "rgba(236, 72, 153, 0.4)" },
  config: { label: "Config & Manifests", color: "#94A3B8", bg: "rgba(148, 163, 184, 0.15)", border: "rgba(148, 163, 184, 0.4)" },
  module: { label: "Core Modules", color: "#E2E8F0", bg: "rgba(226, 232, 240, 0.15)", border: "rgba(226, 232, 240, 0.4)" }
};

export default function ArchitectureGraph({ graphData, onSelectFile, activeBranch = "main" }) {
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const [activeTier, setActiveTier] = useState("all");
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Parse raw dependency graph if passed as old format or new format
  const parsedData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [], metrics: {} };
    
    // New rich format
    if (graphData.nodes && graphData.links) {
      return graphData;
    }

    // Fallback parser if raw_deps was passed
    const raw = graphData.raw_deps || graphData;
    const filePaths = Object.keys(raw);
    const nodes = filePaths.map((path) => {
      const name = path.split("/").pop();
      const p = path.toLowerCase();
      let tier = "module";
      if (p.includes("route") || p.includes("controller") || p.includes("api") || p.includes("server")) tier = "route";
      else if (p.includes("service") || p.includes("manager") || p.includes("logic")) tier = "service";
      else if (p.includes("model") || p.includes("schema") || p.includes("entity")) tier = "model";
      else if (p.includes("util") || p.includes("lib") || p.includes("helper")) tier = "util";
      else if (p.includes("component") || p.includes("view") || p.includes("page")) tier = "ui";
      else if (p.includes("config") || p.includes(".json") || p.includes(".yaml")) tier = "config";

      return {
        id: path,
        label: name,
        path: path,
        tier: tier,
        lines: 100,
        size: 2048,
        importsCount: (raw[path] || []).length,
        incoming: 0,
        outgoing: (raw[path] || []).length
      };
    });

    const links = [];
    filePaths.forEach((src) => {
      const imports = raw[src] || [];
      filePaths.forEach((tgt) => {
        if (src === tgt) return;
        const tgtBase = tgt.split("/").pop().split(".")[0];
        if (tgtBase.length >= 3 && imports.some((imp) => imp.includes(tgtBase))) {
          links.push({ source: src, target: tgt });
        }
      });
    });

    return {
      nodes,
      links,
      metrics: {
        totalModules: nodes.length,
        totalLinks: links.length,
        hubModules: nodes.slice(0, 4).map((n) => n.label),
        tiers: {}
      }
    };
  }, [graphData]);

  // Position nodes radially or tiered in coordinate space
  const positionedNodes = useMemo(() => {
    const nodes = parsedData.nodes;
    if (!nodes || nodes.length === 0) return [];

    const width = 1000;
    const height = 650;
    const centerX = width / 2;
    const centerY = height / 2;

    // Group by tiers
    const tiers = ["route", "service", "model", "util", "ui", "config", "module"];
    const tierGroups = {};
    tiers.forEach((t) => (tierGroups[t] = []));
    nodes.forEach((n) => {
      const t = tierGroups[n.tier] ? n.tier : "module";
      tierGroups[t].push(n);
    });

    const result = [];
    const radiusRings = {
      route: 130,
      service: 220,
      model: 300,
      util: 370,
      ui: 260,
      config: 390,
      module: 340
    };

    nodes.forEach((node, idx) => {
      const ringRadius = radiusRings[node.tier] || 250;
      const angle = (idx / nodes.length) * 2 * Math.PI - Math.PI / 2;
      const jitter = ((idx % 3) - 1) * 20;

      result.push({
        ...node,
        x: centerX + (ringRadius + jitter) * Math.cos(angle),
        y: centerY + (ringRadius + jitter) * Math.sin(angle)
      });
    });

    return result;
  }, [parsedData.nodes]);

  // Node Map for fast ID lookups
  const nodeMap = useMemo(() => {
    const map = new Map();
    positionedNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [positionedNodes]);

  // Connected links for active/hovered node
  const activeNodeId = hoveredNode || (selectedNode ? selectedNode.id : null);
  const connectedNodeIds = useMemo(() => {
    if (!activeNodeId) return new Set();
    const set = new Set([activeNodeId]);
    parsedData.links.forEach((l) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (s === activeNodeId) set.add(t);
      if (t === activeNodeId) set.add(s);
    });
    return set;
  }, [activeNodeId, parsedData.links]);

  // Filter nodes by tier and search
  const visibleNodes = useMemo(() => {
    return positionedNodes.filter((node) => {
      const matchTier = activeTier === "all" || node.tier === activeTier;
      const matchSearch =
        !searchQuery ||
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.path.toLowerCase().includes(searchQuery.toLowerCase());
      return matchTier && matchSearch;
    });
  }, [positionedNodes, activeTier, searchQuery]);

  // Pan & Drag handlers
  const handleMouseDown = (e) => {
    if (e.target.tagName === "circle" || e.target.tagName === "text") return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(2.5, Math.max(0.4, prev * zoomFactor)));
  };

  const handleAskAI = (node) => {
    const prompt = `Explain the architecture, dependencies, and role of "${node.path}" in the repository (branch: ${activeBranch}). What other files depend on it?`;
    sessionStorage.setItem("codesense_prefill_query", prompt);
    navigate("/ai");
  };

  if (!parsedData.nodes || parsedData.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[520px] rounded-2xl border border-hairline bg-[#0E1013] p-8 text-center">
        <Boxes size={42} className="text-[#6E747D] mb-3 animate-pulse" />
        <h3 className="text-sm font-semibold text-[#F4F5F7]">No Architecture Dependencies Detected</h3>
        <p className="mt-1 text-xs text-[#6E747D] max-w-sm">
          Index a multi-module repository with Python, JavaScript, TypeScript, or Go to view its visual dependency graph.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-[650px] w-full rounded-2xl border border-hairline bg-[#090A0D] overflow-hidden select-none">
      
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-hairline bg-[#0E1013]/80 backdrop-blur-md z-10">
        
        {/* Tier Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <button
            onClick={() => setActiveTier("all")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
              activeTier === "all"
                ? "bg-[#1E222A] text-[#F4F5F7] font-semibold shadow"
                : "text-[#6E747D] hover:text-[#AEB4BD] hover:bg-[#131518]"
            }`}
          >
            All Modules ({parsedData.nodes.length})
          </button>
          {Object.entries(TIER_CONFIG).map(([key, config]) => {
            const count = parsedData.nodes.filter((n) => n.tier === key).length;
            if (count === 0) return null;
            const isActive = activeTier === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTier(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                  isActive
                    ? "bg-[#1E222A] text-[#F4F5F7] font-semibold border border-hairline-strong"
                    : "text-[#6E747D] hover:text-[#AEB4BD] hover:bg-[#131518]"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                <span>{config.label}</span>
                <span className="text-[10px] text-[#4B515D]">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search & Zoom Actions */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6E747D]" />
            <input
              type="text"
              placeholder="Search file…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 md:w-44 pl-8 pr-2.5 py-1 text-xs font-mono bg-[#131518] border border-hairline rounded-lg text-[#F4F5F7] placeholder-[#6E747D] focus:outline-none focus:border-[#4B515D]"
            />
          </div>

          <div className="flex items-center border border-hairline rounded-lg bg-[#131518] p-0.5">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
              className="p-1.5 text-[#AEB4BD] hover:text-[#F4F5F7] hover:bg-[#1C1F26] rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
              className="p-1.5 text-[#AEB4BD] hover:text-[#F4F5F7] hover:bg-[#1C1F26] rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1.5 text-[#AEB4BD] hover:text-[#F4F5F7] hover:bg-[#1C1F26] rounded transition-colors"
              title="Reset View"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive SVG Canvas */}
      <div
        className="relative flex-1 cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          viewBox="0 0 1000 650"
        >
          <defs>
            {/* Subtle glow filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            
            {/* Grid Pattern */}
            <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.02)" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Background Grid */}
          <rect width="100%" height="100%" fill="url(#graph-grid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} className="transition-transform duration-75">
            
            {/* Concentric Architecture Rings */}
            <g className="opacity-15 pointer-events-none">
              <circle cx="500" cy="325" r="130" fill="none" stroke="#38BDF8" strokeDasharray="3 3" />
              <circle cx="500" cy="325" r="220" fill="none" stroke="#A855F7" strokeDasharray="3 3" />
              <circle cx="500" cy="325" r="300" fill="none" stroke="#F59E0B" strokeDasharray="3 3" />
              <circle cx="500" cy="325" r="370" fill="none" stroke="#10B981" strokeDasharray="3 3" />
            </g>

            {/* Links / Edges */}
            <g className="links">
              {parsedData.links.map((link, idx) => {
                const sId = typeof link.source === "object" ? link.source.id : link.source;
                const tId = typeof link.target === "object" ? link.target.id : link.target;
                const source = nodeMap.get(sId);
                const target = nodeMap.get(tId);
                if (!source || !target) return null;

                const isConnected =
                  activeNodeId && (sId === activeNodeId || tId === activeNodeId);
                const isDimmed = activeNodeId && !isConnected;

                return (
                  <path
                    key={idx}
                    d={`M ${source.x} ${source.y} Q ${(source.x + target.x) / 2 + 15} ${(source.y + target.y) / 2 - 15} ${target.x} ${target.y}`}
                    fill="none"
                    stroke={
                      isConnected
                        ? "#F4F5F7"
                        : "rgba(255, 255, 255, 0.08)"
                    }
                    strokeWidth={isConnected ? 2 : 1}
                    strokeOpacity={isDimmed ? 0.05 : isConnected ? 0.9 : 0.3}
                    className="transition-all duration-200"
                  />
                );
              })}
            </g>

            {/* Nodes */}
            <g className="nodes">
              {visibleNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNode === node.id;
                const isConnected = activeNodeId && connectedNodeIds.has(node.id);
                const isDimmed = activeNodeId && !isConnected;
                const config = TIER_CONFIG[node.tier] || TIER_CONFIG.module;

                const radius = Math.min(18, Math.max(9, 7 + Math.sqrt(node.incoming + node.outgoing) * 2.5));

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => {
                      setSelectedNode(node);
                      if (onSelectFile) onSelectFile(node.path);
                    }}
                  >
                    {/* Glow circle for active/selected */}
                    {(isSelected || isHovered) && (
                      <circle
                        r={radius + 8}
                        fill={config.color}
                        opacity={0.25}
                        filter="url(#glow)"
                        className="animate-pulse"
                      />
                    )}

                    {/* Node circle */}
                    <circle
                      r={radius}
                      fill={config.bg}
                      stroke={isSelected ? "#F4F5F7" : config.color}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      opacity={isDimmed ? 0.15 : 1}
                      className="transition-all duration-200"
                    />

                    {/* Inner core dot */}
                    <circle
                      r={3}
                      fill={config.color}
                      opacity={isDimmed ? 0.15 : 1}
                    />

                    {/* Node Label */}
                    <text
                      dy={radius + 12}
                      textAnchor="middle"
                      className={`text-[10px] font-mono pointer-events-none transition-all duration-200 ${
                        isSelected || isHovered
                          ? "fill-[#F4F5F7] font-semibold"
                          : isDimmed
                          ? "fill-transparent"
                          : "fill-[#AEB4BD]"
                      }`}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl border border-hairline bg-[#0E1013]/90 backdrop-blur-md text-[10px] font-mono text-[#6E747D]">
          <span className="text-[#AEB4BD] font-semibold">Tiers:</span>
          {Object.entries(TIER_CONFIG).slice(0, 5).map(([key, config]) => (
            <span key={key} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
              <span>{config.label.split(" ")[0]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Selected Node Details Drawer */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 340, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 340, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute top-0 right-0 bottom-0 w-80 border-l border-hairline bg-[#0B0C0E]/95 backdrop-blur-xl p-5 flex flex-col justify-between shadow-2xl z-20 overflow-y-auto"
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between border-b border-hairline pb-3.5">
                <div>
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider mb-1.5"
                    style={{
                      color: TIER_CONFIG[selectedNode.tier]?.color || "#FFF",
                      backgroundColor: TIER_CONFIG[selectedNode.tier]?.bg || "rgba(255,255,255,0.1)",
                      border: `1px solid ${TIER_CONFIG[selectedNode.tier]?.border || "transparent"}`
                    }}
                  >
                    {TIER_CONFIG[selectedNode.tier]?.label || selectedNode.tier}
                  </span>
                  <h4 className="text-sm font-semibold text-[#F4F5F7] font-mono break-all">
                    {selectedNode.label}
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-xs font-mono text-[#6E747D] hover:text-[#F4F5F7] px-2 py-1 rounded hover:bg-[#161920]"
                >
                  ✕
                </button>
              </div>

              {/* Path and Stats */}
              <div className="mt-4 space-y-2.5 text-xs font-mono">
                <div>
                  <span className="text-[#6E747D] block text-[10px]">FILE PATH</span>
                  <span className="text-[#AEB4BD] text-[11px] break-all">{selectedNode.path}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="p-2.5 rounded-lg border border-hairline bg-[#111317]">
                    <span className="text-[10px] text-[#6E747D] block">INCOMING CALLERS</span>
                    <span className="text-base font-semibold text-[#38BDF8]">{selectedNode.incoming || 0}</span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-hairline bg-[#111317]">
                    <span className="text-[10px] text-[#6E747D] block">OUTGOING IMPORTS</span>
                    <span className="text-base font-semibold text-[#A855F7]">{selectedNode.outgoing || 0}</span>
                  </div>
                </div>
              </div>

              {/* Connected Dependencies */}
              <div className="mt-5">
                <span className="text-[10px] font-mono text-[#6E747D] uppercase tracking-wider block mb-2">
                  Connected Modules
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {parsedData.links
                    .filter((l) => {
                      const s = typeof l.source === "object" ? l.source.id : l.source;
                      const t = typeof l.target === "object" ? l.target.id : l.target;
                      return s === selectedNode.id || t === selectedNode.id;
                    })
                    .map((l, i) => {
                      const s = typeof l.source === "object" ? l.source.id : l.source;
                      const isOutgoing = s === selectedNode.id;
                      const otherId = isOutgoing ? (typeof l.target === "object" ? l.target.id : l.target) : s;
                      const otherNode = nodeMap.get(otherId);

                      return (
                        <div
                          key={i}
                          onClick={() => {
                            if (otherNode) {
                              setSelectedNode(otherNode);
                              if (onSelectFile) onSelectFile(otherNode.path);
                            }
                          }}
                          className="flex items-center justify-between p-2 rounded border border-hairline bg-[#131518] hover:border-[#4B515D] cursor-pointer transition-colors text-xs font-mono"
                        >
                          <span className="truncate text-[#AEB4BD]">
                            {otherNode ? otherNode.label : otherId.split("/").pop()}
                          </span>
                          <span className={`text-[10px] ${isOutgoing ? "text-[#A855F7]" : "text-[#38BDF8]"}`}>
                            {isOutgoing ? "imports →" : "← called by"}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* AI Action CTA */}
            <div className="pt-4 border-t border-hairline mt-4 space-y-2">
              <button
                onClick={() => handleAskAI(selectedNode)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-[#2B303B] to-[#1E222A] border border-hairline-strong text-xs font-semibold text-[#F4F5F7] hover:border-[#6E747D] transition-all shadow-md group"
              >
                <Sparkles size={13} className="text-[#38BDF8] group-hover:rotate-12 transition-transform" />
                <span>Ask AI About This Module</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
