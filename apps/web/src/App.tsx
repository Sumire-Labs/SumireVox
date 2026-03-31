import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router';
import { Layout } from './components/layout';
import { HomePage } from './pages/home';
import { CommandsPage } from './pages/commands';
import { CreditsPage } from './pages/credits';
import { TermsPage } from './pages/terms';
import { PrivacyPage } from './pages/privacy';
import { LegalPage } from './pages/legal';
import { RequireAuth } from './components/require-auth';
import { DashboardLayout } from './components/dashboard-layout';

const DashboardPage = lazy(() =>
  import('./pages/dashboard').then((module) => ({ default: module.DashboardPage }))
);
const BoostPage = lazy(() =>
  import('./pages/dashboard/boost').then((module) => ({ default: module.BoostPage }))
);
const ServersPage = lazy(() =>
  import('./pages/dashboard/servers').then((module) => ({ default: module.ServersPage }))
);
const ServerSettingsPage = lazy(() =>
  import('./pages/dashboard/server-settings').then((module) => ({ default: module.ServerSettingsPage }))
);
const ServerDictionaryPage = lazy(() =>
  import('./pages/dashboard/server-dictionary').then((module) => ({ default: module.ServerDictionaryPage }))
);
const ServerBotsPage = lazy(() =>
  import('./pages/dashboard/server-bots').then((module) => ({ default: module.ServerBotsPage }))
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
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/commands" element={<CommandsPage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/legal" element={<LegalPage />} />
      </Route>
      <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route
          index
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="boost"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <BoostPage />
            </Suspense>
          }
        />
        <Route
          path="servers"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <ServersPage />
            </Suspense>
          }
        />
        <Route
          path="servers/:guildId"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <ServerSettingsPage />
            </Suspense>
          }
        />
        <Route
          path="servers/:guildId/dictionary"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <ServerDictionaryPage />
            </Suspense>
          }
        />
        <Route
          path="servers/:guildId/bots"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <ServerBotsPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
