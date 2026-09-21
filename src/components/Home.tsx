import { useRef, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { useStore } from "../store/store";
import { INSTAGRAM_POSTS, SOCIAL, faNumber, formatPrice, img } from "../lib/core";
import { CategoryIcon, EASE, Magnetic, Reveal, SectionHead } from "./ui";
import { IconArrowLeft, IconInstagram, IconBox, IconShield, IconTruck, IconSpark } from "./Icons";
import { LeafBlob } from "./Icons";
import { ProductCard } from "./ProductCard";

const TITLE_LINES = [{ words: ["هنر", "سه‌بعدی"] }, { words: ["برای", "زندگی", "واقعی"] }];

/* ── Hero ────────────────────────────────────────── */
export function Hero() {
  const { products } = useStore();
  const product = products.find((p) => p.slug === "wave-vase") ?? products[0];
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const bgX = useSpring(useTransform(mx, [-1, 1], [12, -12]), { stiffness: 60, damping: 20 });
  const bgY = useSpring(useTransform(my, [-1, 1], [10, -10]), { stiffness: 60, damping: 20 });
  const fgX = useSpring(useTransform(mx, [-1, 1], [-26, 26]), { stiffness: 60, damping: 20 });
  const fgY = useSpring(useTransform(my, [-1, 1], [-18, 18]), { stiffness: 60, damping: 20 });
  const onMouseMove = (e: MouseEvent) => { mx.set((e.clientX / window.innerWidth) * 2 - 1); my.set((e.clientY / window.innerHeight) * 2 - 1); };

  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-28 pb-16" onMouseMove={onMouseMove}>
      <div className="dust pointer-events-none absolute inset-0" aria-hidden>
        {[[8, 70, 0], [18, 45, 2], [27, 80, 4], [36, 35, 1], [47, 65, 3], [58, 30, 5], [66, 75, 2.5], [74, 40, 0.5], [83, 60, 3.5], [91, 35, 1.5], [15, 25, 4.5], [52, 88, 6]].map(([l, t, d], i) => (
          <i key={i} style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${d}s`, animationDuration: `${9 + (i % 4) * 2}s` }} />
        ))}
      </div>
      <motion.div aria-hidden style={{ x: bgX, y: bgY }} className="pointer-events-none absolute inset-0">
        <LeafBlob className="absolute -top-16 end-[-60px] h-64 w-64 rotate-[130deg] text-olive/25 dark:text-olive/40" />
        <LeafBlob className="absolute bottom-[-40px] start-[-70px] h-72 w-72 -rotate-[140deg] scale-x-[-1] text-gold/20 dark:text-gold/30" />
      </motion.div>
      <motion.div aria-hidden style={{ x: fgX, y: fgY }} className="pointer-events-none absolute inset-0 z-[1]">
        <LeafBlob className="animate-floaty-soft absolute top-24 start-[38%] hidden h-32 w-32 rotate-[160deg] text-forest/20 lg:block dark:text-neon/20" />
        <LeafBlob className="animate-floaty absolute bottom-24 end-[8%] h-28 w-28 rotate-[200deg] scale-x-[-1] text-olive/30 dark:text-neon/25" />
      </motion.div>

      <div className="container-x relative z-10 grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
        <div>
          <motion.span initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.7, ease: EASE }} className="glass inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-xs font-bold text-ink">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-neon" /></span>
            گالری و کارگاه چاپ سه‌بعدی — تهران
          </motion.span>

          <h1 className="mt-7 text-[2.6rem] font-extrabold leading-[1.15] sm:text-6xl lg:text-[4.4rem]">
            {TITLE_LINES.map((line, li) => (
              <span key={li} className="block overflow-hidden pb-1">
                {line.words.map((w, wi) => (
                  <motion.span key={wi} initial={{ y: "110%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 + (li * 3 + wi) * 0.09, duration: 0.9, ease: EASE }} className={`inline-block ${li === 1 && wi === 2 ? "text-gold" : ""}`}>
                    {w}{wi < line.words.length - 1 ? "\u00A0" : ""}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>

          <motion.p initial={{ opacity: 0, y: 20, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 1.1, duration: 0.8, ease: EASE }} className="mt-6 max-w-md text-base leading-8 text-inksoft md:text-lg">
            اکسسوری، دکور، فیگور و آثار خاص<br />با طراحی متفاوت و چاپ سه‌بعدی
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.8, ease: EASE }} className="mt-9 flex flex-wrap items-center gap-4">
            <Magnetic><Link to="/shop" className="btn btn-primary group px-8 py-4 text-sm">مشاهده محصولات<IconArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" /></Link></Magnetic>
            <Magnetic><a href="#collection" className="btn btn-glass glass glass-hover px-8 py-4 text-sm">کشف کالکشن</a></Magnetic>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 1 }} className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-inksoft">
            <span>چاپ با دقت ۰٫۱۲ میلی‌متر</span><span className="h-1 w-1 rounded-full bg-gold" /><span>طراحی اختصاصی</span><span className="h-1 w-1 rounded-full bg-gold" /><span>ارسال از تهران</span>
          </motion.div>
        </div>

        <div className="relative mx-auto mb-16 w-full max-w-[480px] lg:mb-0 lg:max-w-none">
          <div className="animate-spin-slow absolute -top-8 end-6 hidden h-40 w-40 rounded-full border border-dashed border-gold/40 md:block" aria-hidden />
          <motion.div initial={{ opacity: 0, y: 60, scale: 0.94, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} transition={{ delay: 0.5, duration: 1.1, ease: EASE }} className="relative">
            <motion.div animate={{ y: [0, -14, 0] }} transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }} className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[44px] shadow-deep">
                <img src={img("/images/hero.jpg")} alt="گالری نیروانا" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-pine/30 via-transparent to-transparent" />
              </div>
            </motion.div>
            <div aria-hidden className="absolute -bottom-8 left-1/2 h-10 w-3/4 -translate-x-1/2 rounded-full bg-pine/25 blur-2xl dark:bg-black/60" />
            {product && (
              <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.4, duration: 0.9, ease: EASE }} className="absolute -bottom-10 end-[-8px]">
                <Link to={`/product/${product.slug}`} style={{ animation: "floaty-soft 9s ease-in-out infinite", animationDelay: "1s" }} className="glass flex w-64 items-center gap-3 rounded-3xl p-3 shadow-deep">
                  <span className="h-14 w-12 shrink-0 overflow-hidden rounded-2xl"><img src={img(product.images[0])} alt="" className="h-full w-full object-cover" /></span>
                  <span className="min-w-0">
                    <p className="truncate text-xs font-extrabold">{product.name}</p>
                    <p className="mt-0.5 text-xs font-bold text-forest dark:text-neon">{formatPrice(product.price)}</p>
                  </span>
                </Link>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>

      <motion.a href="#categories" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 1 }} className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-inksoft md:flex" aria-label="اسکرول">
        <span className="font-latin text-[9px]">SCROLL</span>
        <span className="relative h-10 w-px overflow-hidden bg-linec"><motion.span animate={{ y: [-24, 24] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-x-0 h-5 bg-gold" /></span>
      </motion.a>
    </section>
  );
}

/* ── Marquee ─────────────────────────────────────── */
export function Marquee() {
  const items = ["چاپ سه‌بعدی اختصاصی", "طراحی پارامتریک", "نسخه‌های محدود", "ارسال به سراسر ایران", "متریال سازگار با محیط‌زیست", "گواهی اصالت"];
  return (
    <div className="border-y border-linec bg-tint/60 py-4">
      <div className="marquee-track gap-12 text-xs font-extrabold text-inksoft">
        {[...items, ...items].map((t, i) => (
          <span key={i} className="flex items-center gap-12"><span>{t}</span><span className="h-1.5 w-1.5 rounded-full bg-gold" /></span>
        ))}
      </div>
    </div>
  );
}

/* ── Categories ──────────────────────────────────── */
export function CategorySection() {
  const { categories, products } = useStore();
  return (
    <section id="categories" className="py-24">
      <div className="container-x">
        <Reveal><SectionHead eyebrow="CATEGORIES" title={<>دسته‌بندی‌های <span className="text-gold">گالری</span></>} sub="از فیگورهای گیمینگ تا نورپردازی پارامتریک؛ هر دسته یک دنیای متفاوت است." action="همهٔ محصولات" actionTo="/shop" /></Reveal>
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {categories.map((c, i) => {
            const n = products.filter((p) => p.categorySlug === c.slug).length;
            return (
              <Reveal key={c.id} delay={i * 0.07}>
                <Link to={`/shop?cat=${c.slug}`} className="glass glass-hover sheen group flex h-full flex-col items-center rounded-[28px] p-6 text-center transition-transform duration-500 hover:-translate-y-2">
                  <span className="grid h-16 w-16 place-items-center rounded-3xl bg-forest text-ivory shadow-soft transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 group-hover:text-neon dark:bg-neon dark:text-pine dark:group-hover:text-pine">
                    <CategoryIcon icon={c.icon} className="h-7 w-7" />
                  </span>
                  <span className="mt-4 text-sm font-extrabold">{c.name}</span>
                  <span className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-inksoft">{c.blurb}</span>
                  <span className="font-latin mt-3 text-[9px] text-gold">{faNumber(n)} ITEMS</span>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Featured ────────────────────────────────────── */
export function FeaturedProducts() {
  const { products } = useStore();
  const list = products.filter((p) => p.featured).slice(0, 8);
  return (
    <section id="featured" className="py-10 pb-24">
      <div className="container-x">
        <Reveal><SectionHead eyebrow="FEATURED" title={<>آثار <span className="text-gold">منتخب</span></>} sub="محبوب‌ترین قطعات گالری؛ آن‌هایی که بیشتر از همه دربارهٔ آن‌ها حرف می‌زنند." action="مشاهده فروشگاه" actionTo="/shop" /></Reveal>
        <div className="mt-12 grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {list.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </div>
    </section>
  );
}

/* ── Collection banner ───────────────────────────── */
export function CollectionBanner() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  return (
    <section id="collection" ref={ref} className="relative h-[80vh] min-h-[560px] overflow-hidden">
      <motion.div style={{ y: imgY }} className="absolute inset-[-14%_0]">
        <img src={img("/images/collection.jpg")} alt="" className="h-full w-full object-cover" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-l from-pine/85 via-pine/55 to-pine/25" />
      <div className="animate-ray absolute -top-10 start-[16%] h-[130%] w-36 rotate-[18deg] bg-gradient-to-b from-goldsoft/30 via-goldsoft/10 to-transparent blur-xl" aria-hidden />
      <div className="animate-ray absolute -top-10 start-[34%] h-[130%] w-20 rotate-[18deg] bg-gradient-to-b from-goldsoft/20 via-goldsoft/5 to-transparent blur-xl" style={{ animationDelay: "2.5s" }} aria-hidden />
      <motion.svg aria-hidden animate={{ y: [0, -16, 0], rotate: [0, 4, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} viewBox="0 0 200 200" className="absolute bottom-[-30px] end-[6%] h-56 w-56 text-neon/15" fill="currentColor">
        <path d="M100 195C42 160 20 110 38 55 88 28 148 38 172 88c18 44-14 92-72 107Z" />
      </motion.svg>
      <motion.div style={{ y: contentY }} className="container-x relative z-10 flex h-full items-center">
        <div className="max-w-2xl text-ivory">
          <motion.span initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, ease: EASE }} className="font-latin inline-block rounded-full border border-ivory/25 px-4 py-2 text-[10px] backdrop-blur-sm">THE COLLECTION</motion.span>
          <h2 className="mt-6 text-4xl font-extrabold leading-[1.2] md:text-6xl">
            <span className="block overflow-hidden pb-1"><motion.span initial={{ y: "105%" }} whileInView={{ y: "0%" }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.85, delay: 0.1, ease: EASE }} className="block">هر قطعه،</motion.span></span>
            <span className="block overflow-hidden pb-2"><motion.span initial={{ y: "105%" }} whileInView={{ y: "0%" }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.85, delay: 0.22, ease: EASE }} className="block">یک <span className="text-goldsoft">داستان</span> دارد.</motion.span></span>
          </h2>
          <motion.p initial={{ opacity: 0, y: 20, filter: "blur(8px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.8, delay: 0.4, ease: EASE }} className="mt-5 max-w-md text-sm leading-8 text-ivory/75 md:text-base">محصولاتی متفاوت برای آدم‌هایی که چیزهای معمولی نمی‌خواهند.</motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.8, delay: 0.55, ease: EASE }} className="mt-9 flex flex-wrap items-center gap-4">
            <Magnetic><Link to="/shop" className="btn btn-gold group px-8 py-4 text-sm">مشاهده کالکشن<IconArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" /></Link></Magnetic>
            <a href={SOCIAL.instagram} target="_blank" rel="noreferrer" className="glass flex items-center gap-2 rounded-full px-6 py-4 text-sm font-bold text-ivory transition-colors hover:text-neon"><IconInstagram className="h-4 w-4" />در اینستاگرام ببین</a>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

/* ── Trust strip ─────────────────────────────────── */
export function TrustStrip() {
  const items = [
    { icon: IconSpark, t: "طراحی اختصاصی", d: "هر اثر از یک ایدهٔ هنری شروع می‌شود" },
    { icon: IconBox, t: "چاپ لایه‌به‌لایه", d: "دقت ۰٫۱۲ میلی‌متر، متریال باکیفیت" },
    { icon: IconTruck, t: "ارسال از تهران", d: "بسته‌بندی ایمن به سراسر ایران" },
    { icon: IconShield, t: "گواهی اصالت", d: "برای نسخه‌های محدود و آثار خاص" },
  ];
  return (
    <section className="py-20">
      <div className="container-x grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <Reveal key={it.t} delay={i * 0.08}>
            <div className="group flex items-center gap-4 rounded-[26px] border border-linec bg-paper/70 p-5 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-deep">
              <span className="glass glass-hover grid h-13 w-13 shrink-0 place-items-center rounded-2xl text-forest dark:text-neon"><it.icon className="h-6 w-6" /></span>
              <span><span className="block text-sm font-extrabold">{it.t}</span><span className="mt-1 block text-[11px] leading-5 text-inksoft">{it.d}</span></span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── Instagram ───────────────────────────────────── */
export function InstagramSection() {
  return (
    <section className="py-10 pb-28">
      <div className="container-x">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="font-latin text-[10px] font-medium text-gold">INSTAGRAM</span>
              <h2 className="mt-3 text-3xl font-extrabold md:text-4xl">پشت‌صحنهٔ <span className="text-gold">استودیو</span></h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-inksoft">لحظه‌هایی از چاپ، نورپردازی و چیدمان؛ ما را در اینستاگرام دنبال کن.</p>
            </div>
            <a href={SOCIAL.instagram} target="_blank" rel="noreferrer" className="btn btn-glass glass glass-hover px-6 py-3.5 text-xs"><IconInstagram className="h-4 w-4" />@nirvana.3dprint</a>
          </div>
        </Reveal>
        <div className="mt-12 columns-2 gap-4 md:columns-3 lg:columns-5">
          {INSTAGRAM_POSTS.map((post, i) => (
            <Reveal key={i} delay={(i % 5) * 0.06} className="mb-4 break-inside-avoid">
              <a href={SOCIAL.instagram} target="_blank" rel="noreferrer" className={`sheen group relative block overflow-hidden rounded-[24px] bg-tint ${post.ratio}`}>
                <img src={img(post.src)} alt={post.caption} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-110" />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-pine/80 via-pine/20 to-transparent p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  <p className="text-xs font-bold leading-5 text-ivory">{post.caption}</p>
                </div>
                <span className="absolute end-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-ivory/15 text-ivory backdrop-blur-md opacity-0 transition-opacity duration-500 group-hover:opacity-100"><IconInstagram className="h-4 w-4" /></span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
