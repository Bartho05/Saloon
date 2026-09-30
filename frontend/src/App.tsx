import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@components/ProtectedRoute';
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
import { OwnerSettingsPage } from '@pages/Owner/SettingsPage';
import { EmployeeSchedulePage } from '@pages/Employee/SchedulePage';
import { EmployeeAppointmentsPage } from '@pages/Employee/AppointmentsPage';
import { EmployeeProfilePage } from '@pages/Employee/ProfilePage';

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
        <Route path="perfil" element={<EmployeeProfilePage />} />
        <Route index element={<Navigate to="agenda" replace />} />
      </Route>

      {/* Redirects */}
      <Route path="/login/cliente" element={<Navigate to="/login" replace />} />
      <Route path="/agendamento-confirmado" element={<div className="min-h-screen flex items-center justify-center p-4"><div className="text-center"><div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div><h1 className="text-2xl font-bold text-gray-900 mb-2">Agendamento Confirmado!</h1><p className="text-gray-600 mb-6">Você receberá a confirmação via WhatsApp em instantes.</p><a href="/" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 inline-block">Voltar ao Início</a></div></div>} />
      
      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;