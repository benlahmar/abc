import { createBrowserRouter, RouterProvider } from 'react-router';
import { Layout } from './components/layout/Layout';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { HomePage } from './pages/HomePage';
import { NewsDetailPage } from './pages/NewsDetailPage';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      // handle.darkHero : la page commence par une zone sombre, l'en-tête y est transparent.
      { index: true, element: <HomePage />, handle: { darkHero: true } },
      { path: 'actualites/:id', element: <NewsDetailPage />, handle: { darkHero: true } },
      { path: '*', element: <ComingSoonPage />, handle: { darkHero: true } },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
