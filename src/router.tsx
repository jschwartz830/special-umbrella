import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { TodayPage } from './pages/TodayPage'
import { CalendarPage } from './pages/CalendarPage'
import { HistoryPage } from './pages/HistoryPage'
import { PlansPage } from './pages/PlansPage'
import { PlanBuilderPage } from './pages/PlanBuilderPage'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/today" replace /> },
        { path: 'today', element: <TodayPage /> },
        { path: 'calendar', element: <CalendarPage /> },
        { path: 'history', element: <HistoryPage /> },
        { path: 'plans', element: <PlansPage /> },
        { path: 'plans/new', element: <PlanBuilderPage /> },
        { path: 'plans/:id/edit', element: <PlanBuilderPage /> },
      ],
    },
  ],
  { basename: '/special-umbrella' },
)
