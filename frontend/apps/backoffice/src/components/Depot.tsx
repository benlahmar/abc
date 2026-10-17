import { useRef, useState, type DragEvent } from 'react';
import { Button } from '@esign/ui';
import { ACCEPTED_EXTENSIONS, checkImportFile } from '../lib/imports';

interface Props {
  file?: File;
  /** Fichier accepté (contrôlé : format et taille) ; undefined si refusé. */
  onFile: (file: File | undefined) => void;
  /** Invitation affichée tant qu'aucun fichier n'est choisi. */
  invitation: string;
  error?: string;
  onError: (message: string | undefined) => void;
}

/** Zone de dépôt d'un fichier CSV ou Excel (glisser-déposer ou parcourir). */
export function Depot({ file, onFile, invitation, error, onError }: Props) {
  const [survol, setSurvol] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const choisir = (f?: File) => {
    if (!f) return;
    const err = checkImportFile(f);
    onError(err);
    onFile(err ? undefined : f);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setSurvol(false); choisir(e.dataTransfer.files[0]); };
  return (
    <>
      <div className={`depot${survol ? ' survol' : ''}${file ? ' rempli' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setSurvol(true); }} onDragLeave={() => setSurvol(false)} onDrop={onDrop}>
        {file ? (
          <>
            <strong className="depot-nom">{file.name}</strong>
            <span className="sous num">{(file.size / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ko</span>
            <Button variant="quiet" onClick={() => input.current?.click()}>Choisir un autre fichier</Button>
          </>
        ) : (
          <>
            <strong>{invitation}</strong>
            <span className="sous">CSV ou Excel (.xlsx, .xls), 20 Mo au plus</span>
            <Button onClick={() => input.current?.click()}>Parcourir…</Button>
          </>
        )}
        <input ref={input} type="file" hidden accept={ACCEPTED_EXTENSIONS.join(',')} onChange={(e) => { choisir(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {error && <p className="champ-erreur" role="alert">{error}</p>}
    </>
  );
}
