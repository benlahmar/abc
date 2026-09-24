import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router';
import { Layout } from './components/Layout';
import { RequireAuth, useAuth } from './lib/auth';
import { AuditPage } from './pages/AuditPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ContentEditorPage } from './pages/ContentEditorPage';
import { ContentsPage } from './pages/ContentsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PasswordPage } from './pages/PasswordPage';
import { UsersPage } from './pages/UsersPage';

function AdminOnly() {
  const { me } = useAuth();
  return me.isAdmin ? <Outlet /> : <Navigate to="/" replace />;
}

function PasswordRoute() {
  const { me } = useAuth();
  return me.mustChangePassword ? <PasswordPage /> : <Layout />;
}

const router = createBrowserRouter(
  [
    { path: '/connexion', element: <LoginPage /> },
    {
      element: (
        <RequireAuth>
          <Outlet />
        </RequireAuth>
      ),
      children: [
        { path: '/mot-de-passe', element: <PasswordRoute />, children: [{ index: true, element: <PasswordPage /> }] },
        {
          element: <Layout />,
          children: [
            { index: true, element: <DashboardPage /> },
            { path: 'actualites', element: <ContentsPage /> },
            { path: 'actualites/nouvelle', element: <ContentEditorPage key="new" /> },
            { path: 'actualites/:id', element: <ContentEditorPage /> },
            {
              element: <AdminOnly />,
              children: [
                { path: 'categories', element: <CategoriesPage /> },
                { path: 'utilisateurs', element: <UsersPage /> },
                { path: 'journal', element: <AuditPage /> },
              ],
            },
            { path: '*', element: <Navigate to="/" replace /> },
          ],
        },
      ],
    },
  ],
  { basename: '/admin' },
);

export function App() {
  return <RouterProvider router={router} />;
}
