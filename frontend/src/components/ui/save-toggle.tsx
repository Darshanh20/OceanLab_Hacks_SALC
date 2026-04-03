"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import useMeasure from "react-use-measure";
import { motion } from "motion/react";
import { FiCheck, FiLoader, FiSave } from "react-icons/fi";

import { cn } from "@/lib/utils";

type SaveToggleStatus = "idle" | "saving" | "saved";

export interface SaveToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  size?: "sm" | "md" | "lg";
  idleText?: string;
  savedText?: string;
  loadingDuration?: number;
  successDuration?: number;
  loading?: boolean;
  onClick?: () => void | Promise<void>;
  onStatusChange?: (status: SaveToggleStatus) => void;
}

const sizeClasses: Record<NonNullable<SaveToggleProps["size"]>, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-6 text-base",
};

function SaveLabel({ text, icon }: { text: string; icon: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="inline-flex items-center justify-center">{icon}</span>
      <span>{text}</span>
    </span>
  );
}

export function SaveToggle({
  size = "md",
  idleText = "Save",
  savedText = "Saved",
  loadingDuration = 1200,
  successDuration = 1000,
  loading,
  onClick,
  onStatusChange,
  className,
  disabled,
  type = "button",
  style,
  ...props
}: SaveToggleProps) {
  const [internalStatus, setInternalStatus] = useState<SaveToggleStatus>("idle");
  const previousLoading = useRef(false);
  const loadingTimer = useRef<number | null>(null);
  const successTimer = useRef<number | null>(null);
  const [measureRef, bounds] = useMeasure();
  const isControlled = typeof loading === "boolean";

  const status = loading ? "saving" : internalStatus;
  const isBusy = status === "saving";

  const labels = useMemo(
    () => ({
      idle: <SaveLabel text={idleText} icon={<FiSave size={16} />} />,
      saving: <SaveLabel text="Saving..." icon={<FiLoader size={16} className="animate-spin" />} />,
      saved: <SaveLabel text={savedText} icon={<FiCheck size={16} />} />,
    }),
    [idleText, savedText],
  );

  useEffect(() => {
    if (!isControlled) return;

    if (loading && !previousLoading.current) {
      onStatusChange?.("saving");
    }

    if (!loading && previousLoading.current) {
      onStatusChange?.("saved");
      setInternalStatus("saved");

      successTimer.current = window.setTimeout(() => {
        setInternalStatus("idle");
        onStatusChange?.("idle");
      }, successDuration);
    }

    previousLoading.current = loading;

    return () => {
      if (successTimer.current) window.clearTimeout(successTimer.current);
    };
  }, [isControlled, loading, onStatusChange, successDuration]);

  useEffect(() => {
    return () => {
      if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
      if (successTimer.current) window.clearTimeout(successTimer.current);
    };
  }, []);

  const handleClick = async () => {
    if (disabled || isBusy) return;

    if (!isControlled) {
      setInternalStatus("saving");
      onStatusChange?.("saving");

      loadingTimer.current = window.setTimeout(() => {
        setInternalStatus("saved");
        onStatusChange?.("saved");

        successTimer.current = window.setTimeout(() => {
          setInternalStatus("idle");
          onStatusChange?.("idle");
        }, successDuration);
      }, loadingDuration);
    }

    await onClick?.();
  };

  return (
    <motion.button
      type={type}
      onClick={handleClick}
      disabled={disabled || isBusy}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-full border font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
        "bg-[linear-gradient(135deg,rgba(30,30,74,0.96),rgba(18,18,42,0.98))] text-foreground shadow-[0_10px_30px_rgba(10,10,26,0.35)] hover:border-[rgba(99,102,241,0.38)] hover:shadow-[0_14px_40px_rgba(99,102,241,0.18)]",
        sizeClasses[size],
        className,
      )}
      style={{
        borderColor: "rgba(99, 102, 241, 0.22)",
        ...style,
      }}
      {...(props as any)}
    >
      <span
        ref={measureRef}
        className="pointer-events-none absolute inset-0 invisible flex items-center justify-center px-6"
        aria-hidden="true"
      >
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <FiSave size={16} />
          {idleText}
        </span>
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <FiLoader size={16} />
          Saving...
        </span>
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <FiCheck size={16} />
          {savedText}
        </span>
      </span>

      <motion.span
        key={status}
        initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative z-10 inline-flex items-center justify-center"
        style={{ minWidth: bounds.width ? `${Math.ceil(bounds.width)}px` : undefined }}
      >
        {labels[status]}
      </motion.span>
    </motion.button>
  );
}

export default SaveToggle;
