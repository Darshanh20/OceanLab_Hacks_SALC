"use client";

import React from "react";
import { motion } from "motion/react";
import { ArrowUp } from "lucide-react";

interface AiInput003Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export const AiInput003: React.FC<AiInput003Props> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask anything about this document or meeting...",
  loading = false,
  disabled = false,
  className,
}) => {
  const isDisabled = disabled || loading;

  return (
    <motion.div
      animate={{
        scale: loading ? 0.99 : 1,
        borderColor: loading ? "rgba(99,102,241,0.55)" : "rgba(99,102,241,0.22)",
        boxShadow: loading
          ? "0 0 0 3px rgba(99,102,241,0.14), 0 18px 42px rgba(8,12,30,0.52)"
          : "0 10px 30px rgba(8,12,30,0.38)",
      }}
      transition={{ type: "spring", stiffness: 290, damping: 26 }}
      className={`group relative flex w-full items-center overflow-hidden rounded-full border bg-[linear-gradient(130deg,rgba(17,17,39,0.96),rgba(13,13,32,0.98))] px-7 py-4 pr-4 ${className || ""}`}
    >
      {loading && (
        <motion.div
          initial={{ y: "220%" }}
          animate={{ y: "-120%" }}
          transition={{ duration: 0.7, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.25 }}
          className="pointer-events-none absolute inset-0 z-0 skew-x-12 bg-linear-to-t from-indigo-500/24 via-indigo-500/10 to-white/8 blur-md"
        />
      )}

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder={placeholder}
        className="z-10 flex-1 border-none bg-transparent py-1 text-[15px] font-medium text-white placeholder:text-[15px] outline-none md:text-[16px]"
        style={{ color: 'var(--text-primary)', placeholderColor: 'var(--text-muted)' }}
        disabled={isDisabled}
      />

      <motion.button
        whileTap={{ scale: isDisabled ? 1 : 0.92 }}
        onClick={onSubmit}
        disabled={!value.trim() || isDisabled}
        className={`z-10 ml-4 flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-300 md:h-14 md:w-14 ${
          value.trim() && !isDisabled
            ? "border-[rgba(129,140,248,0.45)] text-white shadow-[0_8px_22px_rgba(79,70,229,0.35)]"
            : "border-[rgba(99,102,241,0.2)] bg-[rgba(30,30,74,0.8)]"
        }`}
        style={value.trim() && !isDisabled ? { backgroundColor: 'var(--primary-500)', color: 'white' } : { color: 'var(--text-muted)' }}
      >
        {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <ArrowUp size={22} strokeWidth={2.7} />}
      </motion.button>
    </motion.div>
  );
};
