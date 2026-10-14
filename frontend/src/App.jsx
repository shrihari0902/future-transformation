import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NetworkProvider } from './context/NetworkContext';
import { DeviceProvider } from './context/DeviceContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoadingSpinner } from './components/UIComponents';

// Pages
import { Login } from './pages/Login';
import { CustomerDashboard } from './pages/CustomerDashboard';
import { WalletReserve } from './pages/WalletReserve';
import { DeviceRegistration } from './pages/DeviceRegistration';
import { Pay } from './pages/Pay';
import { ReceivePayment } from './pages/ReceivePayment';
import { TransactionHistory } from './pages/TransactionHistory';
import { OfflineSyncQueue } from './pages/OfflineSyncQueue';
import { TransactionDetails } from './pages/TransactionDetails';
import { RaiseDispute } from './pages/RaiseDispute';
import { AnalystDashboard } from './pages/AnalystDashboard';
import { SuspiciousQueue } from './pages/SuspiciousQueue';
import { DisputeManagement } from './pages/DisputeManagement';
import { NotFound } from './pages/NotFound';

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export function App() {
  useEffect(() => {
    // Register service worker if available in browser
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration skipped:', err);
      });
    }
  }, []);

  return (
    <BrowserRouter>
      <NetworkProvider>
        <AuthProvider>
          <DeviceProvider>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<Login />} />

              {/* Protected Authenticated Routes */}
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<CustomerDashboard />} />
                <Route path="/wallet" element={<WalletReserve />} />
                <Route path="/device" element={<DeviceRegistration />} />
                <Route path="/history" element={<TransactionHistory />} />
                <Route path="/sync-queue" element={<OfflineSyncQueue />} />
                <Route path="/transaction/:id" element={<TransactionDetails />} />
                <Route path="/disputes" element={<RaiseDispute />} />
                <Route path="/dispute/:id" element={<RaiseDispute />} />

                {/* Customer-only: Pay */}
                <Route
                  path="/pay"
                  element={
                    <RoleRoute allowedRoles={['customer']}>
                      <Pay />
                    </RoleRoute>
                  }
                />

                {/* Merchant-only: Receive */}
                <Route
                  path="/receive"
                  element={
                    <RoleRoute allowedRoles={['merchant']}>
                      <ReceivePayment />
                    </RoleRoute>
                  }
                />

                {/* Analyst-only: Dashboard, Flags, Dispute Decisions */}
                <Route
                  path="/analyst"
                  element={
                    <RoleRoute allowedRoles={['analyst']}>
                      <AnalystDashboard />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/analyst/flags"
                  element={
                    <RoleRoute allowedRoles={['analyst']}>
                      <SuspiciousQueue />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/analyst/disputes"
                  element={
                    <RoleRoute allowedRoles={['analyst']}>
                      <DisputeManagement />
                    </RoleRoute>
                  }
                />

                {/* 404 Not Found inside layout */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </DeviceProvider>
        </AuthProvider>
      </NetworkProvider>
    </BrowserRouter>
  );
}

export default App;
