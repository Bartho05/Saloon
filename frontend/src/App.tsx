import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { ProtectedRoute } from '@components/ProtectedRoute';
import { Button } from '@components/ui';
import { PublicLayout } from '@layouts/PublicLayout';
import { DashboardLayout } from '@layouts/DashboardLayout';
import { LandingPage } from '@pages/Public/LandingPage';
import { AgendarPage } from '@pages/Public/AgendarPage';
import { LoginPage } from '@pages/Public/LoginPage';
import { ClientAppointmentsPage } from '@pages/Public/ClientAppointmentsPage';
import { OwnerDashboardPage } from '@pages/Owner/DashboardPage';
import { OwnerServicesPage } from '@pages/Owner/ServicesPage';
import { OwnerEmployeesPage } from '@pages/Owner/EmployeesPage';
import { OwnerSchedulePage } from '@pages/Owner/SchedulePage';
import { OwnerFinancialPage } from '@pages/Owner/FinancialPage';
import { OwnerSettingsPage } from '@pages/Owner/SettingsPage';
import { EmployeeSchedulePage } from '@pages/Employee/SchedulePage';
import { EmployeeAppointmentsPage } from '@pages/Employee/AppointmentsPage';
import { EmployeeFinancialPage } from '@pages/Employee/FinancialPage';
import { EmployeeProfilePage } from '@pages/Employee/ProfilePage';

function BookingConfirmedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-brand-grayLight">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-8 bg-brand-black text-brand-white flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m5 13 4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-display-md mb-3">Agendamento confirmado</h1>
        <p className="text-body-lg text-brand-grayMid mb-10">
          Você receberá a confirmação e um lembrete no WhatsApp do número cadastrado.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/meus-agendamentos">
            <Button className="w-full sm:w-auto">Meus agendamentos</Button>
          </Link>
          <Link to="/">
            <Button variant="outline" className="w-full sm:w-auto">Voltar ao início</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/agendar" element={<AgendarPage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Client protected routes */}
        <Route element={<ProtectedRoute allowedRoles={['CLIENT']} />}>
          <Route path="/meus-agendamentos" element={<ClientAppointmentsPage />} />
        </Route>
      </Route>

      {/* Owner Routes */}
      <Route 
        path="/owner/*" 
        element={
          <ProtectedRoute allowedRoles={['OWNER']}>
            <DashboardLayout variant="owner" />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<OwnerDashboardPage />} />
        <Route path="servicos" element={<OwnerServicesPage />} />
        <Route path="funcionarios" element={<OwnerEmployeesPage />} />
        <Route path="agenda" element={<OwnerSchedulePage />} />
        <Route path="financeiro" element={<OwnerFinancialPage />} />
        <Route path="configuracoes" element={<OwnerSettingsPage />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Employee Routes */}
      <Route 
        path="/funcionario/*" 
        element={
          <ProtectedRoute allowedRoles={['EMPLOYEE']}>
            <DashboardLayout variant="employee" />
          </ProtectedRoute>
        }
      >
        <Route path="agenda" element={<EmployeeSchedulePage />} />
        <Route path="agendamentos" element={<EmployeeAppointmentsPage />} />
        <Route path="financeiro" element={<EmployeeFinancialPage />} />
        <Route path="perfil" element={<EmployeeProfilePage />} />
        <Route index element={<Navigate to="agenda" replace />} />
      </Route>

      {/* Redirects */}
      <Route path="/login/cliente" element={<Navigate to="/login" replace />} />
      <Route path="/agendamento-confirmado" element={<BookingConfirmedPage />} />
      
      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;