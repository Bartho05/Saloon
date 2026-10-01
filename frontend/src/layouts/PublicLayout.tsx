import { Outlet } from 'react-router-dom';
import { SiteHeader } from '@components/SiteHeader';
import { Container } from '@components/ui';
import { SalonBrand } from '@components/SalonBrand';
import { DevCredits } from '@components/DevCredits';
import { useSalonName } from '@contexts/SalonContext';

export function PublicLayout() {
  const { name } = useSalonName();

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
            <p>
              <SalonBrand size="sm" />
            </p>
            {name && (
              <p className="text-caption text-brand-grayMid">
                &copy; {new Date().getFullYear()} {name}. Todos os direitos reservados.
              </p>
            )}
          </div>
          <DevCredits className="mt-4" />
        </Container>
      </footer>
    </div>
  );
}

export default PublicLayout;
