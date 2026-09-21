import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

type Box = { top: number; left: number; width: number; maxH: number; up: boolean };

/**
 * دراپ‌داون پنل — لیست با portal و position:fixed روی body رندر می‌شود.
 * بنابراین داخل overflow کارت/جدول گیر نمی‌کند و هنگام اسکرول
 * زیر کارت‌های بعدی پنهان نمی‌شود. مختصات با اسکرول و resize به‌روز می‌شود.
 */
export function ASelect({
  value,
  onChange,
  options,
  className = "",
  placeholder = "انتخاب…",
  disabled = false,
  maxHeight = 260,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  maxHeight?: number;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);

  const measure = () => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) { setOpen(false); return; }
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 180 && above > below;
    setBox({
      top: up ? r.top - 6 : r.bottom + 6,
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: r.width,
      maxH: Math.max(120, Math.min(maxHeight, (up ? above : below) - 8)),
      up,
    });
  };

  useLayoutEffect(() => { if (open) measure(); }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => measure();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const idx = options.findIndex((o) => o.value === value);
    if (idx >= 0) listRef.current.scrollTop = Math.max(0, idx * 36 - 80);
  }, [open, value, options]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`a-input flex w-full items-center justify-between gap-2 text-start ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-[rgba(163,245,90,.35)]"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected ? selected.label : <span className="text-[#5c6454]">{placeholder}</span>}</span>
        <svg className={`h-4 w-4 shrink-0 text-[#9aa38f] transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && box && createPortal(
        <AnimatePresence>
          <motion.ul
            ref={listRef}
            role="listbox"
            initial={{ opacity: 0, y: box.up ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="no-scrollbar overflow-y-auto rounded-xl border border-[rgba(163,245,90,.28)] bg-[#121812] p-1 shadow-[0_22px_50px_-12px_rgba(0,0,0,.75)]"
            style={{ position: "fixed", top: box.top, left: box.left, width: box.width, maxHeight: box.maxH, transform: box.up ? "translateY(-100%)" : undefined, zIndex: 400, overscrollBehavior: "contain" }}
          >
            {options.length === 0 && <li className="px-3 py-2 text-xs text-[#9aa38f]">گزینه‌ای نیست</li>}
            {options.map((o) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-bold transition-colors ${o.value === value ? "bg-[#a3f55a] text-[#10150f]" : "text-[#ede9da] hover:bg-white/10"}`}
              >
                {o.label}
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
