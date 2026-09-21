import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useStore } from "../store/store";
import { discountOf, faNumber, formatPrice, img, type Product } from "../lib/core";
import { IconCart, IconEye, IconHeart } from "./Icons";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { add, toggleWish, isWished, setQuickView } = useStore();
  const imgRef = useRef<HTMLImageElement>(null);
  const wished = isWished(product.id);
  const disc = discountOf(product);
  const out = product.stock <= 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="pcard group relative flex flex-col overflow-hidden rounded-[28px] border border-linec bg-paper/80"
    >
      <Link to={`/product/${product.slug}`} className="sheen relative block aspect-[4/5] overflow-hidden bg-tint">
        <img
          ref={imgRef}
          src={img(product.images[0])}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-110"
        />
        {product.images[1] && (
          <img src={img(product.images[1])} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-pine/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <div className="absolute start-3 top-3 flex flex-col gap-1.5">
          {disc > 0 && <span className="rounded-full bg-neon px-2.5 py-1 text-[10px] font-extrabold text-pine">{faNumber(disc)}٪ تخفیف</span>}
          {out && <span className="rounded-full bg-char/85 px-2.5 py-1 text-[10px] font-extrabold text-ivory">ناموجود</span>}
          {!out && product.stock <= 3 && <span className="rounded-full bg-gold/90 px-2.5 py-1 text-[10px] font-extrabold text-pine">فقط {faNumber(product.stock)} عدد</span>}
        </div>
      </Link>

      {/* action rail */}
      <div className="absolute end-3 top-3 flex flex-col gap-2 transition-all duration-500 md:translate-x-3 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100">
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => toggleWish(product)} aria-label="علاقه‌مندی" className={`glass glass-hover grid h-10 w-10 place-items-center rounded-full ${wished ? "text-rose-500" : "text-ink"}`}>
          <IconHeart className="h-4.5 w-4.5" filled={wished} />
        </motion.button>
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => setQuickView(product)} aria-label="نمایش سریع" className="glass glass-hover grid h-10 w-10 place-items-center rounded-full text-ink">
          <IconEye className="h-4.5 w-4.5" />
        </motion.button>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <span className="font-latin text-[9px] font-medium text-gold">{product.nameEn}</span>
        <Link to={`/product/${product.slug}`} className="line-clamp-1 text-sm font-extrabold transition-colors hover:text-forest dark:hover:text-neon">
          {product.name}
        </Link>
        <p className="line-clamp-1 text-[11px] text-inksoft">{product.categoryName}</p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-extrabold text-forest dark:text-neon">{formatPrice(product.price)}</span>
            {disc > 0 && product.oldPrice && <span className="text-[11px] text-inksoft line-through">{formatPrice(product.oldPrice)}</span>}
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            disabled={out}
            onClick={() => add(product, 1, imgRef.current)}
            aria-label="افزودن به سبد"
            className="btn btn-primary h-10 w-10 !p-0 disabled:opacity-40"
          >
            <IconCart className="h-4.5 w-4.5" />
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
