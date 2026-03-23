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
import { DashboardPage } from './pages/dashboard';
import { BoostPage } from './pages/dashboard/boost';
import { ServersPage } from './pages/dashboard/servers';
import { ServerSettingsPage } from './pages/dashboard/server-settings';
import { ServerDictionaryPage } from './pages/dashboard/server-dictionary';

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
        <Route index element={<DashboardPage />} />
        <Route path="boost" element={<BoostPage />} />
        <Route path="servers" element={<ServersPage />} />
        <Route path="servers/:guildId" element={<ServerSettingsPage />} />
        <Route path="servers/:guildId/dictionary" element={<ServerDictionaryPage />} />
      </Route>
    </Routes>
  );
}
