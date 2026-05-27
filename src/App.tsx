import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { TodayPage } from './pages/TodayPage'
import { CalendarPage } from './pages/CalendarPage'
import { HistoryPage } from './pages/HistoryPage'
import { PlansPage } from './pages/PlansPage'
import { PlanBuilderPage } from './pages/PlanBuilderPage'
import { ProgramImportPage } from './pages/ProgramImportPage'
import { SettingsPage } from './pages/SettingsPage'
import { ErrorBoundary } from './components/shared/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
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
      </Route>
    </Routes>
    </ErrorBoundary>
  )
}
