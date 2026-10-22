import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/auth/AuthGate'
import { AppShell } from './components/layout/AppShell'
import { TodayPage } from './pages/TodayPage'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { lazyPage } from './lib/lazyPage'

// Today is the landing page and stays in the main bundle; the rest load on
// first visit (and are precached by the service worker for offline use).
const CalendarPage = lazyPage(() => import('./pages/CalendarPage'), 'CalendarPage')
const HistoryPage = lazyPage(() => import('./pages/HistoryPage'), 'HistoryPage')
const PlansPage = lazyPage(() => import('./pages/PlansPage'), 'PlansPage')
const PlanBuilderPage = lazyPage(() => import('./pages/PlanBuilderPage'), 'PlanBuilderPage')
const ProgramImportPage = lazyPage(() => import('./pages/ProgramImportPage'), 'ProgramImportPage')
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage')
const MobilityPage = lazyPage(() => import('./pages/MobilityPage'), 'MobilityPage')

export default function App() {
  return (
    <ErrorBoundary>
    <AuthGate>
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="plans/new" element={<PlanBuilderPage />} />
        <Route path="plans/:id/edit" element={<PlanBuilderPage />} />
        <Route path="plans/import" element={<ProgramImportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="mobility" element={<MobilityPage />} />
      </Route>
    </Routes>
    </AuthGate>
    </ErrorBoundary>
  )
}
