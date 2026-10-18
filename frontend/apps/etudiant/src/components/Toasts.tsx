import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  contenu: ReactNode;
  erreur?: boolean;
  action?: { texte: string; faire: () => void };
}

interface Options { erreur?: boolean; action?: Toast['action']; duree?: number }
type Afficher = (contenu: ReactNode, options?: Options) => () => void;

const ToastContext = createContext<Afficher>(() => () => {});
export const useToast = () => useContext(ToastContext);

let suivant = 0;

/** Notifications en bas de l'écran ; renvoie de quoi retirer la notification (ex. compte à rebours). */
export function Toasts({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Toast[]>([]);
  const afficher = useCallback<Afficher>((contenu, { erreur, action, duree = 5000 } = {}) => {
    const id = ++suivant;
    const retirer = () => setListe((l) => l.filter((t) => t.id !== id));
    setListe((l) => [...l, { id, contenu, erreur, action }]);
    if (duree) setTimeout(retirer, duree);
    return retirer;
  }, []);
  return (
    <ToastContext.Provider value={afficher}>
      {children}
      <div className="toasts" aria-live="polite">
        {liste.map((t) => (
          <div key={t.id} className={`toast${t.erreur ? ' toast-erreur' : ''}`} role={t.erreur ? 'alert' : 'status'}>
            <span>{t.contenu}</span>
            {t.action && <button type="button" className="lien" onClick={() => { t.action!.faire(); setListe((l) => l.filter((x) => x.id !== t.id)); }}>{t.action.texte}</button>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
