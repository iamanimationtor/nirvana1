import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useStore } from "../store/store";
import { scrollLock } from "../lib/scroll-lock";
import { faNumber, formatPrice, img } from "../lib/core";
import { IconArrowLeft, IconCart, IconClose, IconHeart, IconMenu, IconMoon, IconSearch, IconSun, IconTrash, IconUser } from "./Icons";

const NAV = [
  { to: "/", label: "خانه" },
  { to: "/shop", label: "فروشگاه" },
  { to: "/about", label: "درباره ما" },
  { to: "/contact", label: "تماس" },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className={`grid h-10 w-10 place-items-center rounded-2xl ${light ? "bg-neon text-pine" : "bg-forest text-ivory dark:bg-neon dark:text-pine"}`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className={`text-base font-extrabold ${light ? "text-ivory" : ""}`}>نیروانا ۳دی</span>
        <span className={`font-latin mt-1 text-[8px] ${light ? "text-ivory/60" : "text-inksoft"}`}>NIRVANA 3D</span>
      </span>
    </Link>
  );
}

function WishPanel({ onClose }: { onClose: () => void }) {
  const { wishlist, toggleWish, products, add } = useStore();
  return (
    <div className="glass rounded-[26px] p-4 shadow-deep">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold">علاقه‌مندی‌ها</p>
        <span className="text-[11px] text-inksoft">{faNumber(wishlist.length)} مورد</span>
      </div>
      {wishlist.length === 0 ? (
        <p className="py-8 text-center text-xs text-inksoft">هنوز چیزی اضافه نکرده‌ای ♥</p>
      ) : (
        <ul className="no-scrollbar mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
          {wishlist.map((w) => {
            const p = products.find((x) => x.id === w.id);
            return (
              <li key={w.id} className="flex items-center gap-3 rounded-2xl bg-paper/60 p-2">
                <Link to={`/product/${w.slug}`} onClick={onClose} className="h-14 w-12 shrink-0 overflow-hidden rounded-xl">
                  <img src={img(w.image)} alt="" className="h-full w-full object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${w.slug}`} onClick={onClose} className="line-clamp-1 text-xs font-extrabold">{w.name}</Link>
                  <p className="mt-0.5 text-[11px] font-bold text-forest dark:text-neon">{formatPrice(w.price)}</p>
                </div>
                {p && p.stock > 0 && (
                  <button onClick={(e) => add(p, 1, e.currentTarget)} className="glass glass-hover grid h-8 w-8 place-items-center rounded-full" aria-label="افزودن">
                    <IconCart className="h-3.5 w-3.5" />
                  </button>
                )}
                {p && <button onClick={() => toggleWish(p)} className="grid h-8 w-8 place-items-center rounded-full text-inksoft hover:text-rose-500" aria-label="حذف"><IconTrash className="h-3.5 w-3.5" /></button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Navbar() {
  const { count, badgeKey, dropKey, setCartOpen, setSearchOpen, wishlist, theme, toggleTheme, user } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [wishOpen, setWishOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const cartControls = useAnimation();
  const loc = useLocation();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setMenuOpen(false); setWishOpen(false); }, [loc.pathname]);
  useEffect(() => { if (dropKey > 0) cartControls.start({ rotate: [0, -14, 12, -6, 0], scale: [1, 1.15, 1], transition: { duration: 0.6 } }); }, [dropKey, cartControls]);
  useEffect(() => { scrollLock("menu", menuOpen); return () => scrollLock("menu", false); }, [menuOpen]);

  return (
    <>
      <motion.header initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="fixed inset-x-0 top-0 z-50 pt-4">
        <div className="container-x">
          <div className={`glass flex items-center justify-between gap-4 rounded-full px-4 py-2.5 transition-all duration-500 ${scrolled ? "shadow-deep" : ""}`}>
            <div className="flex items-center gap-3">
              <button onClick={() => setMenuOpen(true)} className="glass glass-hover glass-icon text-ink lg:hidden" aria-label="منو">
                <IconMenu className="h-5 w-5" />
              </button>
              <Logo />
            </div>

            <nav className="hidden items-center gap-1 lg:flex">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `relative rounded-full px-4 py-2 text-sm font-bold transition-colors ${isActive ? "text-forest dark:text-neon" : "text-inksoft hover:text-ink"}`}>
                  {({ isActive }) => (
                    <>
                      {n.label}
                      {isActive && <motion.span layoutId="nav-dot" className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-neon shadow-[0_0_8px_rgba(163,245,90,.9)]" />}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <motion.button whileHover={{ y: -3, scale: 1.04 }} whileTap={{ scale: 0.92 }} onClick={toggleTheme} aria-label="تغییر تم" className="glass glass-hover glass-icon hidden text-ink sm:grid">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={theme} initial={{ rotate: -90, opacity: 0, scale: 0.5 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.5 }} transition={{ duration: 0.35 }} className="grid place-items-center">
                    {theme === "dark" ? <IconSun className="h-5 w-5 text-gold" /> : <IconMoon className="h-5 w-5 text-forest dark:text-neon" />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>

              <motion.button whileHover={{ y: -3, scale: 1.04 }} whileTap={{ scale: 0.92 }} onClick={() => setSearchOpen(true)} aria-label="جستجو" className="glass glass-hover glass-icon text-ink">
                <IconSearch className="h-5 w-5" />
              </motion.button>

              <div className="relative hidden sm:block">
                <motion.button whileHover={{ y: -3, scale: 1.04 }} whileTap={{ scale: 0.92 }} onClick={() => setWishOpen((v) => !v)} aria-label="علاقه‌مندی‌ها" className={"glass glass-hover glass-icon relative text-ink " + (wishOpen ? "border-neon/60" : "")}>
                  <IconHeart className="h-5 w-5" filled={wishlist.length > 0} />
                  {wishlist.length > 0 && <span className="absolute -end-0.5 -top-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-gold px-1 text-[10px] font-extrabold text-pine">{faNumber(wishlist.length)}</span>}
                </motion.button>
                <AnimatePresence>
                  {wishOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setWishOpen(false)} />
                      <motion.div initial={{ opacity: 0, y: -10, scale: 0.96, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8, scale: 0.97, filter: "blur(4px)" }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="absolute end-0 top-full z-20 mt-3 w-80">
                        <WishPanel onClose={() => setWishOpen(false)} />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <Link to={user ? "/account" : "/login"} aria-label="حساب کاربری">
                <motion.span whileHover={{ y: -3, scale: 1.04 }} whileTap={{ scale: 0.92 }} className="glass glass-hover glass-icon relative hidden text-ink sm:grid">
                  <IconUser className="h-5 w-5" />
                  {user && <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-neon shadow-[0_0_8px_rgba(163,245,90,.9)]" />}
                </motion.span>
              </Link>

              <div className="relative">
                <AnimatePresence>
                  {dropKey > 0 && <motion.span key={dropKey} initial={{ scale: 0.7, opacity: 0.9 }} animate={{ scale: 1.9, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: "easeOut" }} className="pointer-events-none absolute inset-0 rounded-full border-2 border-neon" />}
                </AnimatePresence>
                <motion.button animate={cartControls} whileTap={{ scale: 0.9 }} onClick={() => setCartOpen(true)} aria-label="سبد خرید" data-cart-anchor className="glass glass-hover glass-icon relative text-ink">
                  <IconCart className="h-5 w-5" />
                  <AnimatePresence mode="popLayout">
                    {count > 0 && (
                      <motion.span key={badgeKey} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }} className="absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-neon px-1 text-[10px] font-extrabold text-pine shadow-[0_0_12px_rgba(163,245,90,.7)]">
                        {faNumber(count)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* mobile nav */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-[80] bg-pine/50 backdrop-blur-sm" />
            <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="fixed inset-y-0 end-0 z-[90] flex w-[86%] max-w-sm flex-col bg-canvas p-6">
              <div className="flex items-center justify-between">
                <Logo />
                <button onClick={() => setMenuOpen(false)} className="glass glass-icon text-ink" aria-label="بستن"><IconClose className="h-5 w-5" /></button>
              </div>
              <nav className="mt-10 flex flex-col gap-1">
                {NAV.map((n, i) => (
                  <motion.div key={n.to} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                    <NavLink to={n.to} end={n.to === "/"} className={({ isActive }) => `flex items-center justify-between rounded-2xl px-4 py-4 text-lg font-extrabold ${isActive ? "bg-forest text-ivory dark:bg-neon dark:text-pine" : "hover:bg-tint"}`}>
                      {n.label}<IconArrowLeft className="h-4 w-4 opacity-50" />
                    </NavLink>
                  </motion.div>
                ))}
              </nav>
              {wishlist.length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-xs font-extrabold text-inksoft">علاقه‌مندی‌ها ({faNumber(wishlist.length)})</p>
                  <ul className="no-scrollbar flex max-h-40 flex-col gap-2 overflow-y-auto">
                    {wishlist.map((w) => (
                      <li key={w.id}>
                        <Link to={`/product/${w.slug}`} className="flex items-center gap-3 rounded-2xl bg-paper/70 p-2">
                          <img src={img(w.image)} alt="" className="h-12 w-10 rounded-xl object-cover" />
                          <span className="min-w-0 flex-1 truncate text-xs font-extrabold">{w.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-auto flex flex-col gap-3 pt-6">
                <Link to={user ? "/account" : "/login"} className="btn btn-primary w-full py-4 text-sm">{user ? `حساب ${user.name}` : "ورود / ثبت‌نام"}</Link>
                <button type="button" onClick={toggleTheme} className="btn btn-glass glass w-full py-4 text-sm">{theme === "dark" ? "حالت روشن" : "حالت تاریک"}</button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
