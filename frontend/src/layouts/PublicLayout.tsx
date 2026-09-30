import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Container, Button } from '@components/ui';

const NAV_LINKS = [
  { to: '/#about', label: 'Sobre' },
  { to: '/#services', label: 'Serviços' },
  { to: '/#locations', label: 'Unidades' },
  { to: '/#reviews', label: 'Avaliações' },
];

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  // A landing page tem header e footer próprios
  const isLanding = location.pathname === '/';

  if (isLanding) return <Outlet />;

  return (
    <div className="min-h-screen bg-brand-white flex flex-col">
      <header className="border-b border-brand-gray bg-brand-white sticky top-0 z-40 backdrop-blur-md">
        <Container>
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="font-display font-bold text-display-sm tracking-tight" aria-label="MR. CUT">
              MR. CUT
            </Link>

            <nav className="hidden md:flex items-center gap-8" aria-label="Navegação principal">
              {NAV_LINKS.map((link) => (
                <Link key={link.to} to={link.to} className="btn-minimal">
                  {link.label}
                </Link>
              ))}
              <Link to="/login">
                <Button variant="outline" size="sm">Entrar</Button>
              </Link>
              <Link to="/agendar">
                <Button variant="solid" size="sm">Agendar</Button>
              </Link>
            </nav>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden p-2 -mr-2 text-brand-black"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>

          {menuOpen && (
            <div className="md:hidden border-t border-brand-gray py-4 animate-fade-in">
              <nav className="flex flex-col" aria-label="Navegação mobile">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className="font-display text-body py-3 border-b border-brand-gray"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="flex gap-3 pt-4">
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="flex-1">
                    <Button variant="outline" className="w-full">Entrar</Button>
                  </Link>
                  <Link to="/agendar" onClick={() => setMenuOpen(false)} className="flex-1">
                    <Button variant="solid" className="w-full">Agendar</Button>
                  </Link>
                </div>
              </nav>
            </div>
          )}
        </Container>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-brand-gray py-10 mt-auto">
        <Container>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-display font-bold text-body">MR. CUT</p>
            <p className="text-caption text-brand-grayMid">
              &copy; {new Date().getFullYear()} MR. CUT. Todos os direitos reservados.
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}

export default PublicLayout;