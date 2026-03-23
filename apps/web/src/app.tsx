import { Routes, Route } from 'react-router';
import { Layout } from './components/layout';
import { HomePage } from './pages/home';
import { CommandsPage } from './pages/commands';
import { CreditsPage } from './pages/credits';
import { TermsPage } from './pages/terms';
import { PrivacyPage } from './pages/privacy';
import { LegalPage } from './pages/legal';

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
    </Routes>
  );
}
