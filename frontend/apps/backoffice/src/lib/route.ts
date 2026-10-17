import { useCallback, useEffect, useState } from 'react';

/** Routage minimal : chemin + paramètres d'URL, navigation sans rechargement (historique du navigateur). */
export function useRoute() {
  const [location, setLocation] = useState(() => ({ path: window.location.pathname, search: window.location.search }));
  useEffect(() => {
    const onPop = () => setLocation({ path: window.location.pathname, search: window.location.search });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((to: string, replace = false) => {
    if (replace) history.replaceState(null, '', to); else history.pushState(null, '', to);
    setLocation({ path: window.location.pathname, search: window.location.search });
  }, []);
  return { path: location.path, params: new URLSearchParams(location.search), navigate };
}
