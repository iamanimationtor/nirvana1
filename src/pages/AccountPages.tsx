import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useStore } from "../store/store";
import { del, get, getWithToken, post, put, isDemoBackend } from "../lib/api";
import { STATUS_FA, faDate, faNumber, formatPrice, img, type Address, type Order, type User } from "../lib/core";
import { Empty, Reveal, Spinner } from "../components/ui";
import { IconArrowLeft, IconBox, IconCheck, IconClose, IconLock, IconLogout, IconPin, IconTrash, IconUser } from "../components/Icons";
import { usePageTitle } from "./StorePages";

const IRAN_PROVINCES = ["تهران", "البرز", "اصفهان", "فارس", "خراسان رضوی", "آذربایجان شرقی", "آذربایجان غربی", "خوزستان", "مازندران", "گیلان", "کرمان", "یزد", "قم", "قزوین", "مرکزی", "همدان", "کرمانشاه", "کردستان", "لرستان", "گلستان", "سمنان", "زنجان", "اردبیل", "بوشهر", "هرمزگان", "سیستان و بلوچستان", "چهارمحال و بختیاری", "کهگیلویه و بویراحمد", "ایلام", "خراسان شمالی", "خراسان جنوبی"];

function StatusBadge({ s }: { s: string }) {
  const color = ["paid", "delivered", "confirmed", "verified"].includes(s) ? "bg-neon/20 text-forest dark:text-neon" : ["cancelled", "failed", "returned"].includes(s) ? "bg-rose-500/15 text-rose-600" : "bg-gold/20 text-gold";
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${color}`}>{STATUS_FA[s] ?? s}</span>;
}

/* ── Login / Register ─────────────────────────────── */
export function AuthPage({ mode }: { mode: "login" | "register" | "forgot" }) {
  usePageTitle(mode === "login" ? "ورود" : mode === "register" ? "ثبت‌نام" : "بازیابی رمز");
  const { setUser, notify, user } = useStore();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { if (user && mode !== "forgot") nav(sp.get("next") || "/account", { replace: true }); }, [user, nav, sp, mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      if (mode === "forgot") { const r = await post<{ message: string }>("/auth/forgot", { email: f.email }); setMsg(r.message); }
      else { const r = await post<{ user: User }>(`/auth/${mode}`, f); setUser(r.user); notify(mode === "login" ? `خوش آمدی ${r.user.name} ✓` : "حساب شما ساخته شد ✓"); }
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <Reveal className="hidden lg:block">
          <div className="relative aspect-[4/5] max-w-md overflow-hidden rounded-[40px] shadow-deep">
            <img src={img("/images/product-lamp.jpg")} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-pine/80 to-transparent" />
            <div className="absolute inset-x-8 bottom-8 text-ivory"><span className="font-latin text-[10px] text-goldsoft">MEMBERS</span><p className="mt-2 text-2xl font-extrabold leading-snug">سفارش‌ها، آدرس‌ها و آثار مورد علاقه‌ات؛ همه یک‌جا.</p></div>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <form onSubmit={submit} className="glass mx-auto w-full max-w-md rounded-[36px] p-8 md:p-10">
            <span className="font-latin text-[10px] text-gold">{mode.toUpperCase()}</span>
            <h1 className="mt-2 text-3xl font-extrabold">{mode === "login" ? <>ورود به <span className="text-gold">نیروانا</span></> : mode === "register" ? <>ساخت <span className="text-gold">حساب</span> جدید</> : <>بازیابی <span className="text-gold">رمز عبور</span></>}</h1>
            <p className="mt-2 text-xs text-inksoft">{mode === "login" ? "برای پیگیری سفارش‌ها وارد شو." : mode === "register" ? "کمتر از یک دقیقه طول می‌کشد." : "ایمیل حساب را وارد کن."}</p>
            {isDemoBackend() && mode === "login" && <p className="mt-4 rounded-2xl bg-gold/10 px-4 py-2.5 text-[11px] leading-5 text-inksoft">حالت نمایشی: هر حسابی که ثبت‌نام کنی در همین مرورگر ذخیره می‌شود.</p>}
            <div className="mt-7 space-y-3">
              {mode === "register" && <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="نام و نام خانوادگی" className="field" />}
              <input required type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="email@example.com" className="field text-left" />
              {mode === "register" && <input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="09xxxxxxxxx" className="field text-left" />}
              {mode !== "forgot" && <input required type="password" dir="ltr" minLength={mode === "register" ? 8 : 1} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="رمز عبور" className="field text-left" />}
            </div>
            {err && <p className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-600">{err}</p>}
            {msg && <p className="mt-4 rounded-2xl bg-neon/15 px-4 py-2.5 text-xs font-bold text-forest dark:text-neon">{msg}</p>}
            <button disabled={busy} className="btn btn-primary mt-6 w-full py-4 text-sm">{busy ? <Spinner /> : <>{mode === "login" ? "ورود" : mode === "register" ? "ثبت‌نام" : "ارسال لینک بازیابی"}<IconArrowLeft className="h-4 w-4" /></>}</button>
            <div className="mt-5 flex items-center justify-between text-xs text-inksoft">
              {mode === "login" ? <><Link to="/register" className="font-bold text-forest hover:underline dark:text-neon">حساب نداری؟ ثبت‌نام</Link><Link to="/forgot-password" className="hover:underline">فراموشی رمز</Link></> : <Link to="/login" className="font-bold text-forest hover:underline dark:text-neon">حساب داری؟ ورود</Link>}
            </div>
          </form>
        </Reveal>
      </div>
    </div>
  );
}

/* ── Reset password (customer, via emailed token) ── */
export function ResetPasswordPage() {
  usePageTitle("تعیین رمز جدید");
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { notify } = useStore();
  const token = sp.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await post("/auth/reset", { token, password }); notify("رمز عبور تغییر کرد ✓ حالا وارد شوید"); nav("/login", { replace: true }); }
    catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center px-4 pt-28 pb-16">
      <Reveal className="w-full max-w-md">
        <form onSubmit={submit} className="glass rounded-[36px] p-8 md:p-10">
          <span className="font-latin text-[10px] text-gold">RESET PASSWORD</span>
          <h1 className="mt-2 text-3xl font-extrabold">تعیین <span className="text-gold">رمز جدید</span></h1>
          {!token ? (
            <p className="mt-5 rounded-2xl bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600">لینک نامعتبر است؛ از صفحهٔ <Link to="/forgot-password" className="underline">فراموشی رمز</Link> دوباره درخواست بده.</p>
          ) : (
            <>
              <p className="mt-2 text-xs text-inksoft">رمز جدید حساب را وارد کن (حداقل ۸ کاراکتر).</p>
              <input required type="password" dir="ltr" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز جدید" className="field mt-6 text-left" />
              {err && <p className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-600">{err}</p>}
              <button disabled={busy} className="btn btn-primary mt-5 w-full py-4 text-sm">{busy ? <Spinner /> : <>ثبت رمز جدید<IconArrowLeft className="h-4 w-4" /></>}</button>
            </>
          )}
        </form>
      </Reveal>
    </div>
  );
}

/* ── Account ──────────────────────────────────────── */
export function AccountPage() {
  usePageTitle("حساب کاربری");
  const { user, setUser, logout, notify, authReady } = useStore();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") ?? "orders";
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [profile, setProfile] = useState({ name: "", phone: "" });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [addr, setAddr] = useState({ fullName: "", phone: "", province: "تهران", city: "", line: "", postalCode: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (authReady && !user) nav("/login?next=/account", { replace: true }); }, [authReady, user, nav]);
  useEffect(() => { if (user) { setProfile({ name: user.name, phone: user.phone }); get<{ orders: Order[] }>("/account/orders").then((r) => setOrders(r.orders)).catch(() => setOrders([])); get<{ addresses: Address[] }>("/account/addresses").then((r) => setAddresses(r.addresses)).catch(() => {}); } }, [user]);
  if (!user) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;

  const TABS = [{ k: "orders", l: "سفارش‌ها", i: IconBox }, { k: "addresses", l: "آدرس‌ها", i: IconPin }, { k: "profile", l: "پروفایل", i: IconUser }, { k: "password", l: "رمز عبور", i: IconLock }];
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { notify((e as Error).message); } finally { setBusy(false); } };

  return (
    <div className="min-h-screen pt-32 pb-24">
      <div className="container-x">
        <Reveal>
          <span className="font-latin text-[10px] text-gold">ACCOUNT</span>
          <h1 className="mt-3 text-4xl font-extrabold">سلام، <span className="text-gold">{user.name}</span></h1>
          <p className="mt-2 text-xs text-inksoft" dir="ltr">{user.email}</p>
        </Reveal>
        <div className="mt-10 grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="glass h-fit rounded-[28px] p-3 lg:sticky lg:top-28">
            {TABS.map((t) => <button key={t.k} onClick={() => setSp({ tab: t.k })} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${tab === t.k ? "bg-forest text-ivory dark:bg-neon dark:text-pine" : "hover:bg-paper/70"}`}><t.i className="h-4.5 w-4.5" />{t.l}</button>)}
            {user.role !== "customer" && <Link to="/admin" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-gold hover:bg-paper/70"><IconLock className="h-4.5 w-4.5" />پنل مدیریت</Link>}
            <button onClick={async () => { await logout(); nav("/"); }} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-rose-500 hover:bg-paper/70"><IconLogout className="h-4.5 w-4.5" />خروج</button>
          </aside>

          <div>
            {tab === "orders" && (orders === null ? <Spinner /> : orders.length === 0 ? <Empty title="هنوز سفارشی ثبت نکرده‌ای" cta="رفتن به فروشگاه" to="/shop" /> : (
              <div className="space-y-4">
                {orders.map((o) => (
                  <Link key={o.id} to={`/orders/${o.publicId}`} className="glass glass-hover block rounded-[28px] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><p className="font-latin text-[10px] text-gold">{o.publicId}</p><p className="mt-1 text-xs text-inksoft">{faDate(o.createdAt)}</p></div>
                      <div className="flex gap-2"><StatusBadge s={o.status} /><StatusBadge s={o.paymentStatus} /></div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex -space-x-3 space-x-reverse">{o.items.slice(0, 4).map((it, i) => <span key={i} className="h-12 w-10 overflow-hidden rounded-xl border-2 border-canvas bg-tint"><img src={img(it.image)} alt="" className="h-full w-full object-cover" /></span>)}</div>
                      <p className="text-sm font-extrabold text-forest dark:text-neon">{formatPrice(o.total)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ))}

            {tab === "addresses" && (
              <div className="space-y-4">
                {addresses.map((a) => (
                  <div key={a.id} className="glass flex items-start justify-between gap-4 rounded-[28px] p-5">
                    <div><p className="text-sm font-extrabold">{a.fullName} <span className="text-xs text-inksoft">· {a.phone}</span></p><p className="mt-1 text-xs leading-6 text-inksoft">{a.province}، {a.city}، {a.line} {a.postalCode && `— کدپستی ${a.postalCode}`}</p></div>
                    <button onClick={() => run(async () => { await del(`/account/addresses/${a.id}`); setAddresses((x) => x.filter((y) => y.id !== a.id)); })} className="text-inksoft hover:text-rose-500"><IconTrash className="h-4 w-4" /></button>
                  </div>
                ))}
                <form onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await post<{ address: Address }>("/account/addresses", addr); setAddresses((x) => [...x, r.address]); setAddr({ fullName: "", phone: "", province: "تهران", city: "", line: "", postalCode: "" }); notify("آدرس ذخیره شد ✓"); }); }} className="glass rounded-[28px] p-6">
                  <p className="text-sm font-extrabold">افزودن آدرس جدید</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input required value={addr.fullName} onChange={(e) => setAddr({ ...addr, fullName: e.target.value })} placeholder="نام گیرنده" className="field" />
                    <input required value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} placeholder="شماره تماس" className="field" dir="ltr" />
                    <select value={addr.province} onChange={(e) => setAddr({ ...addr, province: e.target.value })} className="field">{IRAN_PROVINCES.map((p) => <option key={p}>{p}</option>)}</select>
                    <input required value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} placeholder="شهر" className="field" />
                    <input required value={addr.line} onChange={(e) => setAddr({ ...addr, line: e.target.value })} placeholder="آدرس کامل" className="field sm:col-span-2" />
                    <input value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} placeholder="کد پستی" className="field" dir="ltr" />
                  </div>
                  <button disabled={busy} className="btn btn-primary mt-4 px-7 py-3.5 text-sm">ذخیره آدرس</button>
                </form>
              </div>
            )}

            {tab === "profile" && (
              <form onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await put<{ user: User }>("/account/profile", profile); setUser(r.user); notify("پروفایل به‌روز شد ✓"); }); }} className="glass max-w-lg rounded-[28px] p-6">
                <p className="text-sm font-extrabold">اطلاعات حساب</p>
                <div className="mt-4 space-y-3">
                  <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="نام" className="field" />
                  <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="شماره تماس" className="field" dir="ltr" />
                  <input value={user.email} disabled className="field opacity-60" dir="ltr" />
                </div>
                <button disabled={busy} className="btn btn-primary mt-4 px-7 py-3.5 text-sm">ذخیره</button>
              </form>
            )}

            {tab === "password" && (
              <form onSubmit={(e) => { e.preventDefault(); run(async () => { await post("/account/password", pw); setPw({ current: "", next: "" }); notify("رمز عبور تغییر کرد ✓"); }); }} className="glass max-w-lg rounded-[28px] p-6">
                <p className="text-sm font-extrabold">تغییر رمز عبور</p>
                <div className="mt-4 space-y-3">
                  <input required type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="رمز فعلی" className="field" dir="ltr" />
                  <input required type="password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="رمز جدید (حداقل ۸ کاراکتر)" className="field" dir="ltr" />
                </div>
                <button disabled={busy} className="btn btn-primary mt-4 px-7 py-3.5 text-sm">تغییر رمز</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Checkout ─────────────────────────────────────── */
export function CheckoutPage() {
  usePageTitle("تسویه حساب");
  const { items, total, user, settings, notify } = useStore();
  const nav = useNavigate();
  const shipping = Number(settings["orders.shippingFee"]) || 0;
  const [f, setF] = useState({ name: "", email: "", phone: "", province: "تهران", city: "", line: "", postalCode: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  useEffect(() => { if (user) { setF((x) => ({ ...x, name: x.name || user.name, email: x.email || user.email, phone: x.phone || user.phone })); get<{ addresses: Address[] }>("/account/addresses").then((r) => setAddresses(r.addresses)).catch(() => {}); } }, [user]);

  if (items.length === 0) return <div className="container-x pt-40 pb-24"><Empty title="سبد خرید خالی است" cta="رفتن به فروشگاه" to="/shop" /></div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      // Idempotency: generate stable key per checkout attempt
      const idempotencyKey = (typeof crypto !== "undefined" && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2,12) + Date.now().toString(36) + Math.random().toString(36).slice(2,8));
      const r = await post<{ publicId: string; authority: string; provider: string; redirect: string; accessToken?: string }>("/checkout", { items: items.map((i) => ({ id: i.id, qty: i.qty, variant: i.variant })), customer: f, note }, { idempotencyKey });
      // Guest order: persist access token for later order lookup (hash-verified on server)
      if ((r as any).accessToken) {
        try {
          const map = JSON.parse(localStorage.getItem("nirvana-order-tokens") || "{}");
          map[r.publicId] = (r as any).accessToken;
          localStorage.setItem("nirvana-order-tokens", JSON.stringify(map));
        } catch {}
      }
      if (r.redirect.startsWith("http")) window.location.href = r.redirect; else nav(r.redirect);
      // حین انتقال به درگاه، دکمه قفل می‌ماند تا double-submit رخ ندهد (setBusy صدا نمی‌شود)
    } catch (e2) { setBusy(false); setErr((e2 as Error).message); notify((e2 as Error).message); }
  };

  return (
    <div className="min-h-screen pt-32 pb-24">
      <div className="container-x">
        <Reveal><span className="font-latin text-[10px] text-gold">CHECKOUT</span><h1 className="mt-3 text-4xl font-extrabold">تسویه <span className="text-gold">حساب</span></h1></Reveal>
        <form onSubmit={submit} className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-6">
            {!user && <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-[24px] p-5 text-sm"><span>قبلاً حساب ساخته‌ای؟</span><Link to="/login?next=/checkout" className="btn btn-glass glass glass-hover px-5 py-2.5 text-xs">ورود برای پر شدن خودکار اطلاعات</Link></div>}
            {addresses.length > 0 && (
              <div className="glass rounded-[28px] p-6">
                <p className="text-sm font-extrabold">آدرس‌های ذخیره‌شده</p>
                <div className="mt-3 flex flex-wrap gap-2">{addresses.map((a) => <button type="button" key={a.id} onClick={() => setF({ ...f, name: a.fullName, phone: a.phone, province: a.province, city: a.city, line: a.line, postalCode: a.postalCode })} className="glass glass-hover rounded-2xl px-4 py-2.5 text-xs font-bold">{a.city} — {a.line.slice(0, 30)}…</button>)}</div>
              </div>
            )}
            <div className="glass rounded-[28px] p-6 md:p-8">
              <p className="text-lg font-extrabold">اطلاعات گیرنده</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="نام و نام خانوادگی" className="field" />
                <input required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="شماره موبایل" className="field" dir="ltr" />
                <input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="ایمیل" className="field sm:col-span-2" dir="ltr" />
                <select value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })} className="field">{IRAN_PROVINCES.map((p) => <option key={p}>{p}</option>)}</select>
                <input required value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="شهر" className="field" />
                <input required value={f.line} onChange={(e) => setF({ ...f, line: e.target.value })} placeholder="آدرس کامل پستی" className="field sm:col-span-2" />
                <input value={f.postalCode} onChange={(e) => setF({ ...f, postalCode: e.target.value })} placeholder="کد پستی (اختیاری)" className="field" dir="ltr" />
              </div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="یادداشت سفارش (اختیاری)" className="field mt-3 resize-none" />
            </div>
          </div>
          <aside className="glass h-fit rounded-[28px] p-6 lg:sticky lg:top-28">
            <p className="text-lg font-extrabold">خلاصهٔ سفارش</p>
            <ul className="mt-4 space-y-3">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-3">
                  <span className="h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-tint"><img src={img(it.image)} alt="" className="h-full w-full object-cover" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold">{it.name}</span><span className="text-[11px] text-inksoft">{faNumber(it.qty)} × {formatPrice(it.price)}{it.variant ? ` · ${it.variant}` : ""}</span></span>
                  <span className="text-xs font-extrabold">{formatPrice(it.qty * it.price)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-1.5 border-t border-linec pt-4 text-xs text-inksoft">
              <div className="flex justify-between"><span>جمع کالاها</span><span>{formatPrice(total)}</span></div>
              <div className="flex justify-between"><span>هزینه ارسال</span><span>{shipping ? formatPrice(shipping) : "رایگان"}</span></div>
              <div className="flex justify-between pt-2 text-sm font-extrabold text-ink"><span>قابل پرداخت</span><span className="text-forest dark:text-neon">{formatPrice(total + shipping)}</span></div>
            </div>
            {err && <p className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-600">{err}</p>}
            <button disabled={busy} className="btn btn-primary mt-5 w-full py-4 text-sm">{busy ? <Spinner /> : <>{settings["payment.mode"] === "zarinpal" && !isDemoBackend() ? "پرداخت با زرین‌پال" : "پرداخت امن"}<IconArrowLeft className="h-4 w-4" /></>}</button>
            <p className="mt-3 text-center text-[10px] text-inksoft">با ثبت سفارش، شرایط ارسال و مرجوعی نیروانا را می‌پذیری.</p>
          </aside>
        </form>
      </div>
    </div>
  );
}

/* ── Pay (demo gateway + zarinpal callback) ───────── */
export function PayPage() {
  usePageTitle("پرداخت");
  const [sp] = useSearchParams();
  const { clear, notify } = useStore();
  const nav = useNavigate();
  const authority = sp.get("authority") || sp.get("Authority") || "";
  const status = sp.get("Status");
  const [info, setInfo] = useState<{ status: string; amount: number; publicId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const verifying = useRef(false);
  useEffect(() => {
    if (!authority) return;
    if (status) { // zarinpal callback — فقط یک‌بار verify (StrictMode/remount)
      if (verifying.current) return;
      verifying.current = true;
      setBusy(true);
      post<{ publicId: string; status: string; refId: string }>("/pay/verify", { authority, status })
        .then((r) => {
          if (r.status === "verified") clear();
          let token = "";
          try { const map = JSON.parse(localStorage.getItem("nirvana-order-tokens") || "{}"); token = map[r.publicId] ? `&token=${encodeURIComponent(map[r.publicId])}` : ""; } catch {}
          nav(`/orders/${r.publicId}?paid=${r.status === "verified" ? 1 : 0}${token}`, { replace: true });
        })
        .catch((e) => setErr((e as Error).message)).finally(() => setBusy(false));
      return;
    }
    get<{ status: string; amount: number; publicId: string }>(`/pay/status?authority=${authority}`).then(setInfo).catch((e) => setErr((e as Error).message));
  }, [authority, status, nav, clear]);

  const act = async (action: "ok" | "cancel") => {
    setBusy(true);
    try {
      const r = await post<{ publicId: string; status: string }>("/pay/demo", { authority, action });
      if (action === "ok") { clear(); notify("پرداخت با موفقیت انجام شد ✓"); }
      // Preserve guest token if present in localStorage
      let token = "";
      try {
        const map = JSON.parse(localStorage.getItem("nirvana-order-tokens") || "{}");
        token = map[r.publicId] ? `&token=${encodeURIComponent(map[r.publicId])}` : "";
      } catch {}
      nav(`/orders/${r.publicId}?paid=${action === "ok" ? 1 : 0}${token}`, { replace: true });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pt-28 pb-16">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="glass w-full max-w-md rounded-[36px] p-8 text-center">
        <span className="font-latin text-[10px] text-gold">SECURE PAYMENT</span>
        <h1 className="mt-2 text-2xl font-extrabold">درگاه پرداخت {status ? "" : "آزمایشی"}</h1>
        {!authority && !err && <p className="mt-5 rounded-2xl bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600">شناسهٔ تراکنش پیدا نشد. از صفحهٔ تسویه حساب دوباره تلاش کن.</p>}
        {err && <p className="mt-5 rounded-2xl bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600">{err}</p>}
        {authority && !err && !info && <div className="py-10"><Spinner /></div>}
        {info && (
          <>
            <p className="mt-6 text-xs text-inksoft">شماره سفارش</p><p className="font-latin text-sm">{info.publicId}</p>
            <p className="mt-4 text-xs text-inksoft">مبلغ قابل پرداخت</p><p className="text-2xl font-extrabold text-forest dark:text-neon">{formatPrice(info.amount)}</p>
            {info.status !== "pending" ? <p className="mt-6 text-sm">این تراکنش قبلاً {STATUS_FA[info.status] ?? info.status}. <Link to={`/orders/${info.publicId}`} className="font-bold underline">مشاهده سفارش</Link></p> : (
              <div className="mt-8 flex gap-2">
                <button disabled={busy} onClick={() => act("ok")} className="btn btn-primary flex-1 py-4 text-sm"><IconCheck className="h-4 w-4" />پرداخت موفق</button>
                <button disabled={busy} onClick={() => act("cancel")} className="btn btn-glass glass px-5 py-4 text-sm"><IconClose className="h-4 w-4" />انصراف</button>
              </div>
            )}
            <p className="mt-5 text-[10px] leading-5 text-inksoft">این صفحه شبیه‌ساز درگاه است. با تنظیم PAYMENT_MODE=zarinpal در سرور، مشتری مستقیماً به زرین‌پال هدایت می‌شود.</p>
          </>
        )}
      </motion.div>
    </div>
  );
}

/* ── Order detail ─────────────────────────────────── */
export function OrderPage() {
  const { publicId } = useParams();
  const [sp] = useSearchParams();
  usePageTitle(`سفارش ${publicId}`);
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    // Retrieve guest token from localStorage or URL query ?token=
    let token: string | undefined;
    try {
      const map = JSON.parse(localStorage.getItem("nirvana-order-tokens") || "{}");
      token = map[publicId!] || sp.get("token") || undefined;
    } catch { token = sp.get("token") || undefined; }
    const p = token ? getWithToken<{ order: Order }>(`/orders/${publicId}`, token) : get<{ order: Order }>(`/orders/${publicId}`);
    p.then((r) => setO(r.order)).catch((e) => setErr((e as Error).message));
  }, [publicId, sp]);
  if (err) return <div className="container-x pt-40 pb-24"><Empty title={err} cta="بازگشت" to="/" /></div>;
  if (!o) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  const paid = sp.get("paid");
  return (
    <div className="min-h-screen pt-32 pb-24">
      <div className="container-x max-w-3xl">
        {paid && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className={`mb-8 flex items-center gap-4 rounded-[28px] p-6 ${paid === "1" ? "bg-neon/15" : "bg-rose-500/10"}`}>
            <span className={`grid h-12 w-12 place-items-center rounded-full ${paid === "1" ? "bg-neon text-pine" : "bg-rose-500 text-white"}`}>{paid === "1" ? <IconCheck className="h-6 w-6" /> : <IconClose className="h-6 w-6" />}</span>
            <div><p className="text-base font-extrabold">{paid === "1" ? "پرداخت موفق بود؛ ممنون که نیروانا را انتخاب کردی" : "پرداخت انجام نشد"}</p><p className="mt-1 text-xs text-inksoft">{paid === "1" ? "سفارش در صف آماده‌سازی قرار گرفت." : "سفارش لغو شد؛ می‌توانی دوباره تلاش کنی."}</p></div>
          </motion.div>
        )}
        <Reveal>
          <span className="font-latin text-[10px] text-gold">ORDER</span>
          <h1 className="mt-2 text-3xl font-extrabold">سفارش <span className="font-latin text-2xl text-gold">{o.publicId}</span></h1>
          <p className="mt-2 text-xs text-inksoft">{faDate(o.createdAt)}</p>
          <div className="mt-4 flex flex-wrap gap-2"><StatusBadge s={o.status} /><StatusBadge s={o.paymentStatus} />{o.refId && <span className="rounded-full border border-linec px-2.5 py-1 font-latin text-[10px]">REF {o.refId}</span>}</div>
        </Reveal>
        <div className="mt-8 grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <div className="glass rounded-[28px] p-6">
            <p className="text-sm font-extrabold">اقلام سفارش</p>
            <ul className="mt-4 space-y-3">{o.items.map((it, i) => <li key={i} className="flex items-center gap-3"><span className="h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-tint"><img src={img(it.image)} alt="" className="h-full w-full object-cover" /></span><span className="min-w-0 flex-1"><Link to={`/product/${it.slug}`} className="block truncate text-xs font-extrabold">{it.name}</Link><span className="text-[11px] text-inksoft">{faNumber(it.qty)} × {formatPrice(it.unitPrice)}{it.variant ? ` · ${it.variant}` : ""}</span></span><span className="text-xs font-extrabold">{formatPrice(it.qty * it.unitPrice)}</span></li>)}</ul>
            <div className="mt-5 space-y-1.5 border-t border-linec pt-4 text-xs text-inksoft">
              <div className="flex justify-between"><span>جمع کالاها</span><span>{formatPrice(o.subtotal)}</span></div>
              <div className="flex justify-between"><span>ارسال</span><span>{o.shipping ? formatPrice(o.shipping) : "رایگان"}</span></div>
              <div className="flex justify-between pt-2 text-sm font-extrabold text-ink"><span>مجموع</span><span className="text-forest dark:text-neon">{formatPrice(o.total)}</span></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="glass rounded-[28px] p-6 text-xs leading-6 text-inksoft"><p className="text-sm font-extrabold text-ink">گیرنده</p><p className="mt-2">{o.customerName} · <span dir="ltr">{o.customerPhone}</span></p><p>{o.province}، {o.city}، {o.addressLine}</p>{o.postalCode && <p>کدپستی {o.postalCode}</p>}{o.note && <p className="mt-2 border-t border-linec pt-2">یادداشت: {o.note}</p>}</div>
            {o.events && o.events.length > 0 && <div className="glass rounded-[28px] p-6"><p className="text-sm font-extrabold">تاریخچه</p><ul className="mt-3 space-y-2 text-[11px] text-inksoft">{o.events.map((e, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /><span>{e.type === "note" ? "یادداشت مدیر" : e.type === "payment_verified" ? "پرداخت تأیید شد" : e.type === "created" ? "سفارش ثبت شد" : `${STATUS_FA[e.from ?? ""] ?? e.from ?? ""} ← ${STATUS_FA[e.to ?? ""] ?? e.to}`}<span className="block opacity-60">{faDate(e.createdAt)}</span></span></li>)}</ul></div>}
          </div>
        </div>
        <Link to="/shop" className="btn btn-glass glass glass-hover mt-8 px-6 py-3.5 text-xs">ادامه خرید<IconArrowLeft className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
