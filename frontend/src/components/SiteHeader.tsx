import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Container, Button } from '@components/ui';
import { MenuIcon, CloseIcon } from '@components/icons';

// Só aponta para seções que existem. "Unidades" e "Avaliações" saíram da
// landing (o salão é único e as avaliações eram fictícias) — deixar os links
// levava a uma âncora inexistente e a página não rolava.
const ANCHORS = [
  { id: 'about', label: 'Sobre' },
  { id: 'services', label: 'Serviços' },
  { id: 'gallery', label: 'Galeria' },
  { id: 'localizacao', label: 'Onde estamos' },
];

/**
 * Header único do site público.
 *
 * Antes a LandingPage tinha um header próprio e o PublicLayout outro, com
 * links diferentes e sem botão de entrar. Agora existe só este.
 *
 * Navegação por âncora: o React Router v6 não rola a página ao mudar apenas
 * o hash (o pathname não muda, então ele considera que não houve navegação).
 * Por isso o scroll é feito aqui, com base no hash do location.
 */
export function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Fecha o menu a cada navegação
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  const scrollTo = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    },
    []
  );

  /**
   * Se a seção não existe (estamos fora da landing), vai para a home com o
   * hash e deixa o efeito de hash abaixo fazer o scroll.
   */
  const goToSection = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      setMenuOpen(false);

      if (scrollTo(id)) {
        // atualiza a URL sem provocar navegação do router
        window.history.replaceState(null, '', `#${id}`);
        return;
      }

      navigate(`/#${id}`);
    },
    [scrollTo, navigate]
  );

  // Ao chegar em /#secao vindo de outra página, faz o scroll
  useEffect(() => {
    if (location.pathname !== '/' || !location.hash) return;
    const id = location.hash.slice(1);
    if (!id) return;

    // um frame para o React montar a página antes de medir o offset
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.pathname, location.hash]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-brand-white/95 backdrop-blur-md border-b border-brand-gray">
      <Container>
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link
            to="/"
            className="font-display font-bold text-display-sm tracking-tight"
            aria-label="MR. CUT — página inicial"
          >
            MR. CUT
          </Link>

          {/* Desktop */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Navegação principal">
            {ANCHORS.map((a) => (
              <a
                key={a.id}
                href={`/#${a.id}`}
                onClick={(e) => goToSection(e, a.id)}
                className="btn-minimal"
              >
                {a.label}
              </a>
            ))}

            <Link to="/login">
              <Button variant="outline" size="sm">Entrar</Button>
            </Link>
            <Link to="/agendar">
              <Button variant="solid" size="sm">Agendar</Button>
            </Link>
          </nav>

          {/* Mobile */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 -mr-2"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
          >
            {menuOpen ? <CloseIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div id="menu-mobile" className="md:hidden border-t border-brand-gray py-4 animate-fade-in">
            <nav className="flex flex-col" aria-label="Navegação mobile">
              {ANCHORS.map((a) => (
                <a
                  key={a.id}
                  href={`/#${a.id}`}
                  onClick={(e) => goToSection(e, a.id)}
                  className="font-display text-body py-3 border-b border-brand-gray"
                >
                  {a.label}
                </a>
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
  );
}

export default SiteHeader;
