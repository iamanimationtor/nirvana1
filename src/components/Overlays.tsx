import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store/store";
import { discountOf, faNumber, formatPrice, img, MAX_CART_ITEM_QUANTITY } from "../lib/core";
import { IconArrowLeft, IconCart, IconClose, IconHeart, IconMinus, IconPlus, IconSearch, IconTrash } from "./Icons";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Cart drawer ─────────────────────────────────── */
export function CartDrawer() {
  const { cartOpen, setCartOpen, items, setQty, remove, total, count, clear, settings, products } = useStore();
  const nav = useNavigate();
  const shipping = Number(settings["orders.shippingFee"]) || 0;
  const unavailable = items.some((it) => { const p = products.find((x) => x.id === it.id); return !p || p.status === "draft" || p.stock < it.qty; });
  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCartOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen, setCartOpen]);
  return (
    <AnimatePresence>
      {cartOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} className="fixed inset-0 z-[100] bg-pine/45 backdrop-blur-sm" />
          <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: 0.55, ease: EASE }} className="fixed inset-y-0 start-0 z-[110] flex w-full max-w-md flex-col bg-canvas shadow-deep">
            <div className="flex items-center justify-between border-b border-linec px-6 py-5">
              <div>
                <p className="text-lg font-extrabold">سبد خرید</p>
                <p className="text-xs text-inksoft">{faNumber(count)} کالا</p>
              </div>
              <button onClick={() => setCartOpen(false)} className="glass glass-hover glass-icon text-ink" aria-label="بستن"><IconClose className="h-5 w-5" /></button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <span className="glass grid h-20 w-20 place-items-center rounded-full text-forest dark:text-neon"><IconCart className="h-8 w-8" /></span>
                <p className="text-base font-extrabold">سبد خرید خالی است</p>
                <p className="text-xs text-inksoft">قطعه‌ای که دوست داری را انتخاب کن.</p>
                <button onClick={() => { setCartOpen(false); nav("/shop"); }} className="btn btn-primary mt-2 px-7 py-3.5 text-sm">رفتن به فروشگاه</button>
              </div>
            ) : (
              <>
                <ul className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-6 py-5">
                  <AnimatePresence initial={false}>
                    {items.map((it) => (
                      <motion.li key={it.id} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0 }} transition={{ duration: 0.35 }} className="flex gap-3 rounded-3xl border border-linec bg-paper/70 p-3">
                        <Link to={`/product/${it.slug}`} onClick={() => setCartOpen(false)} className="h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-tint">
                          <img src={img(it.image)} alt="" className="h-full w-full object-cover" />
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <Link to={`/product/${it.slug}`} onClick={() => setCartOpen(false)} className="line-clamp-1 text-sm font-extrabold">{it.name}</Link>
                          {it.variant && <span className="mt-0.5 text-[11px] text-inksoft">رنگ: {it.variant}</span>}
                          <span className="mt-1 text-xs font-bold text-forest dark:text-neon">{formatPrice(it.price)}</span>
                          <div className="mt-auto flex items-center justify-between">
                            <div className="glass flex items-center gap-1 rounded-full p-1">
                              <button onClick={() => setQty(it.id, it.qty - 1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-paper" aria-label="کمتر"><IconMinus className="h-3.5 w-3.5" /></button>
                              <span className="w-6 text-center text-xs font-extrabold">{faNumber(it.qty)}</span>
                              <button onClick={() => setQty(it.id, it.qty + 1)} disabled={it.qty >= MAX_CART_ITEM_QUANTITY} className="grid h-7 w-7 place-items-center rounded-full hover:bg-paper disabled:opacity-30" aria-label="بیشتر"><IconPlus className="h-3.5 w-3.5" /></button>
                            </div>
                            <button onClick={() => remove(it.id)} className="grid h-8 w-8 place-items-center rounded-full text-inksoft transition-colors hover:text-rose-500" aria-label="حذف"><IconTrash className="h-4 w-4" /></button>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                <div className="border-t border-linec px-6 py-5">
                  <div className="flex items-center justify-between text-xs text-inksoft"><span>جمع کالاها</span><span>{formatPrice(total)}</span></div>
                  <div className="mt-1 flex items-center justify-between text-xs text-inksoft"><span>هزینه ارسال</span><span>{shipping ? formatPrice(shipping) : "محاسبه در مرحلهٔ بعد"}</span></div>
                  <div className="mt-3 flex items-center justify-between"><span className="text-sm font-extrabold">مبلغ قابل پرداخت</span><span className="text-lg font-extrabold text-forest dark:text-neon">{formatPrice(total + shipping)}</span></div>
                  {unavailable && <p className="mt-3 rounded-2xl bg-rose-500/10 px-3 py-2 text-[11px] font-bold text-rose-600">موجودی بعضی کالاها کافی نیست. تعداد را کم کن یا آن‌ها را حذف کن.</p>}
                  <div className="mt-4 flex gap-2">
                    <button type="button" disabled={unavailable} onClick={() => { setCartOpen(false); nav("/checkout"); }} className="btn btn-primary flex-1 py-4 text-sm disabled:opacity-40">ادامه و پرداخت<IconArrowLeft className="h-4 w-4" /></button>
                    <button onClick={clear} className="btn btn-glass glass px-4 py-4 text-xs">خالی کردن</button>
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Search overlay ──────────────────────────────── */
export function SearchOverlay() {
  const { searchOpen, setSearchOpen, products, categories } = useStore();
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  useEffect(() => { if (searchOpen) { setQ(""); setTimeout(() => ref.current?.focus(), 80); } }, [searchOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSearchOpen(false); if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearchOpen]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return products.filter((p) => [p.name, p.nameEn, p.categoryName, p.shortDesc, p.material].join(" ").toLowerCase().includes(s)).slice(0, 6);
  }, [q, products]);

  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-start justify-center bg-pine/50 px-4 pt-24 backdrop-blur-md" onClick={() => setSearchOpen(false)}>
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} transition={{ duration: 0.4, ease: EASE }} onClick={(e) => e.stopPropagation()} className="glass w-full max-w-2xl rounded-[32px] p-4 shadow-deep">
            <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) { setSearchOpen(false); nav(`/shop?q=${encodeURIComponent(q.trim())}`); } }} className="relative">
              <IconSearch className="pointer-events-none absolute start-5 top-1/2 h-5 w-5 -translate-y-1/2 text-inksoft" />
              <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="دنبال چه چیزی می‌گردی؟ گلدان، چراغ، فیگور…" className="field !ps-13 !py-4 text-base" />
              <button type="button" onClick={() => setSearchOpen(false)} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full border border-linec px-2.5 py-1 font-latin text-[9px] text-inksoft">ESC</button>
            </form>

            {q.trim() === "" ? (
              <div className="px-2 pb-2 pt-5">
                <p className="text-[11px] font-bold text-inksoft">دسته‌بندی‌ها</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button key={c.id} onClick={() => { setSearchOpen(false); nav(`/shop?cat=${c.slug}`); }} className="glass glass-hover rounded-full px-4 py-2 text-xs font-bold">{c.name}</button>
                  ))}
                </div>
              </div>
            ) : results.length === 0 ? (
              <p className="px-2 py-10 text-center text-sm text-inksoft">چیزی پیدا نشد؛ عبارت دیگری امتحان کن.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1">
                {results.map((p, i) => (
                  <motion.li key={p.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                    <Link to={`/product/${p.slug}`} onClick={() => setSearchOpen(false)} className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-paper/70">
                      <span className="h-14 w-12 overflow-hidden rounded-xl bg-tint"><img src={img(p.images[0])} alt="" className="h-full w-full object-cover" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold">{p.name}</span>
                        <span className="block text-[11px] text-inksoft">{p.categoryName}</span>
                      </span>
                      <span className="text-xs font-extrabold text-forest dark:text-neon">{formatPrice(p.price)}</span>
                    </Link>
                  </motion.li>
                ))}
                <li className="pt-1">
                  <button onClick={() => { setSearchOpen(false); nav(`/shop?q=${encodeURIComponent(q.trim())}`); }} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-xs font-bold text-forest hover:bg-paper/70 dark:text-neon">مشاهده همهٔ نتایج<IconArrowLeft className="h-3.5 w-3.5" /></button>
                </li>
              </ul>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Quick view modal ────────────────────────────── */
export function QuickViewModal() {
  const { quickView: p, setQuickView, add, toggleWish, isWished } = useStore();
  const [variant, setVariant] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => { if (p) { setVariant(p.variants[0] ?? ""); setQty(1); setImgIdx(0); } }, [p]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && setQuickView(null); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [setQuickView]);

  return (
    <AnimatePresence>
      {p && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-end justify-center bg-pine/55 backdrop-blur-md sm:items-center sm:p-6" onClick={() => setQuickView(null)}>
          <motion.div initial={{ opacity: 0, y: 60, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }} transition={{ duration: 0.5, ease: EASE }} onClick={(e) => e.stopPropagation()} className="relative grid max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-[36px] bg-canvas shadow-deep sm:rounded-[36px] md:grid-cols-2">
            <button onClick={() => setQuickView(null)} className="glass glass-hover glass-icon absolute end-4 top-4 z-10 text-ink" aria-label="بستن"><IconClose className="h-5 w-5" /></button>
            <div className="relative aspect-[4/5] bg-tint md:aspect-auto md:min-h-[520px]">
              <AnimatePresence mode="wait">
                <motion.img key={imgIdx} ref={imgRef} src={img(p.images[imgIdx])} alt={p.name} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="absolute inset-0 h-full w-full object-cover" />
              </AnimatePresence>
              <div className="absolute bottom-4 start-4 flex gap-2">
                {p.images.map((src, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} className={`h-14 w-12 overflow-hidden rounded-xl border-2 transition-all ${i === imgIdx ? "border-neon" : "border-transparent opacity-70"}`}><img src={img(src)} alt="" className="h-full w-full object-cover" /></button>
                ))}
              </div>
            </div>
            <div className="flex flex-col p-7 md:p-9">
              <span className="font-latin text-[10px] text-gold">{p.nameEn}</span>
              <h3 className="mt-2 text-2xl font-extrabold leading-snug">{p.name}</h3>
              <p className="mt-1 text-xs text-inksoft">{p.categoryName} · {p.material}</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-xl font-extrabold text-forest dark:text-neon">{formatPrice(p.price)}</span>
                {discountOf(p) > 0 && p.oldPrice && <><span className="text-sm text-inksoft line-through">{formatPrice(p.oldPrice)}</span><span className="rounded-full bg-neon px-2 py-0.5 text-[10px] font-extrabold text-pine">{faNumber(discountOf(p))}٪</span></>}
              </div>
              <p className="mt-5 text-sm leading-7 text-inksoft">{p.shortDesc}</p>
              {p.variants.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-bold">رنگ / نسخه</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.variants.map((v) => <button key={v} onClick={() => setVariant(v)} className={`rounded-full border px-4 py-2 text-xs font-bold transition-all ${variant === v ? "border-forest bg-forest text-ivory dark:border-neon dark:bg-neon dark:text-pine" : "border-linec hover:border-forest/40"}`}>{v}</button>)}
                  </div>
                </div>
              )}
              <div className="mt-6 flex items-center gap-3">
                <div className="glass flex items-center gap-1 rounded-full p-1">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper" aria-label="کمتر"><IconMinus className="h-4 w-4" /></button>
                  <span className="w-8 text-center text-sm font-extrabold">{faNumber(qty)}</span>
                  <button onClick={() => setQty(Math.min(MAX_CART_ITEM_QUANTITY, qty + 1, Math.max(1, p.stock)))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper" aria-label="بیشتر"><IconPlus className="h-4 w-4" /></button>
                </div>
                <span className="text-xs text-inksoft">{p.stock > 0 ? `${faNumber(p.stock)} عدد موجود · ${p.prepTime}` : "ناموجود — پیش‌ثبت سفارش"}</span>
              </div>
              <div className="mt-auto flex gap-2 pt-7">
                <button type="button" disabled={p.stock <= 0} onClick={() => { add(p, qty, imgRef.current, variant); setQuickView(null); }} className="btn btn-primary flex-1 py-4 text-sm"><IconCart className="h-4 w-4" />افزودن به سبد</button>
                <button type="button" onClick={() => toggleWish(p)} className={`glass glass-hover glass-icon !h-13 !w-13 ${isWished(p.id) ? "text-rose-500" : "text-ink"}`} aria-label="علاقه‌مندی"><IconHeart className="h-5 w-5" filled={isWished(p.id)} /></button>
              </div>
              <Link to={`/product/${p.slug}`} onClick={() => setQuickView(null)} className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold text-forest hover:underline dark:text-neon">مشاهده صفحهٔ کامل محصول<IconArrowLeft className="h-3.5 w-3.5" /></Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}