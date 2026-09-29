import { Outlet, Link } from 'react-router-dom';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-2xl font-bold text-blue-600">
              Salão Beleza
            </Link>
            <nav className="flex items-center gap-6">
              <Link to="/agendar" className="text-gray-600 hover:text-gray-900 font-medium">
                Agendar
              </Link>
              <Link to="/login/cliente" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                Entrar
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>&copy; 2025 Salão Beleza. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}