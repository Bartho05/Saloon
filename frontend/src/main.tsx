import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@contexts/AuthContext';
import { ToastProvider } from '@contexts/ToastContext';
import { SalonProvider } from '@contexts/SalonContext';
import { ErrorBoundary } from '@components/ErrorBoundary';
import App from './App';
import '@styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary label="root">
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {/* Fora do AuthProvider de propósito: a marca é pública e a landing
            precisa do nome antes de qualquer login. */}
        <SalonProvider>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </SalonProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
