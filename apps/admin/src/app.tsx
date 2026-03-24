import { Routes, Route } from 'react-router';
import { RequireAuth } from './components/require-auth';
import { AdminLayout } from './components/admin-layout';
import { OverviewPage } from './pages/overview';
import { AdminServersPage } from './pages/servers';
import { AdminDictionaryPage } from './pages/dictionary';
import { AdminRequestsPage } from './pages/requests';
import { BotInstancesPage } from './pages/bot-instances';

export function App() {
  return (
    <RequireAuth>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/servers" element={<AdminServersPage />} />
          <Route path="/dictionary" element={<AdminDictionaryPage />} />
          <Route path="/requests" element={<AdminRequestsPage />} />
          <Route path="/bot-instances" element={<BotInstancesPage />} />
        </Route>
      </Routes>
    </RequireAuth>
  );
}
