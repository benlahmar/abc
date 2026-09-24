import { Outlet, ScrollRestoration } from 'react-router';
import { Footer } from './Footer';
import { Header } from './Header';

export function Layout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[100] bg-midnight px-5 py-3 text-sm font-medium text-paper focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Aller au contenu principal
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration getKey={(location) => location.pathname} />
    </>
  );
}
