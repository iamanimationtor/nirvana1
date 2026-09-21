import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, del, get, post, put, isDemoBackend } from "../lib/api";
import { DEMO_ADMIN } from "../lib/demo-backend";
import { ORDER_STATUSES, ORDER_TRANSITIONS, SHIPPING_STATUSES, SHIPPING_TRANSITIONS, STATUS_FA, faDate, faNumber, formatPrice, img, type Category, type Order, type Product, type StoreSettings, type User } from "../lib/core";
import { IconActivity, IconBell, IconBox, IconChart, IconGrid, IconKey, IconList, IconLogout, IconMenu, IconPlus, IconSettings, IconStar, IconTag, IconTrash, IconUpload, IconUsers, IconClose } from "../components/Icons";
import { ASelect } from "../components/ASelect";
import { Spinner } from "../components/ui";

/* ── context ─────────────────────────────────────── */
interface AdminCtx { admin: User | null; setAdmin: (u: User | null) => void; toast: (m: string, bad?: boolean) => void; can: (perm: string) => boolean }
const Ctx = createContext<AdminCtx>(null!);
const useAdmin = () => useContext(Ctx);

const PERMISSIONS = [
  ["products.manage", "مدیریت محصولات"], ["categories.manage", "مدیریت دسته‌ها"], ["orders.manage", "مدیریت سفارش‌ها"], ["inventory.manage", "مدیریت موجودی"],
  ["customers.view", "مشاهده مشتریان"], ["reports.view", "گزارش‌ها و تحلیل"], ["settings.manage", "تنظیمات فروشگاه"], ["users.manage", "کاربران و نقش‌ها"],
] as const;
const ROLE_FA: Record<string, string> = { admin: "مدیر کل", manager: "مدیر", staff: "کارمند", customer: "مشتری" };

const NAV = [
  { to: "/admin", label: "داشبورد", icon: IconGrid, end: true },
  { to: "/admin/orders", label: "سفارش‌ها", icon: IconList, perm: "orders.manage" },
  { to: "/admin/products", label: "محصولات", icon: IconBox, perm: "products.manage" },
  { to: "/admin/categories", label: "دسته‌بندی‌ها", icon: IconTag, perm: "categories.manage" },
  { to: "/admin/inventory", label: "موجودی انبار", icon: IconActivity, perm: "inventory.manage" },
  { to: "/admin/customers", label: "مشتریان", icon: IconUsers, perm: "customers.view" },
  { to: "/admin/reports", label: "گزارش فروش", icon: IconChart, perm: "reports.view" },
  { to: "/admin/analytics", label: "تحلیل", icon: IconChart, perm: "reports.view" },
  { to: "/admin/best-sellers", label: "پرفروش‌ها", icon: IconStar, perm: "reports.view" },
  { to: "/admin/notifications", label: "اعلان‌ها", icon: IconBell },
  { to: "/admin/messages", label: "پیام‌های تماس", icon: IconList },
  { to: "/admin/activity", label: "فعالیت‌ها", icon: IconActivity, perm: "users.manage" },
  { to: "/admin/users", label: "کاربران و نقش‌ها", icon: IconKey, perm: "users.manage" },
  { to: "/admin/settings", label: "تنظیمات", icon: IconSettings, perm: "settings.manage" },
];

/* ── small ui ────────────────────────────────────── */
const Badge = ({ s }: { s: string }) => {
  const c = ["paid", "delivered", "confirmed", "active", "verified"].includes(s) ? "bg-[#a3f55a1a] text-[#a3f55a]" : ["cancelled", "failed", "returned", "out_of_stock"].includes(s) ? "bg-rose-500/15 text-rose-300" : ["draft", "unpaid"].includes(s) ? "bg-white/5 text-[#9aa38f]" : "bg-[#c2a15b22] text-[#d9c28b]";
  return <span className={`a-badge ${c}`}>{STATUS_FA[s] ?? s}</span>;
};
const Card = ({ title, children, action, className = "" }: { title?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) => (
  <section className={`a-card p-5 ${className}`}>{(title || action) && <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-extrabold">{title}</h2>{action}</div>}{children}</section>
);
const Stat = ({ l, v, sub }: { l: string; v: string; sub?: string }) => (<div className="a-card p-5"><p className="text-[11px] font-bold text-[#9aa38f]">{l}</p><p className="mt-2 text-2xl font-extrabold">{v}</p>{sub && <p className="mt-1 text-[11px] text-[#9aa38f]">{sub}</p>}</div>);
const PageHead = ({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) => (<div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-xl font-extrabold">{title}</h1>{sub && <p className="mt-1 text-xs text-[#9aa38f]">{sub}</p>}</div>{action}</div>);
function useLoad<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null); const [err, setErr] = useState("");
  const reload = useCallback(() => get<T>(path).then(setData).catch((e) => setErr((e as Error).message)), [path]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload, ...deps]);
  return { data, err, reload, setData };
}
function LoadState({ err, reload }: { err?: string; reload?: () => void }) {
  if (!err) return <div className="flex justify-center py-16"><Spinner /></div>;
  return <div className="a-card mx-auto max-w-md p-8 text-center"><p className="text-sm font-bold text-rose-300">{err}</p>{reload && <button type="button" onClick={reload} className="a-btn a-btn-ghost mt-4">تلاش دوباره</button>}</div>;
}
const Loading = LoadState;

/* ── login ───────────────────────────────────────── */
function AdminLogin() {
  const { admin, setAdmin } = useAdmin(); const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" }); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (admin) nav("/admin", { replace: true }); }, [admin, nav]);
  return (
    <div className="admin flex min-h-screen items-center justify-center p-4">
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(""); try { const r = await post<{ user: User }>("/admin/login", f); setAdmin(r.user); } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); } }} className="a-card w-full max-w-sm p-8">
        <span className="font-latin text-[10px] text-[#d9c28b]">NIRVANA ADMIN</span>
        <h1 className="mt-2 text-xl font-extrabold">ورود به پنل مدیریت</h1>
        {isDemoBackend() && <p className="mt-4 rounded-xl bg-[#c2a15b1a] p-3 text-[11px] leading-5 text-[#d9c28b]">حالت نمایشی — ایمیل: <span dir="ltr">{DEMO_ADMIN.email}</span> / رمز: <span dir="ltr">{DEMO_ADMIN.password}</span></p>}
        <div className="mt-6 space-y-3">
          <input className="a-input" dir="ltr" type="email" required placeholder="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input className="a-input" dir="ltr" type="password" required placeholder="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        {err && <p className="mt-3 text-xs font-bold text-rose-300">{err}</p>}
        <button disabled={busy} className="a-btn a-btn-primary mt-5 w-full justify-center py-3">{busy ? <Spinner className="h-4 w-4" /> : "ورود"}</button>
        <div className="mt-4 flex justify-between text-[11px] text-[#9aa38f]"><Link to="/admin/forgot-password" className="hover:text-white">فراموشی رمز</Link><Link to="/" className="hover:text-white">بازگشت به فروشگاه</Link></div>
      </form>
    </div>
  );
}
function AdminForgot() {
  const [email, setEmail] = useState(""); const [msg, setMsg] = useState("");
  return (
    <div className="admin flex min-h-screen items-center justify-center p-4">
      <form onSubmit={async (e) => { e.preventDefault(); const r = await post<{ message: string }>("/admin/forgot", { email }); setMsg(r.message); }} className="a-card w-full max-w-sm p-8">
        <h1 className="text-xl font-extrabold">بازیابی رمز مدیر</h1>
        <input className="a-input mt-5" dir="ltr" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        {msg && <p className="mt-3 text-xs text-[#a3f55a]">{msg}</p>}
        <button className="a-btn a-btn-primary mt-4 w-full justify-center py-3">ارسال</button>
        <Link to="/admin/login" className="mt-4 block text-center text-[11px] text-[#9aa38f]">بازگشت</Link>
      </form>
    </div>
  );
}
function AdminReset() {
  const [sp] = useSearchParams(); const nav = useNavigate();
  const token = sp.get("token") ?? "";
  const [password, setPassword] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <div className="admin flex min-h-screen items-center justify-center p-4">
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(""); try { await post("/auth/reset", { token, password }); nav("/admin/login", { replace: true }); } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); } }} className="a-card w-full max-w-sm p-8">
        <h1 className="text-xl font-extrabold">تعیین رمز جدید مدیر</h1>
        {!token ? <p className="mt-4 text-xs text-rose-300">لینک نامعتبر است؛ از صفحهٔ فراموشی رمز دوباره درخواست کنید.</p> : (
          <>
            <input className="a-input mt-5" dir="ltr" type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز جدید (حداقل ۱۲ کاراکتر)" />
            {err && <p className="mt-3 text-xs font-bold text-rose-300">{err}</p>}
            <button disabled={busy} className="a-btn a-btn-primary mt-4 w-full justify-center py-3">{busy ? <Spinner className="h-4 w-4" /> : "ثبت رمز"}</button>
          </>
        )}
        <Link to="/admin/login" className="mt-4 block text-center text-[11px] text-[#9aa38f]">بازگشت به ورود</Link>
      </form>
    </div>
  );
}

/* ── shell ───────────────────────────────────────── */
function Shell({ children }: { children: ReactNode }) {
  const { admin, setAdmin, can } = useAdmin(); const nav = useNavigate(); const [open, setOpen] = useState(false);
  const { data } = useLoad<{ notifications: { readAt: string | null }[] }>("/admin/notifications");
  const unread = data?.notifications.filter((n) => !n.readAt).length ?? 0;
  if (!admin) return <Navigate to="/admin/login" replace />;
  const Side = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-2 py-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#a3f55a] text-[#10150f] font-extrabold">N</span><div><p className="text-sm font-extrabold">نیروانا ۳دی</p><p className="font-latin text-[8px] text-[#9aa38f]">ADMIN PANEL</p></div></div>
      <nav className="a-nav mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {NAV.filter((n) => !n.perm || can(n.perm)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}><n.icon className="h-4 w-4" />{n.label}{n.to === "/admin/notifications" && unread > 0 && <span className="a-badge ms-auto bg-[#a3f55a] text-[#10150f]">{faNumber(unread)}</span>}</NavLink>
        ))}
      </nav>
      <div className="mt-4 border-t border-[rgba(237,233,218,0.1)] pt-3">
        <p className="px-2 text-xs font-extrabold">{admin.name}</p><p className="px-2 text-[10px] text-[#9aa38f]">{ROLE_FA[admin.role]}</p>
        <div className="mt-2 flex gap-1"><Link to="/admin/change-password" className="a-btn a-btn-ghost flex-1 justify-center !py-2 text-[11px]"><IconKey className="h-3.5 w-3.5" />رمز</Link><button onClick={async () => { await post("/admin/logout"); setAdmin(null); nav("/admin/login"); }} className="a-btn a-btn-ghost flex-1 justify-center !py-2 text-[11px]"><IconLogout className="h-3.5 w-3.5" />خروج</button></div>
        <Link to="/" className="mt-2 block text-center text-[10px] text-[#9aa38f] hover:text-white">مشاهدهٔ فروشگاه ↗</Link>
      </div>
    </div>
  );
  return (
    <div className="admin">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-e border-[rgba(237,233,218,0.1)] p-4 lg:block"><div className="sticky top-4 h-[calc(100vh-2rem)]">{Side}</div></aside>
        {open && <><div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} /><aside className="fixed inset-y-0 end-0 z-50 w-72 bg-[#0f1411] p-4 lg:hidden">{Side}</aside></>}
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <div className="mb-4 flex items-center justify-between lg:hidden"><button onClick={() => setOpen(true)} className="a-btn a-btn-ghost"><IconMenu className="h-4 w-4" />منو</button><span className="text-xs font-extrabold">پنل مدیریت</span></div>
          {children}
        </main>
      </div>
    </div>
  );
}

/* ── dashboard ───────────────────────────────────── */
function Dashboard() {
  const { data } = useLoad<{ stats: Record<string, number>; recentOrders: Order[]; lowStock: Product[] }>("/admin/dashboard");
  if (!data) return <Loading />;
  const s = data.stats;
  return (
    <>
      <PageHead title="داشبورد" sub="نمای کلی فروشگاه" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat l="درآمد کل (پرداخت‌شده)" v={formatPrice(s.revenue)} /><Stat l="سفارش‌های امروز" v={faNumber(s.ordersToday)} sub={`${faNumber(s.orders)} سفارش در کل`} /><Stat l="در انتظار آماده‌سازی" v={faNumber(s.pendingOrders)} /><Stat l="مشتریان" v={faNumber(s.customers)} />
        <Stat l="محصولات" v={faNumber(s.products)} /><Stat l="هشدار موجودی" v={faNumber(s.lowStock)} sub="زیر حد آستانه" /><Stat l="اعلان‌های خوانده‌نشده" v={faNumber(s.unread)} />
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card title="آخرین سفارش‌ها" action={<Link to="/admin/orders" className="text-[11px] text-[#a3f55a]">همه</Link>}>
          {data.recentOrders.length === 0 ? <p className="py-8 text-center text-xs text-[#9aa38f]">هنوز سفارشی ثبت نشده.</p> : <div className="overflow-x-auto"><table className="a-table"><thead><tr><th>شماره</th><th>مشتری</th><th>مبلغ</th><th>وضعیت</th><th>پرداخت</th></tr></thead><tbody>{data.recentOrders.map((o) => <tr key={o.id}><td><Link to={`/admin/orders/${o.publicId}`} className="font-latin text-[#d9c28b]">{o.publicId}</Link></td><td>{o.customerName}</td><td>{formatPrice(o.total)}</td><td><Badge s={o.status} /></td><td><Badge s={o.paymentStatus} /></td></tr>)}</tbody></table></div>}
        </Card>
        <Card title="موجودی کم" action={<Link to="/admin/inventory" className="text-[11px] text-[#a3f55a]">انبار</Link>}>
          {data.lowStock.length === 0 ? <p className="py-8 text-center text-xs text-[#9aa38f]">همه‌چیز موجود است.</p> : <ul className="space-y-2">{data.lowStock.map((p) => <li key={p.id} className="flex items-center gap-3 text-xs"><span className="h-10 w-9 overflow-hidden rounded-lg"><img src={img(p.images[0])} alt="" className="h-full w-full object-cover" /></span><Link to={`/admin/products/${p.id}`} className="flex-1 truncate font-bold">{p.name}</Link><span className={`font-extrabold ${p.stock === 0 ? "text-rose-300" : "text-[#d9c28b]"}`}>{faNumber(p.stock)} عدد</span></li>)}</ul>}
        </Card>
      </div>
    </>
  );
}

/* ── products ────────────────────────────────────── */
function ProductsList() {
  const { data, reload } = useLoad<{ products: Product[]; categories: Category[] }>("/admin/products"); const { toast } = useAdmin(); const [q, setQ] = useState("");
  if (!data) return <Loading />;
  const list = data.products.filter((p) => !q || p.name.includes(q) || p.nameEn.toLowerCase().includes(q.toLowerCase()) || p.sku?.includes(q));
  return (
    <>
      <PageHead title="محصولات" sub={`${faNumber(data.products.length)} محصول`} action={<Link to="/admin/products/new" className="a-btn a-btn-primary"><IconPlus className="h-4 w-4" />محصول جدید</Link>} />
      <input className="a-input mb-4 max-w-xs" placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="a-card overflow-x-auto"><table className="a-table"><thead><tr><th>محصول</th><th>دسته</th><th>قیمت</th><th>موجودی</th><th>وضعیت</th><th>ویژه</th><th></th></tr></thead><tbody>
        {list.map((p) => <tr key={p.id}><td><div className="flex items-center gap-3"><span className="h-11 w-9 shrink-0 overflow-hidden rounded-lg bg-white/5"><img src={img(p.images[0])} alt="" className="h-full w-full object-cover" /></span><div><Link to={`/admin/products/${p.id}`} className="font-bold hover:text-[#a3f55a]">{p.name}</Link><p className="font-latin text-[9px] text-[#9aa38f]">{p.sku || p.nameEn}</p></div></div></td><td>{p.categoryName}</td><td>{formatPrice(p.price)}{p.oldPrice && <span className="block text-[10px] text-[#9aa38f] line-through">{formatPrice(p.oldPrice)}</span>}</td><td className={p.stock <= (p.minStock ?? 5) ? "font-extrabold text-rose-300" : ""}>{faNumber(p.stock)}</td><td><Badge s={p.status ?? "active"} /></td><td>{p.featured ? "★" : "—"}</td><td><div className="flex gap-1"><Link to={`/admin/products/${p.id}`} className="a-btn a-btn-ghost !py-1.5 text-[11px]">ویرایش</Link><button onClick={async () => { if (confirm(`حذف «${p.name}»؟`)) { try { await del(`/admin/products/${p.id}`); toast("محصول حذف شد"); reload(); } catch (e) { toast((e as Error).message, true); } } }} className="a-btn a-btn-danger !py-1.5 text-[11px]"><IconTrash className="h-3.5 w-3.5" /></button></div></td></tr>)}
      </tbody></table></div>
    </>
  );
}

const EMPTY_P = { slug: "", name: "", nameEn: "", price: 0, oldPrice: null as number | null, categoryId: 0, shortDesc: "", description: "", features: [] as string[], variants: [] as string[], images: [] as string[], stock: 0, minStock: 5, prepTime: "", material: "PLA", featured: false, status: "active" as "active" | "draft", sku: "" };
/* توجه: L باید بیرون از ProductForm تعریف شود؛ وگرنه در هر render از نو ساخته می‌شود و input ها focus را از دست می‌دهند. */
const L = ({ l, children }: { l: string; children: ReactNode }) => <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-[#9aa38f]">{l}</span>{children}</label>;
function ProductForm() {
  const { id } = useParams(); const isNew = id === "new"; const nav = useNavigate(); const { toast } = useAdmin();
  const [f, setF] = useState(EMPTY_P); const [cats, setCats] = useState<Category[]>([]); const [busy, setBusy] = useState(false); const [ready, setReady] = useState(isNew);
  const [featText, setFeatText] = useState(""); const [varText, setVarText] = useState(""); const [imgUrl, setImgUrl] = useState("");
  useEffect(() => {
    if (isNew) { get<{ categories: Category[] }>("/admin/categories").then((r) => { setCats(r.categories); setF((x) => ({ ...x, categoryId: r.categories[0]?.id ?? 0 })); }); return; }
    get<{ product: Product; categories: Category[] }>(`/admin/products/${id}`).then((r) => { const p = r.product; setCats(r.categories); setF({ ...EMPTY_P, ...p, status: p.status ?? "active", minStock: p.minStock ?? 5, sku: p.sku ?? "" }); setFeatText(p.features.join("\n")); setVarText(p.variants.join("\n")); setReady(true); }).catch((e) => toast((e as Error).message, true));
  }, [id, isNew, toast]);
  const upload = async (file: File) => { const fd = new FormData(); fd.append("file", file); try { const r = await api<{ url: string }>("POST", "/admin/upload", undefined, { form: fd }); setF((x) => ({ ...x, images: [...x.images, r.url] })); } catch (e) { toast((e as Error).message, true); } };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    if (!f.images.length) { toast("حداقل یک تصویر لازم است", true); setBusy(false); return; }
    if (Number(f.price) <= 0) { toast("قیمت باید بیشتر از صفر باشد", true); setBusy(false); return; }
    const body = { ...f, features: featText.split("\n").map((s) => s.trim()).filter(Boolean), variants: varText.split("\n").map((s) => s.trim()).filter(Boolean) };
    try { await (isNew ? post("/admin/products", body) : put(`/admin/products/${id}`, body)); toast("ذخیره شد ✓"); nav("/admin/products"); } catch (e2) { toast((e2 as Error).message, true); } finally { setBusy(false); }
  };
  if (!ready) return <Loading />;
  return (
    <form onSubmit={save}>
      <PageHead title={isNew ? "محصول جدید" : `ویرایش: ${f.name}`} action={<div className="flex gap-2"><Link to="/admin/products" className="a-btn a-btn-ghost">انصراف</Link><button disabled={busy} className="a-btn a-btn-primary">{busy ? <Spinner className="h-4 w-4" /> : "ذخیره"}</button></div>} />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Card title="اطلاعات اصلی"><div className="grid gap-3 sm:grid-cols-2">
            <L l="نام فارسی"><input className="a-input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></L>
            <L l="نام انگلیسی"><input className="a-input" dir="ltr" value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></L>
            <L l="اسلاگ (آدرس)"><div className="flex gap-2"><input className="a-input" dir="ltr" required value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="wave-vase" /><button type="button" className="a-btn a-btn-ghost shrink-0 !px-3 text-[11px]" onClick={() => setF({ ...f, slug: (f.nameEn || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })}>از نام انگلیسی</button></div></L>
            <L l="SKU"><input className="a-input" dir="ltr" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></L>
            <L l="دسته‌بندی"><ASelect value={String(f.categoryId)} onChange={(v) => setF({ ...f, categoryId: Number(v) })} options={cats.map((c) => ({ value: String(c.id), label: c.name }))} placeholder="انتخاب دسته…" /></L>
            <L l="متریال"><input className="a-input" dir="ltr" value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })} /></L>
            <L l="توضیح کوتاه"><textarea className="a-input sm:col-span-2" rows={2} value={f.shortDesc} onChange={(e) => setF({ ...f, shortDesc: e.target.value })} /></L>
            <div className="sm:col-span-2"><L l="توضیحات کامل"><textarea className="a-input" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></L></div>
            <L l="ویژگی‌ها (هر خط یک مورد)"><textarea className="a-input" rows={4} value={featText} onChange={(e) => setFeatText(e.target.value)} /></L>
            <L l="رنگ‌ها / نسخه‌ها (هر خط یک مورد)"><textarea className="a-input" rows={4} value={varText} onChange={(e) => setVarText(e.target.value)} /></L>
          </div></Card>
          <Card title="تصاویر">
            <div className="flex flex-wrap gap-3">{f.images.map((s, i) => <div key={i} className="relative h-28 w-24 overflow-hidden rounded-xl bg-white/5"><img src={img(s)} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => setF({ ...f, images: f.images.filter((_, j) => j !== i) })} className="absolute end-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"><IconClose className="h-3 w-3" /></button>{i === 0 && <span className="absolute bottom-1 start-1 a-badge bg-[#a3f55a] text-[#10150f]">اصلی</span>}</div>)}
              <label className="grid h-28 w-24 cursor-pointer place-items-center rounded-xl border border-dashed border-[rgba(237,233,218,0.2)] text-[#9aa38f] hover:border-[#a3f55a]"><IconUpload className="h-5 w-5" /><input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label></div>
            <div className="mt-3 flex gap-2"><input className="a-input" dir="ltr" placeholder="/images/xxx.jpg یا URL" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} /><button type="button" onClick={() => { if (imgUrl) { setF({ ...f, images: [...f.images, imgUrl] }); setImgUrl(""); } }} className="a-btn a-btn-ghost">افزودن</button></div>
          </Card>
        </div>
        <div className="space-y-4 lg:sticky lg:top-4 lg:z-20 lg:self-start">
          <Card title="قیمت و موجودی"><div className="space-y-3">
            <L l="قیمت (تومان)"><input className="a-input" dir="ltr" type="number" min={0} required value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></L>
            <L l="قیمت قبل از تخفیف (اختیاری)"><input className="a-input" dir="ltr" type="number" min={0} value={f.oldPrice ?? ""} onChange={(e) => setF({ ...f, oldPrice: e.target.value ? Number(e.target.value) : null })} /></L>
            <L l="موجودی"><input className="a-input" dir="ltr" type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} /></L>
            <L l="حد هشدار موجودی"><input className="a-input" dir="ltr" type="number" min={0} value={f.minStock} onChange={(e) => setF({ ...f, minStock: Number(e.target.value) })} /></L>
            <L l="زمان آماده‌سازی"><input className="a-input" value={f.prepTime} onChange={(e) => setF({ ...f, prepTime: e.target.value })} /></L>
          </div></Card>
          <Card title="انتشار" className="relative z-10">
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-[#9aa38f]">وضعیت نمایش در فروشگاه</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setF({ ...f, status: "active" })} className={`a-btn justify-center ${f.status === "active" ? "a-btn-primary" : "a-btn-ghost"}`}>فعال</button>
                <button type="button" onClick={() => setF({ ...f, status: "draft" })} className={`a-btn justify-center ${f.status === "draft" ? "a-btn-primary" : "a-btn-ghost"}`}>پیش‌نویس</button>
              </div>
              <p className="text-[11px] leading-5 text-[#9aa38f]">{f.status === "active" ? "محصول در فروشگاه دیده می‌شود." : "فقط در پنل دیده می‌شود و در فروشگاه نیست."}</p>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[rgba(237,233,218,0.12)] px-3 py-3 text-xs font-bold">
                <span>آثار منتخب صفحهٔ اصلی</span>
                <input type="checkbox" checked={f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} className="h-4 w-4 accent-[#a3f55a]" />
              </label>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}

/* ── categories ──────────────────────────────────── */
function Categories() {
  const { data, reload } = useLoad<{ categories: (Category & { count: number })[] }>("/admin/categories"); const { toast } = useAdmin();
  const [f, setF] = useState({ name: "", slug: "", icon: "spark", blurb: "" });
  if (!data) return <Loading />;
  return (
    <>
      <PageHead title="دسته‌بندی‌ها" />
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="a-card overflow-x-auto"><table className="a-table"><thead><tr><th>نام</th><th>اسلاگ</th><th>آیکون</th><th>محصول</th><th></th></tr></thead><tbody>{data.categories.map((c) => <tr key={c.id}><td><input className="a-input !py-1" defaultValue={c.name} onBlur={async (e) => { if (e.target.value !== c.name) { await put(`/admin/categories/${c.id}`, { name: e.target.value }); toast("ذخیره شد"); reload(); } }} /></td><td className="font-latin text-[10px]">{c.slug}</td><td><ASelect className="w-28 [&>button]:!py-1" value={c.icon} onChange={async (v) => { await put(`/admin/categories/${c.id}`, { icon: v }); reload(); }} options={["figure", "vase", "lamp", "stand", "gamepad", "spark", "leaf", "box"].map((i) => ({ value: i, label: i }))} /></td><td>{faNumber(c.count)}</td><td><button onClick={async () => { if (confirm("حذف دسته؟")) { try { await del(`/admin/categories/${c.id}`); reload(); } catch (e) { toast((e as Error).message, true); } } }} className="a-btn a-btn-danger !py-1.5"><IconTrash className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table></div>
        <Card title="دستهٔ جدید"><form onSubmit={async (e) => { e.preventDefault(); try { await post("/admin/categories", f); setF({ name: "", slug: "", icon: "spark", blurb: "" }); toast("ایجاد شد ✓"); reload(); } catch (e2) { toast((e2 as Error).message, true); } }} className="space-y-3">
          <input className="a-input" required placeholder="نام" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><input className="a-input" dir="ltr" required placeholder="slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /><input className="a-input" placeholder="توضیح کوتاه" value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} />
          <ASelect value={f.icon} onChange={(v) => setF({ ...f, icon: v })} options={["figure", "vase", "lamp", "stand", "gamepad", "spark", "leaf", "box"].map((i) => ({ value: i, label: i }))} />
          <button className="a-btn a-btn-primary w-full justify-center">ایجاد</button></form></Card>
      </div>
    </>
  );
}

/* ── orders ──────────────────────────────────────── */
function Orders() {
  const [sp, setSp] = useSearchParams(); const status = sp.get("status") ?? ""; const [q, setQ] = useState(sp.get("q") ?? "");
  const { data } = useLoad<{ orders: Order[] }>(`/admin/orders?status=${status}&q=${encodeURIComponent(sp.get("q") ?? "")}`);
  return (
    <>
      <PageHead title="سفارش‌ها" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setSp({ status, q }); }} className="flex gap-2"><input className="a-input w-56" placeholder="شماره سفارش، نام، تلفن" value={q} onChange={(e) => setQ(e.target.value)} /><button className="a-btn a-btn-ghost">جستجو</button></form>
        <div className="flex flex-wrap gap-1">{["", ...ORDER_STATUSES].map((s) => <button key={s} onClick={() => setSp({ status: s, q })} className={`a-badge cursor-pointer ${status === s ? "bg-[#a3f55a] text-[#10150f]" : "bg-white/5 text-[#9aa38f]"}`}>{s ? STATUS_FA[s] : "همه"}</button>)}</div>
      </div>
      {!data ? <Loading /> : <div className="a-card overflow-x-auto"><table className="a-table"><thead><tr><th>شماره</th><th>تاریخ</th><th>مشتری</th><th>اقلام</th><th>مبلغ</th><th>وضعیت</th><th>پرداخت</th><th>ارسال</th></tr></thead><tbody>{data.orders.length === 0 ? <tr><td colSpan={8} className="py-10 text-center text-[#9aa38f]">سفارشی نیست.</td></tr> : data.orders.map((o) => <tr key={o.id}><td><Link to={`/admin/orders/${o.publicId}`} className="font-latin text-[#d9c28b] hover:underline">{o.publicId}</Link></td><td className="text-[11px]">{faDate(o.createdAt)}</td><td>{o.customerName}<span className="block text-[10px] text-[#9aa38f]" dir="ltr">{o.customerPhone}</span></td><td>{faNumber(o.items.reduce((s, i) => s + i.qty, 0))}</td><td>{formatPrice(o.total)}</td><td><Badge s={o.status} /></td><td><Badge s={o.paymentStatus} /></td><td><Badge s={o.shippingStatus} /></td></tr>)}</tbody></table></div>}
    </>
  );
}
function OrderEditor() {
  const { publicId } = useParams(); const { toast } = useAdmin();
  const { data, err, reload, setData } = useLoad<{ order: Order }>(`/admin/orders/${publicId}`);
  const [f, setF] = useState<{ status: string; shippingStatus: string; internalNote: string; refund?: boolean } | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF({ status: data.order.status, shippingStatus: data.order.shippingStatus, internalNote: data.order.internalNote }); }, [data]);
  if (err && !data) return <LoadState err={err} reload={reload} />;
  if (!data || !f) return <Loading />;
  const o = data.order;
  const save = async () => { setBusy(true); try { const r = await put<{ order: Order }>(`/admin/orders/${publicId}`, f); setData({ order: r.order }); toast("سفارش به‌روز شد ✓"); } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); } };
  const allowed = (cur: string, map: Record<string, readonly string[]>, all: readonly string[]) => all.filter((s) => s === cur || map[cur]?.includes(s));
  return (
    <>
      <PageHead title={`سفارش ${o.publicId}`} sub={faDate(o.createdAt)} action={<Link to="/admin/orders" className="a-btn a-btn-ghost">بازگشت</Link>} />
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card title="اقلام"><table className="a-table"><thead><tr><th>محصول</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr></thead><tbody>{o.items.map((it, i) => <tr key={i}><td><div className="flex items-center gap-2"><span className="h-10 w-8 overflow-hidden rounded-md"><img src={img(it.image)} alt="" className="h-full w-full object-cover" /></span><span>{it.name}{it.variant && <span className="block text-[10px] text-[#9aa38f]">{it.variant}</span>}</span></div></td><td>{faNumber(it.qty)}</td><td>{formatPrice(it.unitPrice)}</td><td>{formatPrice(it.qty * it.unitPrice)}</td></tr>)}</tbody></table>
            <div className="mt-3 flex justify-end gap-6 text-xs"><span>ارسال: {formatPrice(o.shipping)}</span><span className="font-extrabold text-[#a3f55a]">مجموع: {formatPrice(o.total)}</span></div></Card>
          <Card title="گیرنده"><div className="grid gap-2 text-xs sm:grid-cols-2"><p><span className="text-[#9aa38f]">نام:</span> {o.customerName}</p><p><span className="text-[#9aa38f]">تلفن:</span> <span dir="ltr">{o.customerPhone}</span></p><p><span className="text-[#9aa38f]">ایمیل:</span> <span dir="ltr">{o.customerEmail}</span></p><p><span className="text-[#9aa38f]">کدپستی:</span> {o.postalCode || "—"}</p><p className="sm:col-span-2"><span className="text-[#9aa38f]">آدرس:</span> {o.province}، {o.city}، {o.addressLine}</p>{o.note && <p className="sm:col-span-2"><span className="text-[#9aa38f]">یادداشت مشتری:</span> {o.note}</p>}</div></Card>
          <Card title="تاریخچه"><ul className="space-y-2 text-[11px]">{(o.events ?? []).map((e, i) => <li key={i} className="flex gap-2 border-b border-[rgba(237,233,218,0.06)] pb-2"><span className="text-[#9aa38f]">{faDate(e.createdAt)}</span><span>{e.type === "note" ? `یادداشت: ${e.note}` : e.type === "payment_verified" ? `پرداخت تأیید شد (${e.note})` : e.type === "created" ? "ثبت سفارش" : `${e.type === "shipping_status" ? "ارسال" : "وضعیت"}: ${STATUS_FA[e.from ?? ""] ?? e.from} ← ${STATUS_FA[e.to ?? ""] ?? e.to}`}</span></li>)}</ul></Card>
        </div>
        <Card title="مدیریت وضعیت" className="h-fit">
          <div className="space-y-3 text-xs">
            <div className="flex gap-2"><Badge s={o.status} /><Badge s={o.paymentStatus} /><Badge s={o.shippingStatus} /></div>
            <label className="block"><span className="mb-1 block text-[#9aa38f]">وضعیت سفارش</span><ASelect value={f.status} onChange={(v) => setF({ ...f, status: v })} options={allowed(o.status, ORDER_TRANSITIONS, ORDER_STATUSES).map((s) => ({ value: s, label: STATUS_FA[s] ?? s }))} /></label>
            <label className="block"><span className="mb-1 block text-[#9aa38f]">وضعیت ارسال</span><ASelect value={f.shippingStatus} onChange={(v) => setF({ ...f, shippingStatus: v })} options={allowed(o.shippingStatus, SHIPPING_TRANSITIONS, SHIPPING_STATUSES).map((s) => ({ value: s, label: STATUS_FA[s] ?? s }))} /></label>
            <label className="block"><span className="mb-1 block text-[#9aa38f]">یادداشت داخلی</span><textarea className="a-input" rows={3} value={f.internalNote} onChange={(e) => setF({ ...f, internalNote: e.target.value })} /></label>
            <p className="text-[10px] leading-5 text-[#9aa38f]">وضعیت پرداخت فقط از مسیر درگاه یا بازپرداخت تغییر می‌کند. لغو سفارش پرداخت‌شده موجودی را برمی‌گرداند و پرداخت را «بازپرداخت‌شده» ثبت می‌کند.</p>
            {f.status === "cancelled" && o.paymentStatus === "paid" && <label className="flex items-center gap-2 font-bold text-rose-300"><input type="checkbox" checked={!!f.refund} onChange={(e) => setF({ ...f, refund: e.target.checked })} />بازپرداخت انجام شده؛ لغو را تأیید می‌کنم</label>}
            <button disabled={busy} onClick={save} className="a-btn a-btn-primary w-full justify-center">{busy ? <Spinner className="h-4 w-4" /> : "ذخیره تغییرات"}</button>
          </div>
        </Card>
      </div>
    </>
  );
}

/* ── customers ───────────────────────────────────── */
function Customers() {
  const { data } = useLoad<{ customers: (User & { orders: number; spent: number; active: boolean })[] }>("/admin/customers");
  if (!data) return <Loading />;
  return (<><PageHead title="مشتریان" sub={`${faNumber(data.customers.length)} مشتری`} /><div className="a-card overflow-x-auto"><table className="a-table"><thead><tr><th>نام</th><th>ایمیل</th><th>تلفن</th><th>سفارش‌ها</th><th>مجموع خرید</th><th>عضویت</th></tr></thead><tbody>{data.customers.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-[#9aa38f]">مشتری‌ای ثبت‌نام نکرده.</td></tr> : data.customers.map((c) => <tr key={c.id}><td className="font-bold">{c.name}</td><td dir="ltr" className="text-left">{c.email}</td><td dir="ltr" className="text-left">{c.phone || "—"}</td><td>{faNumber(c.orders)}</td><td>{formatPrice(c.spent)}</td><td className="text-[11px]">{c.createdAt ? faDate(c.createdAt) : "—"}</td></tr>)}</tbody></table></div></>);
}

/* ── inventory ───────────────────────────────────── */
function Inventory() {
  const { data, reload } = useLoad<{ products: { id: number; name: string; sku: string; stock: number; minStock: number }[]; transactions: { id: number; productName: string; type: string; quantity: number; before: number; after: number; reason: string; createdAt: string }[] }>("/admin/inventory");
  const { toast } = useAdmin(); const [f, setF] = useState({ productId: 0, quantity: 0, reason: "" });
  if (!data) return <Loading />;
  const TYPE: Record<string, string> = { sale: "فروش", return: "برگشت", restock: "شارژ انبار", adjustment: "اصلاح" };
  return (
    <>
      <PageHead title="موجودی انبار" />
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Card title="ثبت تغییر موجودی"><form onSubmit={async (e) => { e.preventDefault(); try { await post("/admin/inventory", f); toast("ثبت شد ✓"); setF({ productId: 0, quantity: 0, reason: "" }); reload(); } catch (e2) { toast((e2 as Error).message, true); } }} className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <ASelect value={String(f.productId)} onChange={(v) => setF({ ...f, productId: Number(v) })} options={[{ value: "0", label: "انتخاب محصول…" }, ...data.products.map((p) => ({ value: String(p.id), label: `${p.name} (موجودی ${faNumber(p.stock)})` }))]} placeholder="انتخاب محصول…" />
            <input className="a-input" dir="ltr" type="number" required placeholder="+5 / -2" value={f.quantity || ""} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} />
            <input className="a-input sm:col-span-2" placeholder="دلیل (مثلاً چاپ سری جدید)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
            <button className="a-btn a-btn-primary justify-center sm:col-span-2">ثبت</button></form></Card>
          <div className="a-card overflow-x-auto"><table className="a-table"><thead><tr><th>محصول</th><th>SKU</th><th>موجودی</th><th>حد هشدار</th></tr></thead><tbody>{data.products.map((p) => <tr key={p.id}><td className="font-bold">{p.name}</td><td className="font-latin text-[10px]">{p.sku}</td><td className={p.stock <= p.minStock ? "font-extrabold text-rose-300" : "text-[#a3f55a]"}>{faNumber(p.stock)}</td><td>{faNumber(p.minStock)}</td></tr>)}</tbody></table></div>
        </div>
        <Card title="تراکنش‌های انبار"><div className="overflow-x-auto"><table className="a-table"><thead><tr><th>تاریخ</th><th>محصول</th><th>نوع</th><th>تغییر</th><th>بعد</th><th>دلیل</th></tr></thead><tbody>{data.transactions.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-[#9aa38f]">تراکنشی نیست.</td></tr> : data.transactions.map((t) => <tr key={t.id}><td className="text-[10px]">{faDate(t.createdAt)}</td><td>{t.productName}</td><td>{TYPE[t.type] ?? t.type}</td><td className={t.quantity < 0 ? "text-rose-300" : "text-[#a3f55a]"} dir="ltr">{t.quantity > 0 ? "+" : ""}{faNumber(t.quantity)}</td><td>{faNumber(t.after)}</td><td className="text-[10px] text-[#9aa38f]">{t.reason}</td></tr>)}</tbody></table></div></Card>
      </div>
    </>
  );
}

/* ── users & roles ───────────────────────────────── */
function Users() {
  const { data, reload } = useLoad<{ users: (User & { active: boolean })[] }>("/admin/users"); const { toast, admin } = useAdmin();
  const [f, setF] = useState({ name: "", email: "", password: "", role: "staff", permissions: [] as string[] });
  if (!data) return <Loading />;
  const togglePerm = (u: User & { active: boolean }, p: string) => { const next = u.permissions?.includes(p) ? u.permissions.filter((x) => x !== p) : [...(u.permissions ?? []), p]; put(`/admin/users/${u.id}`, { permissions: next }).then(reload).catch((e) => toast((e as Error).message, true)); };
  return (
    <>
      <PageHead title="کاربران و نقش‌ها" sub="دسترسی‌های پنل مدیریت" />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3">{data.users.map((u) => (
          <Card key={u.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-extrabold">{u.name} {!u.active && <Badge s="cancelled" />}</p><p className="text-[11px] text-[#9aa38f]" dir="ltr">{u.email}</p></div>
            <div className="flex items-center gap-2"><ASelect className="w-32 [&>button]:!py-1.5" value={u.role} disabled={u.id === admin?.id} onChange={(v) => put(`/admin/users/${u.id}`, { role: v }).then(reload)} options={[{ value: "admin", label: "مدیر کل" }, { value: "manager", label: "مدیر" }, { value: "staff", label: "کارمند" }]} />{u.id !== admin?.id && <button onClick={() => put(`/admin/users/${u.id}`, { active: !u.active }).then(reload)} className={`a-btn ${u.active ? "a-btn-danger" : "a-btn-ghost"} !py-1.5 text-[11px]`}>{u.active ? "غیرفعال" : "فعال"}</button>}</div></div>
            {u.role !== "admin" && <div className="mt-3 flex flex-wrap gap-1.5">{PERMISSIONS.map(([k, l]) => <button key={k} onClick={() => togglePerm(u, k)} className={`a-badge cursor-pointer ${u.permissions?.includes(k) ? "bg-[#a3f55a] text-[#10150f]" : "bg-white/5 text-[#9aa38f]"}`}>{l}</button>)}</div>}
            {u.role === "admin" && <p className="mt-2 text-[10px] text-[#9aa38f]">مدیر کل به همهٔ بخش‌ها دسترسی دارد.</p>}</Card>))}</div>
        <Card title="کاربر جدید"><form onSubmit={async (e) => { e.preventDefault(); try { await post("/admin/users", f); toast("کاربر ساخته شد ✓"); setF({ name: "", email: "", password: "", role: "staff", permissions: [] }); reload(); } catch (e2) { toast((e2 as Error).message, true); } }} className="space-y-3">
          <input className="a-input" required placeholder="نام" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><input className="a-input" dir="ltr" type="email" required placeholder="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /><input className="a-input" dir="ltr" type="password" required minLength={12} placeholder="رمز (حداقل ۱۲ کاراکتر)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <ASelect value={f.role} onChange={(v) => setF({ ...f, role: v })} options={[{ value: "admin", label: "مدیر کل" }, { value: "manager", label: "مدیر" }, { value: "staff", label: "کارمند" }]} />
          {f.role !== "admin" && <div className="flex flex-wrap gap-1.5">{PERMISSIONS.map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, permissions: f.permissions.includes(k) ? f.permissions.filter((x) => x !== k) : [...f.permissions, k] })} className={`a-badge cursor-pointer ${f.permissions.includes(k) ? "bg-[#a3f55a] text-[#10150f]" : "bg-white/5 text-[#9aa38f]"}`}>{l}</button>)}</div>}
          <button className="a-btn a-btn-primary w-full justify-center">ایجاد</button></form></Card>
      </div>
    </>
  );
}

/* ── settings ────────────────────────────────────── */
function Settings() {
  const { data } = useLoad<{ settings: StoreSettings }>("/admin/settings"); const { toast } = useAdmin(); const [f, setF] = useState<StoreSettings | null>(null);
  useEffect(() => { if (data) setF(data.settings); }, [data]);
  if (!f) return <Loading />;
  /* تابع (نه کامپوننت) تا input ها با هر render از نو mount نشوند و focus حفظ شود */
  const field = (k: keyof StoreSettings, l: string, type = "text") => (
    <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-[#9aa38f]">{l}</span><input className="a-input" type={type} dir={type === "number" ? "ltr" : undefined} value={f[k] as string} onChange={(e) => setF({ ...f, [k]: type === "number" ? Number(e.target.value) : e.target.value })} /></label>
  );
  return (
    <form onSubmit={async (e) => { e.preventDefault(); try { await put("/admin/settings", f); toast("تنظیمات ذخیره شد ✓"); } catch (e2) { toast((e2 as Error).message, true); } }}>
      <PageHead title="تنظیمات فروشگاه" action={<button className="a-btn a-btn-primary">ذخیره</button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="فروشگاه"><div className="space-y-3">{field("store.name", "نام فروشگاه")}{field("store.email", "ایمیل")}{field("store.phone", "تلفن")}{field("store.currency", "واحد پول")}</div></Card>
        <Card title="سفارش و انبار"><div className="space-y-3">{field("orders.shippingFee", "هزینه ارسال (تومان؛ ۰ = رایگان)", "number")}{field("inventory.defaultThreshold", "حد پیش‌فرض هشدار موجودی", "number")}
          <div><span className="mb-1.5 block text-[11px] font-bold text-[#9aa38f]">درگاه پرداخت</span><ASelect value={f["payment.mode"]} onChange={(v) => setF({ ...f, "payment.mode": v })} options={[{ value: "demo", label: "آزمایشی (بدون پرداخت واقعی)" }, { value: "zarinpal", label: "زرین‌پال" }]} /><span className="mt-1 block text-[10px] text-[#9aa38f]">Merchant ID زرین‌پال در فایل api/config.php روی سرور تنظیم می‌شود.</span></div></div></Card>
        <Card title="سئو" className="lg:col-span-2"><div className="space-y-3">{field("seo.defaultTitle", "عنوان پیش‌فرض")}{field("seo.defaultDescription", "توضیح پیش‌فرض")}</div></Card>
      </div>
    </form>
  );
}

/* ── reports / analytics / best sellers ──────────── */
type Report = { summary: { revenue: number; orders: number; avg: number; items: number }; daily: { date: string; revenue: number; orders: number }[]; bestSellers: { productId: number; name: string; qty: number; revenue: number }[]; statusCounts: Record<string, number>; categories: { name: string; count: number }[] };
function useReport() {
  const [range, setRange] = useState(() => { const to = new Date(); const from = new Date(Date.now() - 30 * 864e5); return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; });
  const { data } = useLoad<Report>(`/admin/reports?from=${range.from}&to=${range.to}T23:59:59`);
  const Filter = <div className="mb-4 flex flex-wrap items-center gap-2 text-xs"><span className="text-[#9aa38f]">از</span><input type="date" className="a-input !w-auto" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /><span className="text-[#9aa38f]">تا</span><input type="date" className="a-input !w-auto" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>;
  return { data, Filter };
}
function Bars({ rows, k }: { rows: { label: string; value: number }[]; k: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.length === 0 ? <p className="py-8 text-center text-xs text-[#9aa38f]">داده‌ای در این بازه نیست.</p> : <div className="space-y-2">{rows.map((r) => <div key={r.label} className="flex items-center gap-3 text-[11px]"><span className="w-28 shrink-0 truncate text-[#9aa38f]">{r.label}</span><div className="h-5 flex-1 overflow-hidden rounded-md bg-white/5"><div className="h-full rounded-md bg-[#a3f55a]" style={{ width: `${(r.value / max) * 100}%` }} /></div><span className="w-28 text-end font-bold">{k(r.value)}</span></div>)}</div>;
}
function Reports() {
  const { data, Filter } = useReport();
  return (<><PageHead title="گزارش فروش" />{Filter}{!data ? <Loading /> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat l="درآمد" v={formatPrice(data.summary.revenue)} /><Stat l="سفارش پرداخت‌شده" v={faNumber(data.summary.orders)} /><Stat l="میانگین سبد" v={formatPrice(data.summary.avg)} /><Stat l="اقلام فروخته‌شده" v={faNumber(data.summary.items)} /></div><Card title="فروش روزانه" className="mt-4"><Bars rows={data.daily.map((d) => ({ label: d.date, value: d.revenue }))} k={formatPrice} /></Card></>}</>);
}
function Analytics() {
  const { data, Filter } = useReport();
  return (<><PageHead title="تحلیل" />{Filter}{!data ? <Loading /> : <div className="grid gap-4 lg:grid-cols-2"><Card title="وضعیت سفارش‌ها"><Bars rows={Object.entries(data.statusCounts).map(([s, v]) => ({ label: STATUS_FA[s] ?? s, value: v }))} k={faNumber} /></Card><Card title="محصولات در هر دسته"><Bars rows={data.categories.map((c) => ({ label: c.name, value: c.count }))} k={faNumber} /></Card><Card title="تعداد سفارش روزانه" className="lg:col-span-2"><Bars rows={data.daily.map((d) => ({ label: d.date, value: d.orders }))} k={faNumber} /></Card></div>}</>);
}
function BestSellers() {
  const { data, Filter } = useReport();
  return (<><PageHead title="پرفروش‌ها" />{Filter}{!data ? <Loading /> : <div className="a-card overflow-x-auto"><table className="a-table"><thead><tr><th>#</th><th>محصول</th><th>تعداد</th><th>درآمد</th></tr></thead><tbody>{data.bestSellers.length === 0 ? <tr><td colSpan={4} className="py-10 text-center text-[#9aa38f]">فروشی در این بازه نیست.</td></tr> : data.bestSellers.map((b, i) => <tr key={b.productId}><td>{faNumber(i + 1)}</td><td className="font-bold">{b.name}</td><td>{faNumber(b.qty)}</td><td>{formatPrice(b.revenue)}</td></tr>)}</tbody></table></div>}</>);
}

/* ── notifications / activity / change password ── */
function Notifications() {
  const { data, reload } = useLoad<{ notifications: { id: number; type: string; title: string; body: string; targetUrl: string; readAt: string | null; createdAt: string }[] }>("/admin/notifications");
  if (!data) return <Loading />;
  return (<><PageHead title="اعلان‌ها" action={<button onClick={() => post("/admin/notifications/read", {}).then(reload)} className="a-btn a-btn-ghost">خواندن همه</button>} /><div className="space-y-2">{data.notifications.length === 0 ? <Card><p className="py-6 text-center text-xs text-[#9aa38f]">اعلانی نیست.</p></Card> : data.notifications.map((n) => <Link key={n.id} to={n.targetUrl || "/admin"} onClick={() => post("/admin/notifications/read", { id: n.id })} className={`a-card flex items-start gap-3 p-4 hover:border-[#a3f55a66] ${n.readAt ? "opacity-60" : ""}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-white/20" : "bg-[#a3f55a]"}`} /><div className="flex-1"><p className="text-sm font-extrabold">{n.title}</p><p className="mt-0.5 text-xs text-[#9aa38f]">{n.body}</p></div><span className="text-[10px] text-[#9aa38f]">{faDate(n.createdAt)}</span></Link>)}</div></>);
}
function Messages() {
  const { data } = useLoad<{ messages: { id: number; name: string; contact: string; body: string; createdAt: string }[] }>("/admin/messages");
  if (!data) return <Loading />;
  return (
    <>
      <PageHead title="پیام‌های تماس" sub={`${faNumber(data.messages.length)} پیام`} />
      <div className="space-y-2">
        {data.messages.length === 0 ? <Card><p className="py-8 text-center text-xs text-[#9aa38f]">پیامی دریافت نشده.</p></Card> : data.messages.map((msg) => (
          <Card key={msg.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold">{msg.name}{msg.contact && <span className="ms-2 text-[11px] font-normal text-[#9aa38f]" dir="ltr">{msg.contact}</span>}</p>
              <span className="text-[10px] text-[#9aa38f]">{faDate(msg.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-[#c9cfc0]">{msg.body}</p>
          </Card>
        ))}
      </div>
    </>
  );
}

function Activity() {
  const { data } = useLoad<{ logs: { id: number; adminName: string; action: string; targetType: string; targetId: string; createdAt: string }[] }>("/admin/activity");
  if (!data) return <Loading />;
  return (<><PageHead title="فعالیت‌های مدیران" /><div className="a-card overflow-x-auto"><table className="a-table"><thead><tr><th>زمان</th><th>مدیر</th><th>عملیات</th><th>هدف</th></tr></thead><tbody>{data.logs.length === 0 ? <tr><td colSpan={4} className="py-10 text-center text-[#9aa38f]">فعالیتی ثبت نشده.</td></tr> : data.logs.map((l) => <tr key={l.id}><td className="text-[11px]">{faDate(l.createdAt)}</td><td>{l.adminName}</td><td className="font-latin text-[10px]">{l.action}</td><td className="font-latin text-[10px]">{l.targetType} #{l.targetId}</td></tr>)}</tbody></table></div></>);
}
function ChangePassword() {
  const { toast } = useAdmin(); const [f, setF] = useState({ current: "", next: "" });
  return (<><PageHead title="تغییر رمز عبور" /><Card className="max-w-md"><form onSubmit={async (e) => { e.preventDefault(); try { await post("/admin/change-password", f); toast("رمز تغییر کرد ✓"); setF({ current: "", next: "" }); } catch (e2) { toast((e2 as Error).message, true); } }} className="space-y-3"><input className="a-input" dir="ltr" type="password" required placeholder="رمز فعلی" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /><input className="a-input" dir="ltr" type="password" required minLength={12} placeholder="رمز جدید (حداقل ۱۲ کاراکتر)" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /><button className="a-btn a-btn-primary">تغییر رمز</button></form></Card></>);
}

/* ── root ────────────────────────────────────────── */
export default function AdminApp() {
  const [admin, setAdmin] = useState<User | null>(null); const [ready, setReady] = useState(false); const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  useEffect(() => { get<{ user: User | null }>("/admin/me").then((r) => setAdmin(r.user)).catch(() => {}).finally(() => setReady(true)); }, []);
  const toast = useCallback((t: string, bad = false) => { setMsg({ t, bad }); setTimeout(() => setMsg(null), 2800); }, []);
  const can = useCallback((perm: string) => !!admin && (admin.role === "admin" || admin.permissions?.includes("*") || admin.permissions?.includes(perm) === true), [admin]);
  const value = useMemo(() => ({ admin, setAdmin, toast, can }), [admin, toast, can]);
  if (!ready) return <div className="admin flex min-h-screen items-center justify-center"><Spinner /></div>;
  const P = ({ perm, children }: { perm?: string; children: ReactNode }) => (perm && !can(perm) ? <Card><p className="py-10 text-center text-sm text-[#9aa38f]">به این بخش دسترسی ندارید.</p></Card> : <>{children}</>);
  return (
    <Ctx.Provider value={value}>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route path="forgot-password" element={<AdminForgot />} />
        <Route path="reset-password" element={<AdminReset />} />
        <Route path="*" element={<Shell><Routes>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<P perm="products.manage"><ProductsList /></P>} />
          <Route path="products/:id" element={<P perm="products.manage"><ProductForm /></P>} />
          <Route path="categories" element={<P perm="categories.manage"><Categories /></P>} />
          <Route path="orders" element={<P perm="orders.manage"><Orders /></P>} />
          <Route path="orders/:publicId" element={<P perm="orders.manage"><OrderEditor /></P>} />
          <Route path="customers" element={<P perm="customers.view"><Customers /></P>} />
          <Route path="inventory" element={<P perm="inventory.manage"><Inventory /></P>} />
          <Route path="users" element={<P perm="users.manage"><Users /></P>} />
          <Route path="settings" element={<P perm="settings.manage"><Settings /></P>} />
          <Route path="reports" element={<P perm="reports.view"><Reports /></P>} />
          <Route path="analytics" element={<P perm="reports.view"><Analytics /></P>} />
          <Route path="best-sellers" element={<P perm="reports.view"><BestSellers /></P>} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="messages" element={<Messages />} />
          <Route path="activity" element={<P perm="users.manage"><Activity /></P>} />
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="*" element={<Card><p className="py-10 text-center text-sm text-[#9aa38f]">صفحه پیدا نشد.</p></Card>} />
        </Routes></Shell>} />
      </Routes>
      {msg && <div className={`fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 rounded-full px-5 py-3 text-sm font-bold shadow-2xl ${msg.bad ? "bg-rose-500 text-white" : "bg-[#a3f55a] text-[#10150f]"}`}>{msg.t}</div>}
    </Ctx.Provider>
  );
}
