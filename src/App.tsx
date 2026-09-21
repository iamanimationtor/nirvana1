import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { StoreProvider, useStore } from "./store/store";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { CartDrawer, QuickViewModal, SearchOverlay } from "./components/Overlays";
import { AboutPage, ContactPage, HomePage, NotFoundPage, ProductPage, ShopPage } from "./pages/StorePages";
import { AccountPage, AuthPage, CheckoutPage, OrderPage, PayPage, ResetPasswordPage } from "./pages/AccountPages";
import { Spinner } from "./components/ui";

const AdminApp = lazy(() => import("./admin/AdminApp"));

/* ── Error boundary: خطای غیرمنتظره نباید کل سایت را سفید کند ── */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("[nirvana]", error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="font-latin text-[10px] text-gold">UNEXPECTED ERROR</span>
        <h1 className="text-3xl font-extrabold">مشکلی پیش آمد</h1>
        <p className="max-w-md text-sm leading-7 text-inksoft">یک خطای غیرمنتظره رخ داد. صفحه را دوباره بارگذاری کن؛ اگر ادامه داشت با ما تماس بگیر.</p>
        <button onClick={() => { this.setState({ error: null }); window.location.href = "/"; }} className="btn btn-primary mt-2 px-8 py-4 text-sm">بازگشت به خانه</button>
      </div>
    );
  }
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { if (!window.location.hash) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, [pathname]);
  return null;
}

function StoreShell() {
  const { refreshCatalog } = useStore();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname.startsWith("/admin")) refreshCatalog();
  }, [pathname, refreshCatalog]);
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/product/:slug" element={<ProductPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/pay" element={<PayPage />} />
          <Route path="/orders/:publicId" element={<OrderPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      <CartDrawer />
      <SearchOverlay />
      <QuickViewModal />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <StoreProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/admin/*" element={<Suspense fallback={<div className="admin flex min-h-screen items-center justify-center"><Spinner /></div>}><AdminApp /></Suspense>} />
            <Route path="/*" element={<StoreShell />} />
          </Routes>
        </StoreProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
