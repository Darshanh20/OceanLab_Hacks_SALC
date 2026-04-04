"use client";

import { ReactNode, useMemo, useState } from "react";
import { motion } from "motion/react";

type DiscreteTabItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  activeColor?: string;
};

type DiscreteTabsProps = {
  tabs: DiscreteTabItem[];
  value?: string;
  defaultTab?: string;
  onChange?: (id: string) => void;
  className?: string;
};

export function DiscreteTabs({
  tabs,
  value,
  defaultTab,
  onChange,
  className,
}: DiscreteTabsProps) {
  const fallbackTab = defaultTab || tabs[0]?.id || "";
  const [internalValue, setInternalValue] = useState(fallbackTab);

  const activeId = value ?? internalValue;
  const activeColor = useMemo(() => {
    return tabs.find((tab) => tab.id === activeId)?.activeColor || "#00D4FF";
  }, [tabs, activeId]);

  if (tabs.length === 0) return null;

  return (
    <div
      className={className ? `discrete-tabs-scroll ${className}` : "discrete-tabs-scroll"}
      style={{
        width: "100%",
        overflowX: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        borderBottom: "1px solid var(--border-subtle)",
        paddingBottom: "2px",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          minWidth: "max-content",
          position: "relative",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (value === undefined) setInternalValue(tab.id);
                onChange?.(tab.id);
              }}
              style={{
                position: "relative",
                border: "none",
                background: "transparent",
                color: isActive ? tab.activeColor || "#00D4FF" : "var(--text-muted)",
                padding: "11px 12px",
                borderRadius: "10px",
                fontSize: "0.95rem",
                fontWeight: isActive ? 700 : 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 160ms ease",
              }}
            >
              {isActive && (
                <motion.span
                  layoutId="discrete-tab-active-bg"
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "10px",
                    background:
                      "linear-gradient(180deg, rgba(0,212,255,0.14), rgba(0,212,255,0.04))",
                    border: "1px solid rgba(0,212,255,0.25)",
                    zIndex: 0,
                  }}
                />
              )}

              <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center" }}>
                {tab.icon}
              </span>
              <span style={{ position: "relative", zIndex: 1 }}>{tab.label}</span>

              {isActive && (
                <motion.span
                  layoutId="discrete-tab-active-line"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  style={{
                    position: "absolute",
                    left: "8px",
                    right: "8px",
                    bottom: "-2px",
                    height: "2px",
                    borderRadius: "999px",
                    background: activeColor,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
