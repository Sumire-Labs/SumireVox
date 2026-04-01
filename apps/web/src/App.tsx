import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router';
import { Layout } from './components/layout';
import { RequireAuth } from './components/require-auth';
import { DashboardLayout } from './components/dashboard-layout';

const HomePage = lazy(() =>
  import('./pages/home').then((module) => ({ default: module.HomePage }))
);
const CommandsPage = lazy(() =>
  import('./pages/commands').then((module) => ({ default: module.CommandsPage }))
);
const CreditsPage = lazy(() =>
  import('./pages/credits').then((module) => ({ default: module.CreditsPage }))
);
const TermsPage = lazy(() =>
  import('./pages/terms').then((module) => ({ default: module.TermsPage }))
);
const PrivacyPage = lazy(() =>
  import('./pages/privacy').then((module) => ({ default: module.PrivacyPage }))
);
const LegalPage = lazy(() =>
  import('./pages/legal').then((module) => ({ default: module.LegalPage }))
);

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
        <Route
          path="/"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <HomePage />
            </Suspense>
          }
        />
        <Route
          path="/commands"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <CommandsPage />
            </Suspense>
          }
        />
        <Route
          path="/credits"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <CreditsPage />
            </Suspense>
          }
        />
        <Route
          path="/terms"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <TermsPage />
            </Suspense>
          }
        />
        <Route
          path="/privacy"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <PrivacyPage />
            </Suspense>
          }
        />
        <Route
          path="/legal"
          element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LegalPage />
            </Suspense>
          }
        />
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
