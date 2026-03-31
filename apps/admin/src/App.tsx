import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router';
import { RequireAuth } from './components/require-auth';
import { AdminLayout } from './components/admin-layout';

const OverviewPage = lazy(() =>
  import('./pages/overview').then((module) => ({ default: module.OverviewPage }))
);
const AdminServersPage = lazy(() =>
  import('./pages/servers').then((module) => ({ default: module.AdminServersPage }))
);
const AdminServerSettingsPage = lazy(() =>
  import('./pages/server-settings').then((module) => ({ default: module.AdminServerSettingsPage }))
);
const AdminDictionaryPage = lazy(() =>
  import('./pages/dictionary').then((module) => ({ default: module.AdminDictionaryPage }))
);
const AdminRequestsPage = lazy(() =>
  import('./pages/requests').then((module) => ({ default: module.AdminRequestsPage }))
);
const BotInstancesPage = lazy(() =>
  import('./pages/bot-instances').then((module) => ({ default: module.BotInstancesPage }))
);

function RouteLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '40vh',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span>読み込み中...</span>
    </div>
  );
}

export function App() {
  return (
    <RequireAuth>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/servers" element={<AdminServersPage />} />
            <Route path="/servers/:guildId" element={<AdminServerSettingsPage />} />
            <Route path="/dictionary" element={<AdminDictionaryPage />} />
            <Route path="/requests" element={<AdminRequestsPage />} />
            <Route path="/bot-instances" element={<BotInstancesPage />} />
          </Route>
        </Routes>
      </Suspense>
    </RequireAuth>
  );
}
