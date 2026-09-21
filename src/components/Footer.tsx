import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useStore } from "../store/store";
import { SOCIAL, faDigits } from "../lib/core";
import { Logo } from "./Navbar";
import { IconArrowLeft, IconInstagram, IconLeaf, IconTelegram } from "./Icons";
import { LeafBlob } from "./Icons";

export function Footer() {
  const { categories, notify } = useStore();
  const [email, setEmail] = useState("");
  const year = faDigits(new Date().toLocaleDateString("fa-IR-u-nu-latn", { year: "numeric" }));

  return (
    <footer className="relative overflow-hidden bg-pine text-ivory">
      <LeafBlob className="pointer-events-none absolute -top-24 end-[-80px] h-96 w-96 rotate-[120deg] text-forest/40" />
      <LeafBlob className="pointer-events-none absolute -bottom-32 start-[-100px] h-[28rem] w-[28rem] -rotate-[150deg] scale-x-[-1] text-olive/20" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/50 to-transparent" />

      <div className="container-x relative z-10 pt-20 pb-10">
        {/* newsletter */}
        <div className="glass flex flex-col items-center justify-between gap-6 rounded-[32px] p-8 md:flex-row md:p-10">
          <div>
            <span className="font-latin text-[10px] text-goldsoft">NEWSLETTER</span>
            <h3 className="mt-2 text-2xl font-extrabold">از آثار جدید زودتر باخبر شو</h3>
            <p className="mt-2 text-sm text-ivory/65">هر ماه فقط یک ایمیل؛ دربارهٔ نسخه‌های محدود و پشت‌صحنهٔ کارگاه.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (email) { notify("ایمیل شما ثبت شد ✓"); setEmail(""); } }} className="flex w-full max-w-md gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" dir="ltr" placeholder="you@example.com" className="field !bg-ivory/10 !text-ivory placeholder:!text-ivory/40 !border-ivory/20" />
            <button className="btn btn-primary !bg-neon !text-pine px-6 py-3.5 text-sm shrink-0">عضویت<IconArrowLeft className="h-4 w-4" /></button>
          </form>
        </div>

        <div className="mt-16 grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-5 max-w-xs text-sm leading-7 text-ivory/65">هنر سه‌بعدی برای زندگی واقعی. گالری و کارگاه چاپ سه‌بعدی نیروانا؛ هر قطعه یک داستان دارد.</p>
            <div className="mt-6 flex gap-3">
              {[{ href: SOCIAL.instagram, label: "اینستاگرام", icon: IconInstagram }, { href: SOCIAL.telegram, label: "تلگرام", icon: IconTelegram }, { href: SOCIAL.basalam, label: "باسلام", icon: IconLeaf }].map((s) => (
                <motion.a key={s.label} href={s.href} target="_blank" rel="noreferrer" whileHover={{ y: -4, scale: 1.06 }} whileTap={{ scale: 0.92 }} aria-label={s.label} className="grid h-11 w-11 place-items-center rounded-full border border-ivory/20 bg-ivory/5 text-ivory/80 backdrop-blur-md transition-all duration-300 hover:border-neon/60 hover:text-neon hover:shadow-[0_0_22px_-4px_rgba(163,245,90,0.5)]">
                  <s.icon className="h-5 w-5" />
                </motion.a>
              ))}
            </div>
          </div>

          <div>
            <p className="font-latin text-[10px] text-goldsoft">SHOP</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {categories.map((c) => (
                <li key={c.id}><Link to={`/shop?cat=${c.slug}`} className="text-ivory/70 transition-colors hover:text-neon">{c.name}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-latin text-[10px] text-goldsoft">NIRVANA</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link to="/about" className="text-ivory/70 transition-colors hover:text-neon">درباره ما</Link></li>
              <li><Link to="/contact" className="text-ivory/70 transition-colors hover:text-neon">تماس با ما</Link></li>
              <li><Link to="/shop" className="text-ivory/70 transition-colors hover:text-neon">همهٔ محصولات</Link></li>
              <li><Link to="/account" className="text-ivory/70 transition-colors hover:text-neon">حساب کاربری</Link></li>
              <li><Link to="/account?tab=orders" className="text-ivory/70 transition-colors hover:text-neon">پیگیری سفارش</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-latin text-[10px] text-goldsoft">CONTACT</p>
            <ul className="mt-4 space-y-2.5 text-sm text-ivory/70">
              <li>تهران، ایران</li>
              <li>شنبه تا چهارشنبه، ۱۰ تا ۱۹</li>
              <li dir="ltr" className="text-left">@nirvana.3dprint</li>
              <li dir="ltr" className="text-left">t.me/Nirvana3DPrint</li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-ivory/10 pt-6 text-[11px] text-ivory/50 md:flex-row">
          <p>© {year} نیروانا ۳دی — تمام حقوق محفوظ است.</p>
          <p className="font-latin text-[9px]">CRAFTED LAYER BY LAYER · TEHRAN</p>
        </div>
      </div>
    </footer>
  );
}
