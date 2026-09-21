import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store/store";
import { post } from "../lib/api";
import { SOCIAL, discountOf, faNumber, formatPrice, img } from "../lib/core";
import { CategorySection, CollectionBanner, FeaturedProducts, Hero, InstagramSection, Marquee, TrustStrip } from "../components/Home";
import { ProductCard } from "../components/ProductCard";
import { Empty, Reveal, Spinner } from "../components/ui";
import { IconArrowLeft, IconBox, IconCart, IconCheck, IconFilter, IconHeart, IconInstagram, IconLeaf, IconMinus, IconPlus, IconShield, IconSpark, IconTelegram, IconTruck } from "../components/Icons";

export function usePageTitle(t: string) {
  useEffect(() => { document.title = `${t} | نیروانا ۳دی`; return () => { document.title = "نیروانا ۳دی | Nirvana 3D — گالری هنر سه‌بعدی"; }; }, [t]);
}

// SEO helper: canonical, OG, Twitter, JSON-LD, breadcrumb
export function SEO({ title, description, canonical, ogImage, jsonLd, breadcrumb }: { title?: string; description?: string; canonical?: string; ogImage?: string; jsonLd?: object | object[]; breadcrumb?: { name: string; url: string }[] }) {
  useEffect(() => {
    if (title) document.title = `${title} | نیروانا ۳دی`;
    const setMeta = (sel: string, val: string, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${sel}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, sel); document.head.appendChild(el); }
      el.content = val;
    };
    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) { el = document.createElement("link"); el.rel = rel; document.head.appendChild(el); }
      el.href = href;
    };
    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, "property");
      setMeta("twitter:description", description);
    }
    if (title) {
      setMeta("og:title", title, "property");
      setMeta("twitter:title", title);
    }
    if (canonical) {
      setLink("canonical", canonical);
      setMeta("og:url", canonical, "property");
    }
    if (ogImage) {
      setMeta("og:image", ogImage, "property");
      setMeta("twitter:image", ogImage);
      setMeta("twitter:card", "summary_large_image");
      setMeta("og:type", title?.includes("محصول") ? "product" : "website", "property");
    } else {
      setMeta("og:type", "website", "property");
    }
    // JSON-LD
    const id = "nirvana-jsonld";
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (jsonLd) {
      if (!script) { script = document.createElement("script"); script.id = id; script.type = "application/ld+json"; document.head.appendChild(script); }
      const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      // Add breadcrumb if provided
      if (breadcrumb && breadcrumb.length) {
        arr.push({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumb.map((b, i) => ({ "@type": "ListItem", position: i+1, name: b.name, item: b.url }))
        });
      }
      script.textContent = JSON.stringify(arr.length === 1 ? arr[0] : arr);
    } else if (script && breadcrumb && breadcrumb.length) {
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumb.map((b, i) => ({ "@type": "ListItem", position: i+1, name: b.name, item: b.url }))
      });
    }
    return () => {
      // keep canonical but remove jsonld on unmount if needed
    };
  }, [title, description, canonical, ogImage, jsonLd, breadcrumb]);
  return null;
}

/* ── Home ─────────────────────────────────────────── */
export function HomePage() {
  const canonical = typeof window !== "undefined" ? window.location.origin + "/" : "https://example.com/";
  const desc = "گالری و کارگاه چاپ سه‌بعدی نیروانا؛ هنر سه‌بعدی برای دنیای واقعی — اکسسوری، دکور، فیگور و آثار خاص.";
  return (
    <>
      <SEO title="خانه" description={desc} canonical={canonical} ogImage={canonical + "images/hero.jpg"} jsonLd={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "نیروانا ۳دی",
        url: canonical,
        logo: canonical + "images/hero.jpg"
      }} />
      <Hero />
      <Marquee />
      <CategorySection />
      <FeaturedProducts />
      <CollectionBanner />
      <TrustStrip />
      <InstagramSection />
    </>
  );
}

/* ── Shop ─────────────────────────────────────────── */
const SORTS = [
  { v: "featured", l: "پیشنهاد ما" },
  { v: "new", l: "جدیدترین" },
  { v: "price-asc", l: "ارزان‌ترین" },
  { v: "price-desc", l: "گران‌ترین" },
  { v: "discount", l: "بیشترین تخفیف" },
];

export function ShopPage() {
  usePageTitle("فروشگاه");
  const { products, categories } = useStore();
  const [sp, setSp] = useSearchParams();
  const cat = sp.get("cat") ?? "";
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? "featured";
  const inStock = sp.get("stock") === "1";
  const [mobileFilters, setMobileFilters] = useState(false);
  const setParam = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };

  const list = useMemo(() => {
    let l = products.slice();
    if (cat) l = l.filter((p) => p.categorySlug === cat);
    if (q) { const s = q.toLowerCase(); l = l.filter((p) => [p.name, p.nameEn, p.categoryName, p.shortDesc, p.material].join(" ").toLowerCase().includes(s)); }
    if (inStock) l = l.filter((p) => p.stock > 0);
    switch (sort) {
      case "price-asc": l.sort((a, b) => a.price - b.price); break;
      case "price-desc": l.sort((a, b) => b.price - a.price); break;
      case "discount": l.sort((a, b) => discountOf(b) - discountOf(a)); break;
      case "new": l.sort((a, b) => b.id - a.id); break;
      default: l.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
    return l;
  }, [products, cat, q, sort, inStock]);

  const activeCat = categories.find((c) => c.slug === cat);

  const renderFilters = () => (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-extrabold text-inksoft">دسته‌بندی</p>
        <ul className="mt-3 space-y-1">
          <li><button onClick={() => setParam("cat", "")} className={`flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${!cat ? "bg-forest text-ivory dark:bg-neon dark:text-pine" : "hover:bg-tint"}`}>همه<span className="text-[11px] opacity-70">{faNumber(products.length)}</span></button></li>
          {categories.map((c) => (
            <li key={c.id}><button onClick={() => setParam("cat", c.slug)} className={`flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${cat === c.slug ? "bg-forest text-ivory dark:bg-neon dark:text-pine" : "hover:bg-tint"}`}>{c.name}<span className="text-[11px] opacity-70">{faNumber(products.filter((p) => p.categorySlug === c.slug).length)}</span></button></li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-extrabold text-inksoft">موجودی</p>
        <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold hover:bg-tint">
          <span className={`grid h-5 w-5 place-items-center rounded-md border transition-all ${inStock ? "border-forest bg-forest text-ivory dark:border-neon dark:bg-neon dark:text-pine" : "border-linec"}`}>{inStock && <IconCheck className="h-3.5 w-3.5" />}</span>
          <input type="checkbox" className="sr-only" checked={inStock} onChange={(e) => setParam("stock", e.target.checked ? "1" : "")} />
          فقط کالاهای موجود
        </label>
      </div>
    </div>
  );

  const shopCanonical = typeof window !== "undefined" ? window.location.origin + "/shop" + window.location.search : "https://example.com/shop";
  return (
    <div className="min-h-screen pt-32 pb-24">
      <SEO title="فروشگاه" description="همه آثار نیروانا — فیلتر بر اساس دسته، موجودی و قیمت." canonical={shopCanonical} ogImage={typeof window !== "undefined" ? window.location.origin + "/images/collection.jpg" : undefined} breadcrumb={[{ name: "خانه", url: typeof window !== "undefined" ? window.location.origin + "/" : "/" }, { name: "فروشگاه", url: shopCanonical }]} />
      <div className="container-x">
        <Reveal>
          <span className="font-latin text-[10px] font-medium text-gold">SHOP</span>
          <h1 className="mt-3 text-4xl font-extrabold md:text-5xl">{activeCat ? activeCat.name : q ? <>نتایج برای «<span className="text-gold">{q}</span>»</> : <>همهٔ <span className="text-gold">آثار</span></>}</h1>
          <p className="mt-4 max-w-lg text-sm leading-8 text-inksoft">{activeCat ? activeCat.blurb : "هر قطعه‌ای که این‌جا می‌بینی، یک ایدهٔ هنری است که لایه‌به‌لایه ساخته شده."}</p>
        </Reveal>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileFilters(true)} className="btn btn-glass glass glass-hover px-5 py-3 text-xs lg:hidden"><IconFilter className="h-4 w-4" />فیلترها</button>
            <span className="text-xs text-inksoft">{faNumber(list.length)} محصول</span>
            {q && <button onClick={() => setParam("q", "")} className="rounded-full border border-linec px-3 py-1.5 text-[11px] font-bold hover:border-rose-400">حذف جستجو ×</button>}
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {SORTS.map((s) => <button key={s.v} onClick={() => setParam("sort", s.v)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all ${sort === s.v ? "bg-forest text-ivory dark:bg-neon dark:text-pine" : "glass glass-hover"}`}>{s.l}</button>)}
          </div>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[240px_1fr]">
          <aside className="hidden lg:block"><div className="glass sticky top-28 rounded-[28px] p-5">{renderFilters()}</div></aside>
          <div>
            {list.length === 0 ? <Empty title="محصولی پیدا نشد" sub="فیلترها را تغییر بده یا عبارت دیگری جستجو کن." cta="پاک کردن فیلترها" to="/shop" /> : (
              <div className="grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-3">
                {list.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileFilters && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileFilters(false)} className="fixed inset-0 z-[100] bg-pine/50 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="fixed inset-x-0 bottom-0 z-[110] max-h-[80vh] overflow-y-auto rounded-t-[32px] bg-canvas p-6">
              <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-linec" />
              {renderFilters()}
              <button onClick={() => setMobileFilters(false)} className="btn btn-primary mt-6 w-full py-4 text-sm">نمایش {faNumber(list.length)} محصول</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Product ──────────────────────────────────────── */
export function ProductPage() {
  const { slug } = useParams();
  const { products, add, toggleWish, isWished, loading } = useStore();
  const p = products.find((x) => x.slug === slug);
  const [idx, setIdx] = useState(0);
  const [variant, setVariant] = useState("");
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"desc" | "features" | "shipping">("desc");
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => { setIdx(0); setQty(1); setVariant(p?.variants[0] ?? ""); window.scrollTo({ top: 0 }); }, [p?.id, p?.variants]);
  usePageTitle(p?.name ?? "محصول");

  if (!p) return <div className="container-x pt-40 pb-24">{loading ? <div className="flex justify-center"><Spinner /></div> : <><SEO title="محصول پیدا نشد" description="محصول مورد نظر یافت نشد." canonical={typeof window !== "undefined" ? window.location.href : undefined} /><Empty title="محصول پیدا نشد" cta="بازگشت به فروشگاه" to="/shop" /></>}</div>;
  const related = products.filter((x) => x.categorySlug === p.categorySlug && x.id !== p.id).slice(0, 4).concat(products.filter((x) => x.categorySlug !== p.categorySlug && x.id !== p.id)).slice(0, 4);
  const productCanonical = typeof window !== "undefined" ? window.location.origin + "/product/" + p.slug : "https://example.com/product/" + p.slug;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.shortDesc,
    image: p.images.map((s) => (typeof window !== "undefined" ? window.location.origin : "") + s),
    sku: p.sku,
    offers: {
      "@type": "Offer",
      priceCurrency: "IRR",
      price: p.price,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: productCanonical
    }
  };
  const disc = discountOf(p);
  const wished = isWished(p.id);

  return (
    <div className="min-h-screen pt-32 pb-24">
      <SEO title={p.name} description={p.shortDesc} canonical={productCanonical} ogImage={typeof window !== "undefined" ? window.location.origin + (p.images[0] || "/images/hero.jpg") : undefined} jsonLd={productJsonLd} breadcrumb={[{ name: "خانه", url: typeof window !== "undefined" ? window.location.origin + "/" : "/" }, { name: "فروشگاه", url: typeof window !== "undefined" ? window.location.origin + "/shop" : "/shop" }, { name: p.name, url: productCanonical }]} />
      <div className="container-x">
        <nav className="flex items-center gap-2 text-[11px] text-inksoft">
          <Link to="/" className="hover:text-ink">خانه</Link><span>/</span><Link to="/shop" className="hover:text-ink">فروشگاه</Link><span>/</span><Link to={`/shop?cat=${p.categorySlug}`} className="hover:text-ink">{p.categoryName}</Link><span>/</span><span className="text-ink">{p.name}</span>
        </nav>

        <div className="mt-8 grid gap-12 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[40px] bg-tint shadow-deep">
                <AnimatePresence mode="wait">
                  <motion.img key={idx} ref={imgRef} src={img(p.images[idx])} alt={p.name} initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0 h-full w-full object-cover" />
                </AnimatePresence>
                <div className="absolute start-5 top-5 flex flex-col gap-2">
                  {disc > 0 && <span className="rounded-full bg-neon px-3 py-1.5 text-xs font-extrabold text-pine">{faNumber(disc)}٪ تخفیف</span>}
                  {p.stock <= 0 && <span className="rounded-full bg-char/85 px-3 py-1.5 text-xs font-extrabold text-ivory">ناموجود</span>}
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                {p.images.map((s, i) => <button key={i} onClick={() => setIdx(i)} className={`h-24 w-20 overflow-hidden rounded-2xl border-2 transition-all ${i === idx ? "border-neon shadow-soft" : "border-transparent opacity-60 hover:opacity-100"}`}><img src={img(s)} alt="" className="h-full w-full object-cover" /></button>)}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <span className="font-latin text-[10px] text-gold">{p.nameEn}</span>
            <h1 className="mt-2 text-3xl font-extrabold leading-snug md:text-4xl">{p.name}</h1>
            <p className="mt-2 text-xs text-inksoft">{p.categoryName} · متریال {p.material}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="text-2xl font-extrabold text-forest dark:text-neon">{formatPrice(p.price)}</span>
              {disc > 0 && p.oldPrice && <span className="text-base text-inksoft line-through">{formatPrice(p.oldPrice)}</span>}
            </div>
            <p className="mt-6 text-sm leading-8 text-inksoft">{p.shortDesc}</p>

            {p.variants.length > 0 && (
              <div className="mt-7">
                <p className="text-xs font-extrabold">رنگ / نسخه: <span className="text-inksoft">{variant}</span></p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.variants.map((v) => <button key={v} onClick={() => setVariant(v)} className={`rounded-full border px-5 py-2.5 text-xs font-bold transition-all ${variant === v ? "border-forest bg-forest text-ivory dark:border-neon dark:bg-neon dark:text-pine" : "border-linec hover:border-forest/40"}`}>{v}</button>)}
                </div>
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <div className="glass flex items-center gap-1 rounded-full p-1">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-10 w-10 place-items-center rounded-full hover:bg-paper" aria-label="کمتر"><IconMinus className="h-4 w-4" /></button>
                <span className="w-8 text-center text-sm font-extrabold">{faNumber(qty)}</span>
                <button onClick={() => setQty(Math.min(10, qty + 1, Math.max(1, p.stock)))} className="grid h-10 w-10 place-items-center rounded-full hover:bg-paper" aria-label="بیشتر"><IconPlus className="h-4 w-4" /></button>
              </div>
              <button disabled={p.stock <= 0} onClick={() => add(p, qty, imgRef.current, variant)} className="btn btn-primary flex-1 py-4 text-sm"><IconCart className="h-4 w-4" />{p.stock > 0 ? "افزودن به سبد خرید" : "ناموجود"}</button>
              <button onClick={() => toggleWish(p)} className={`glass glass-hover glass-icon !h-13 !w-13 ${wished ? "text-rose-500" : "text-ink"}`} aria-label="علاقه‌مندی"><IconHeart className="h-5 w-5" filled={wished} /></button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[{ i: IconBox, t: "زمان آماده‌سازی", v: p.prepTime }, { i: IconTruck, t: "ارسال", v: "از تهران به سراسر ایران" }, { i: IconShield, t: "موجودی", v: p.stock > 0 ? `${faNumber(p.stock)} عدد` : "پیش‌ثبت سفارش" }].map((x) => (
                <div key={x.t} className="glass rounded-3xl p-4 text-center"><x.i className="mx-auto h-5 w-5 text-forest dark:text-neon" /><p className="mt-2 text-[10px] text-inksoft">{x.t}</p><p className="mt-0.5 text-[11px] font-extrabold">{x.v}</p></div>
              ))}
            </div>

            <div className="mt-10">
              <div className="flex gap-1 border-b border-linec">
                {[{ k: "desc", l: "توضیحات" }, { k: "features", l: "ویژگی‌ها" }, { k: "shipping", l: "ارسال و مرجوعی" }].map((t) => (
                  <button key={t.k} onClick={() => setTab(t.k as typeof tab)} className={`relative px-4 py-3 text-sm font-bold transition-colors ${tab === t.k ? "text-ink" : "text-inksoft hover:text-ink"}`}>
                    {t.l}{tab === t.k && <motion.span layoutId="ptab" className="absolute inset-x-2 -bottom-px h-0.5 bg-neon" />}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="py-6 text-sm leading-8 text-inksoft">
                  {tab === "desc" && <p>{p.description}</p>}
                  {tab === "features" && <ul className="space-y-2">{p.features.map((f) => <li key={f} className="flex items-start gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{f}</li>)}</ul>}
                  {tab === "shipping" && <p>سفارش‌ها پس از آماده‌سازی ({p.prepTime}) با بسته‌بندی ایمن از تهران ارسال می‌شوند. در صورت آسیب در حمل، تا ۴۸ ساعت پس از دریافت با ما در تماس باشید تا قطعه بدون هزینه جایگزین شود.</p>}
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>

        {related.length > 0 && (
          <div className="mt-28">
            <Reveal><span className="font-latin text-[10px] text-gold">YOU MAY ALSO LIKE</span><h2 className="mt-3 text-3xl font-extrabold">آثار <span className="text-gold">مرتبط</span></h2></Reveal>
            <div className="mt-10 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">{related.map((x, i) => <ProductCard key={x.id} product={x} index={i} />)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── About ────────────────────────────────────────── */
const VALUES = [
  { icon: IconSpark, t: "طراحی متفاوت", d: "هر اثر از یک ایدهٔ هنری شروع می‌شود، نه از یک قالب تکراری. طراحی‌ها اختصاصی‌اند و برای فضای زندگی تو ساخته می‌شوند." },
  { icon: IconBox, t: "چاپ لایه‌به‌لایه", d: "با پرینترهای دقیق فیرمونت و متریال‌های باکیفیت، هر قطعه ساعت‌ها وقت می‌خواهد — و این وقت در جزئیات دیده می‌شود." },
  { icon: IconShield, t: "اصالت و محدودیت", d: "آثار خاص به تعداد محدود چاپ می‌شوند و همراه با گواهی اصالت به دست تو می‌رسند." },
  { icon: IconLeaf, t: "سبز بودن", d: "متریال‌های سازگار با محیط‌زیست و پدربازهای گیاهی؛ گالری‌ای که به زمین فکر می‌کند." },
];
export function AboutPage() {
  usePageTitle("درباره ما");
  const aboutCanonical = typeof window !== "undefined" ? window.location.origin + "/about" : "https://example.com/about";
  return (
    <div className="min-h-screen pt-32 pb-20">
      <SEO title="درباره ما" description="داستان نیروانا ۳دی — گالری چاپ سه‌بعدی لایه‌به‌لایه از تهران." canonical={aboutCanonical} ogImage={typeof window !== "undefined" ? window.location.origin + "/images/lifestyle.jpg" : undefined} breadcrumb={[{ name: "خانه", url: typeof window !== "undefined" ? window.location.origin + "/" : "/" }, { name: "درباره ما", url: aboutCanonical }]} />
      <div className="container-x">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="font-latin text-[10px] font-medium text-gold">ABOUT NIRVANA</span>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.3] md:text-5xl">گالری‌ای که از لایه‌های<br />چاپ <span className="text-gold">ساخته شده</span></h1>
            <p className="mt-6 max-w-lg text-sm leading-8 text-inksoft">نیروانا ۳دی یک گالری و کارگاه چاپ سه‌بعدی در تهران است. ما باور داریم اشیای خانگی باید فقط کاربردی نباشند؛ باید قصه بگویند. از یک گلدان ارگانیک تا فیگورهای گیمینگ، هر چیزی که در گالری می‌بینی، ابتدا یک ایدهٔ هنری است و بعد از صدها لایهٔ چاپ، به شکل درمی‌آید.</p>
            <p className="mt-4 max-w-lg text-sm leading-8 text-inksoft">«نیروانا» به معنای آزادی است؛ آزادی از اشیاء معمولی. ما هر اثر را برای آدم‌هایی می‌سازیم که خانهٔ‌شان را موزهٔ کوچکِ خودشان می‌دانند.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={SOCIAL.basalam} target="_blank" rel="noreferrer" className="btn btn-glass glass glass-hover px-6 py-3.5 text-sm">غرفهٔ ما در باسلام</a>
              <a href={SOCIAL.instagram} target="_blank" rel="noreferrer" className="btn btn-gold px-6 py-3.5 text-sm">اینستاگرام گالری</a>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="relative">
              <div aria-hidden className="absolute -inset-4 -z-10 rounded-[44px] bg-[radial-gradient(circle_at_top,rgba(194,161,91,0.2),transparent_60%)] blur-xl" />
              <div className="animate-floaty-soft relative aspect-[4/5] overflow-hidden rounded-[38px] shadow-deep"><img src={img("/images/lifestyle.jpg")} alt="فضای کارگاه نیروانا" className="h-full w-full object-cover" /></div>
              <div className="glass absolute -bottom-6 start-6 rounded-2xl px-5 py-3.5 text-xs font-extrabold">تهران · کارگاه و گالری</div>
            </div>
          </Reveal>
        </div>
        <div className="mt-24 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <Reveal key={v.t} delay={i * 0.08}>
              <div className="group h-full rounded-[26px] border border-linec bg-paper/70 p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-deep">
                <span className="glass glass-hover grid h-14 w-14 place-items-center rounded-2xl text-forest dark:text-neon"><v.icon className="h-6 w-6" /></span>
                <h3 className="mt-5 text-base font-extrabold">{v.t}</h3>
                <p className="mt-2.5 text-xs leading-6 text-inksoft">{v.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Contact ──────────────────────────────────────── */
const CHANNELS = [
  { icon: IconInstagram, t: "اینستاگرام", v: "@nirvana.3dprint", href: SOCIAL.instagram, ltr: true },
  { icon: IconTelegram, t: "تلگرام", v: "t.me/Nirvana3DPrint", href: SOCIAL.telegram, ltr: true },
  { icon: IconLeaf, t: "باسلام", v: "غرفهٔ پرینت سه‌بعدی نیروانا", href: SOCIAL.basalam, ltr: false },
];
export function ContactPage() {
  usePageTitle("تماس با ما");
  const contactCanonical = typeof window !== "undefined" ? window.location.origin + "/contact" : "https://example.com/contact";
  const { notify } = useStore();
  const [f, setF] = useState({ name: "", contact: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await post("/contact", f); setDone(true); notify("پیام شما ارسال شد ✓"); } catch (err) { notify((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen pt-32 pb-20">
      <SEO title="تماس با ما" description="سفارش اختصاصی، چاپ طراحی خودت یا گفت‌وگو درباره ایده — با نیروانا تماس بگیر." canonical={contactCanonical} breadcrumb={[{ name: "خانه", url: typeof window !== "undefined" ? window.location.origin + "/" : "/" }, { name: "تماس", url: contactCanonical }]} />
      <div className="container-x">
        <Reveal>
          <span className="font-latin text-[10px] font-medium text-gold">CONTACT</span>
          <h1 className="mt-3 text-4xl font-extrabold md:text-5xl">با ما در <span className="text-gold">تماس</span> باش</h1>
          <p className="mt-5 max-w-lg text-sm leading-8 text-inksoft">سفارش اختصاصی، چاپ طراحی خودت، یا حتی فقط گفت‌وگو دربارهٔ یک ایده — اینجاییم. معمولی‌ترین راه‌ها را هم می‌گذاری، اما معمولی جواب نمی‌دهیم.</p>
        </Reveal>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col gap-4">
            {CHANNELS.map((c, i) => (
              <Reveal key={c.t} delay={i * 0.08}>
                <a href={c.href} target="_blank" rel="noreferrer" className="glass glass-hover group flex items-center gap-4 rounded-[24px] p-5">
                  <span className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-forest text-ivory transition-all duration-500 group-hover:scale-110 group-hover:text-neon dark:bg-neon dark:text-pine"><c.icon className="h-6 w-6" /></span>
                  <span><span className="block text-sm font-extrabold">{c.t}</span><span dir={c.ltr ? "ltr" : "rtl"} className="mt-1 block text-xs font-bold text-inksoft">{c.v}</span></span>
                </a>
              </Reveal>
            ))}
            <Reveal delay={0.3}>
              <div className="rounded-[24px] border border-linec bg-paper/70 p-5 text-xs leading-6 text-inksoft">
                <p className="text-sm font-extrabold text-ink">کارگاه و گالری</p><p className="mt-1">تهران، ایران</p><p className="mt-3">پاسخ‌گویی از ساعت ۱۰ صبح تا ۷ عصر، شنبه تا چهارشنبه.</p>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.15}>
            <form onSubmit={submit} className="glass rounded-[32px] p-7 md:p-9">
              {done ? (
                <div className="py-10 text-center"><span className="glass mx-auto grid h-16 w-16 place-items-center rounded-full text-forest dark:text-neon"><IconCheck className="h-7 w-7" /></span><p className="mt-5 text-lg font-extrabold">پیام تو رسید</p><p className="mt-2 text-sm text-inksoft">به‌زودی از همان راهی که گفتی جواب می‌دهیم.</p></div>
              ) : (
                <>
                  <p className="text-lg font-extrabold">پیام بفرست</p>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="نام" className="field" />
                    <input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="ایمیل یا شماره تماس" className="field" />
                  </div>
                  <textarea required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={6} placeholder="ایده یا سفارشت را بنویس…" className="field mt-4 resize-none" />
                  <button disabled={busy} className="btn btn-primary mt-6 w-full py-4 text-sm">{busy ? <Spinner /> : <>ارسال پیام<IconArrowLeft className="h-4 w-4" /></>}</button>
                </>
              )}
            </form>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/* ── 404 ──────────────────────────────────────────── */
export function NotFoundPage() {
  usePageTitle("پیدا نشد");
  const canonical = typeof window !== "undefined" ? window.location.href : "";
  return (
    <div className="container-x flex min-h-screen flex-col items-center justify-center pt-32 pb-20 text-center">
      <SEO title="پیدا نشد" description="صفحه مورد نظر یافت نشد." canonical={canonical} />
      <meta name="prerender-status-code" content="404" />
      <span className="font-latin text-[10px] text-gold">404</span>
      <h1 className="mt-3 text-4xl font-extrabold md:text-5xl">این لایه چاپ <span className="text-gold">نشده</span></h1>
      <p className="mt-4 max-w-md text-sm leading-8 text-inksoft">صفحه‌ای که دنبالش بودی وجود ندارد یا جابه‌جا شده است.</p>
      <Link to="/" className="btn btn-primary mt-8 px-8 py-4 text-sm">بازگشت به خانه<IconArrowLeft className="h-4 w-4" /></Link>
    </div>
  );
}
