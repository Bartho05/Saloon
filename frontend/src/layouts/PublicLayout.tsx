import { Outlet } from 'react-router-dom';
import { SiteHeader } from '@components/SiteHeader';
import { Container } from '@components/ui';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-brand-white flex flex-col">
      <SiteHeader />

      {/* Compensa o header fixo (h-16 no mobile, h-20 no desktop) */}
      <main className="flex-1 pt-16 md:pt-20">
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
