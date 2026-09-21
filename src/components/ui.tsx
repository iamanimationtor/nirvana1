import { useRef, type ReactNode, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { CATEGORY_ICONS } from "./Icons";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, delay = 0, className = "", y = 28 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Magnetic({ children, strength = 0.28 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });
  const onMove = (e: MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => { x.set(0); y.set(0); };
  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={reset} style={{ x: sx, y: sy }} className="inline-block">
      {children}
    </motion.div>
  );
}

export function SectionHead({ eyebrow, title, sub, action, actionTo }: { eyebrow: string; title: ReactNode; sub?: string; action?: string; actionTo?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <span className="font-latin text-[10px] font-medium text-gold">{eyebrow}</span>
        <h2 className="mt-3 text-3xl font-extrabold leading-[1.25] md:text-4xl">{title}</h2>
        {sub && <p className="mt-3 max-w-md text-sm leading-7 text-inksoft">{sub}</p>}
      </div>
      {action && actionTo && (
        <Link to={actionTo} className="btn btn-glass glass glass-hover px-6 py-3.5 text-xs">
          {action}
        </Link>
      )}
    </div>
  );
}

export function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const I = CATEGORY_ICONS[icon] ?? CATEGORY_ICONS.spark;
  return <I className={className} />;
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

export function Empty({ title, sub, cta, to }: { title: string; sub?: string; cta?: string; to?: string }) {
  return (
    <div className="glass rounded-[32px] p-12 text-center">
      <p className="text-lg font-extrabold">{title}</p>
      {sub && <p className="mt-2 text-sm text-inksoft">{sub}</p>}
      {cta && to && <Link to={to} className="btn btn-primary mt-6 px-7 py-3.5 text-sm">{cta}</Link>}
    </div>
  );
}
