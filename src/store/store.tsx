import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { get, post } from "../lib/api";
import { scrollLock } from "../lib/scroll-lock";
import {
  DEFAULT_SETTINGS, MAX_CART_ITEM_QUANTITY, SEED_CATEGORIES, SEED_PRODUCTS, faNumber, img,
  type CartItem, type Category, type Product, type StoreSettings, type User, type WishItem,
} from "../lib/core";

interface Flight { key: number; src: string; x: number; y: number; w: number; h: number; dx: number; dy: number; lift: number }

interface StoreValue {
  products: Product[];
  categories: Category[];
  settings: StoreSettings;
  loading: boolean;
  refreshCatalog: () => Promise<void>;
  items: CartItem[];
  count: number;
  total: number;
  add: (p: Product, qty?: number, source?: HTMLElement | null, variant?: string) => void;
  remove: (id: number) => void;
  setQty: (id: number, qty: number) => void;
  clear: () => void;
  cartOpen: boolean; setCartOpen: (v: boolean) => void;
  searchOpen: boolean; setSearchOpen: (v: boolean) => void;
  quickView: Product | null; setQuickView: (p: Product | null) => void;
  wishlist: WishItem[]; toggleWish: (p: Product) => void; isWished: (id: number) => boolean;
  toast: { id: number; text: string } | null; notify: (t: string) => void;
  dropKey: number; badgeKey: number;
  theme: "light" | "dark"; toggleTheme: () => void;
  user: User | null; setUser: (u: User | null) => void; logout: () => Promise<void>; authReady: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

function load<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);
  const [categories, setCategories] = useState<Category[]>(SEED_CATEGORIES);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CartItem[]>(() =>
    load<CartItem[]>("nirvana-cart", []).filter((i) => Number.isInteger(i.id) && i.qty > 0).map((i) => ({ ...i, qty: Math.min(Math.floor(i.qty), MAX_CART_ITEM_QUANTITY) })),
  );
  const [wishlist, setWishlist] = useState<WishItem[]>(() => load("nirvana-wish", []));
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [dropKey, setDropKey] = useState(0);
  const [badgeKey, setBadgeKey] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">(() => (document.documentElement.classList.contains("dark") ? "dark" : "light"));
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const toastId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyKey = useRef(0);
  const pendingToast = useRef("محصول به سبد خرید اضافه شد ✓");
  const productsRef = useRef(products);
  productsRef.current = products;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const refreshCatalog = useCallback(async () => {
    try {
      const data = await get<{ products: Product[]; categories: Category[]; settings: StoreSettings }>("/catalog");
      if (data.products?.length) setProducts(data.products);
      if (data.categories?.length) setCategories(data.categories);
      if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    } catch { /* keep fallback catalog */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refreshCatalog();
    get<{ user: User | null }>("/auth/me").then((r) => setUser(r.user)).catch(() => {}).finally(() => setAuthReady(true));
  }, [refreshCatalog]);

  useEffect(() => { try { localStorage.setItem("nirvana-cart", JSON.stringify(items)); } catch { /* */ } }, [items]);
  useEffect(() => { try { localStorage.setItem("nirvana-wish", JSON.stringify(wishlist)); } catch { /* */ } }, [wishlist]);

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "dark" ? "#10150f" : "#F7F2E7");
    try { localStorage.setItem("nirvana-theme", JSON.stringify(next)); } catch { /* */ }
  }, []);

  const notify = useCallback((text: string) => {
    const id = ++toastId.current;
    setToast({ id, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    scrollLock("overlays", cartOpen || searchOpen || quickView !== null);
    return () => scrollLock("overlays", false);
  }, [cartOpen, searchOpen, quickView]);

  /* قیمت سبد را با کاتالوگ زنده همگام نگه دار */
  useEffect(() => {
    setItems((prev) => {
      let changed = false;
      const next = prev.map((i) => {
        const p = products.find((x) => x.id === i.id);
        if (!p) return i;
        const image = p.images[0] || i.image;
        if (p.price === i.price && p.name === i.name && image === i.image) return i;
        changed = true;
        return { ...i, price: p.price, name: p.name, image };
      });
      return changed ? next : prev;
    });
  }, [products]);

  const finishAdd = useCallback((text = "محصول به سبد خرید اضافه شد ✓") => { setDropKey((k) => k + 1); notify(text); }, [notify]);

  const getCartAnchor = useCallback((): HTMLElement | null => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-anchor]"));
    return els.find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top < window.innerHeight; }) ?? null;
  }, []);

  const add = useCallback((p: Product, qty = 1, source?: HTMLElement | null, variant?: string) => {
    const live = productsRef.current.find((x) => x.id === p.id) ?? p;
    if (live.stock <= 0) { notify("این محصول فعلاً ناموجود است"); return; }
    const cap = Math.min(MAX_CART_ITEM_QUANTITY, live.stock);
    const found = itemsRef.current.find((i) => i.id === p.id);
    const nextQty = Math.min((found?.qty ?? 0) + qty, cap);
    const capped = nextQty < (found?.qty ?? 0) + qty;
    setItems((prev) => {
      const cur = prev.find((i) => i.id === p.id);
      const qtyNow = Math.min((cur?.qty ?? 0) + qty, cap);
      if (cur) return prev.map((i) => (i.id === p.id ? { ...i, qty: qtyNow, variant: variant ?? i.variant, price: live.price } : i));
      return [...prev, { id: p.id, slug: p.slug, name: p.name, price: live.price, image: p.images[0] ?? "", qty: Math.min(qty, cap), variant }];
    });
    pendingToast.current = capped ? `حداکثر ${faNumber(cap)} عدد از این محصول موجود است` : "محصول به سبد خرید اضافه شد ✓";
    setBadgeKey((k) => k + 1);
    if (source && !reduced) {
      const anchor = getCartAnchor();
      if (anchor) {
        const s = source.getBoundingClientRect(); const t = anchor.getBoundingClientRect();
        const compact = window.innerWidth < 768;
        flyKey.current += 1;
        setFlight({ key: flyKey.current, src: img(p.images[0] ?? ""), x: s.left, y: s.top, w: Math.min(s.width, 220), h: Math.min(s.height, 220), dx: t.left + t.width / 2 - (s.left + s.width / 2), dy: t.top + t.height / 2 - (s.top + s.height / 2), lift: compact ? 60 : 130 });
        return;
      }
    }
    finishAdd(pendingToast.current);
  }, [getCartAnchor, finishAdd, reduced, notify]);

  const onFlightDone = useCallback((key: number) => { if (flyKey.current !== key) return; setFlight(null); finishAdd(); }, [finishAdd]);
  const remove = useCallback((id: number) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
  const setQty = useCallback((id: number, qty: number) => {
    const p = productsRef.current.find((x) => x.id === id);
    const cap = Math.min(MAX_CART_ITEM_QUANTITY, p ? Math.max(p.stock, 0) : MAX_CART_ITEM_QUANTITY);
    if (qty > cap) { notify(cap <= 0 ? "این محصول ناموجود شده است" : `حداکثر ${faNumber(cap)} عدد موجود است`); qty = cap; }
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty } : i))));
  }, [notify]);
  const clear = useCallback(() => setItems([]), []);

  const toggleWish = useCallback((p: Product) => {
    setWishlist((prev) => {
      const exists = prev.some((w) => w.id === p.id);
      notify(exists ? "از علاقه‌مندی‌ها حذف شد" : "به علاقه‌مندی‌ها اضافه شد ♥");
      return exists ? prev.filter((w) => w.id !== p.id) : [...prev, { id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.images[0] ?? "" }];
    });
  }, [notify]);
  const isWished = useCallback((id: number) => wishlist.some((w) => w.id === id), [wishlist]);
  const logout = useCallback(async () => { try { await post("/auth/logout"); } catch { /* */ } setUser(null); notify("از حساب خارج شدید"); }, [notify]);

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const total = useMemo(() => items.reduce((s, i) => s + i.qty * i.price, 0), [items]);

  const value: StoreValue = useMemo(() => ({
    products, categories, settings, loading, refreshCatalog, items, count, total, add, remove, setQty, clear, cartOpen, setCartOpen, searchOpen, setSearchOpen,
    quickView, setQuickView, wishlist, toggleWish, isWished, toast, notify, dropKey, badgeKey, theme, toggleTheme, user, setUser, logout, authReady,
  }), [products, categories, settings, loading, refreshCatalog, items, count, total, add, remove, setQty, clear, cartOpen, searchOpen, quickView, wishlist, toggleWish, isWished, toast, notify, dropKey, badgeKey, theme, toggleTheme, user, logout, authReady]);

  return (
    <StoreContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {flight && (
          <motion.img
            key={flight.key}
            src={flight.src}
            alt=""
            initial={{ x: flight.x, y: flight.y, width: flight.w, height: flight.h, opacity: 1, borderRadius: 24 }}
            animate={{ x: [flight.x, flight.x + flight.dx * 0.5, flight.x + flight.dx], y: [flight.y, flight.y + flight.dy * 0.5 - flight.lift, flight.y + flight.dy], width: [flight.w, flight.w * 0.6, 24], height: [flight.h, flight.h * 0.6, 24], opacity: [1, 1, 0.2], borderRadius: [24, 40, 999] }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], times: [0, 0.55, 1] }}
            onAnimationComplete={() => onFlightDone(flight.key)}
            className="pointer-events-none fixed left-0 top-0 z-[200] object-cover shadow-deep"
          />
        )}
      </AnimatePresence>
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[210] flex justify-center px-4">
        <AnimatePresence>
          {toast && (
            <motion.div key={toast.id} initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="glass flex items-center gap-3 rounded-full px-5 py-3 text-sm font-bold text-ink">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-neon" />
              </span>
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
