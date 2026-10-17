import { useId, useMemo, useState, type ClipboardEvent, type FormEvent } from 'react';
import { ApiError, DOCUMENT_LABELS, type CreateDocumentRequest, type DocumentType } from '@esign/api';
import { Button, Field } from '@esign/ui';
import { emptyGrade, looksLikeTable, parseNote, parsePastedGrades, toGradeLines, weightedAverage, type GradeDraft } from '../lib/grades';

export interface DocumentFormValues {
  type: DocumentType;
  cne: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  lieuNaissance: string;
  filiere: string;
  niveau: string;
  academicYear: string;
  semester: string;
  purpose: string;
  grades: GradeDraft[];
}

const SEMESTRES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];
export const USAGES: Record<string, string> = {
  '': 'Non précisé', ETRANGER: 'Dossier pour l\'étranger', INSCRIPTION: 'Inscription ailleurs', STAGE: 'Stage ou emploi', BOURSE: 'Bourse',
};

export function currentAcademicYear(d = new Date()) {
  const start = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export const emptyValues = (): DocumentFormValues => ({
  type: 'ATTESTATION_SCOLARITE', cne: '', nom: '', prenom: '', dateNaissance: '', lieuNaissance: '', filiere: '',
  niveau: '', academicYear: currentAcademicYear(), semester: 'S1', purpose: '', grades: [emptyGrade()],
});

function toRequest(v: DocumentFormValues): CreateDocumentRequest {
  const releve = v.type === 'RELEVE_NOTES';
  return {
    type: v.type,
    student: {
      cne: v.cne.trim(), nom: v.nom.trim(), prenom: v.prenom.trim(), filiere: v.filiere.trim(), niveau: v.niveau.trim(),
      dateNaissance: v.dateNaissance || undefined, lieuNaissance: v.lieuNaissance.trim() || undefined,
    },
    academicYear: v.academicYear.trim(),
    semester: releve ? v.semester : undefined,
    grades: releve ? toGradeLines(v.grades) : undefined,
    purpose: v.purpose || undefined,
  };
}

/** Contrôles avant envoi ; l'API refait toutes les validations. */
function check(v: DocumentFormValues): Record<string, string> {
  const e: Record<string, string> = {};
  const requis: [keyof DocumentFormValues, string][] = [['cne', 'student.cne'], ['nom', 'student.nom'], ['prenom', 'student.prenom'],
    ['filiere', 'student.filiere'], ['niveau', 'student.niveau']];
  requis.forEach(([k, f]) => { if (!String(v[k]).trim()) e[f] = 'Obligatoire'; });
  if (!/^\d{4}-\d{4}$/.test(v.academicYear.trim())) e.academicYear = 'Format attendu : 2025-2026';
  if (v.type === 'RELEVE_NOTES') {
    const lignes = v.grades.filter((g) => g.code || g.intitule || g.note);
    if (!lignes.length) e.grades = 'Saisissez au moins un module';
    v.grades.forEach((g, i) => {
      if (!(g.code || g.intitule || g.note)) return;
      const n = parseNote(g.note);
      if (!g.code.trim()) e[`grades[${i}].code`] = 'Code ?';
      if (!g.intitule.trim()) e[`grades[${i}].intitule`] = 'Intitulé ?';
      if (n === null || n > 20) e[`grades[${i}].note`] = 'Note de 0 à 20';
    });
  }
  return e;
}

interface Props {
  initial: DocumentFormValues;
  /** Champs imposés par la demande de l'étudiant (non modifiables). */
  locked?: (keyof DocumentFormValues)[];
  submitLabel: string;
  onSubmit: (request: CreateDocumentRequest) => Promise<unknown>;
  onCancel: () => void;
}

export function DocumentForm({ initial, locked = [], submitLabel, onSubmit, onCancel }: Props) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const id = useId();
  const releve = v.type === 'RELEVE_NOTES';
  const moyenne = useMemo(() => weightedAverage(v.grades), [v.grades]);
  const is = (k: keyof DocumentFormValues) => locked.includes(k);
  const set = <K extends keyof DocumentFormValues>(k: K, value: DocumentFormValues[K]) => setV((x) => ({ ...x, [k]: value }));
  const setGrade = (i: number, k: keyof GradeDraft, value: string) =>
    setV((x) => ({ ...x, grades: x.grades.map((g, j) => (j === i ? { ...g, [k]: value } : g)) }));

  /** Collage d'un tableau Excel dans une cellule de note : remplit les lignes à partir de celle-ci. */
  const onPasteGrades = (i: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (!looksLikeTable(text)) return;
    e.preventDefault();
    const rows = parsePastedGrades(text);
    setV((x) => {
      const grades = [...x.grades];
      grades.splice(i, Math.max(0, grades.length - i), ...rows);
      return { ...x, grades: grades.length ? grades : [emptyGrade()] };
    });
    setMessage({ text: `${rows.length} ligne${rows.length > 1 ? 's' : ''} collée${rows.length > 1 ? 's' : ''} depuis le presse-papiers : vérifiez-les avant d'établir.`, error: false });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(undefined);
    const found = check(v);
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage({ text: 'Corrigez les champs signalés.', error: true });
      return;
    }
    setBusy(true);
    try {
      await onSubmit(toRequest(v));
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.message])));
        setMessage({ text: err.message, error: true });
      } else {
        setMessage({ text: err instanceof Error ? err.message : String(err), error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const err = (f: string) => errors[f];
  const input = (k: keyof DocumentFormValues, label: string, field: string, props: Record<string, unknown> = {}) => (
    <Field label={label} error={err(field)}>
      <input value={String(v[k])} readOnly={is(k)} aria-invalid={!!err(field)}
        onChange={(e) => set(k, e.target.value as never)} {...props} />
    </Field>
  );

  return (
    <form className="formulaire" onSubmit={submit} noValidate aria-describedby={message ? `${id}-msg` : undefined}>
      {!is('type') && (
        <fieldset className="choix">
          <legend>Document</legend>
          {(Object.keys(DOCUMENT_LABELS) as DocumentType[]).map((t) => (
            <label key={t}><input type="radio" name="type" checked={v.type === t} onChange={() => set('type', t)} />{DOCUMENT_LABELS[t]}</label>
          ))}
        </fieldset>
      )}

      <fieldset>
        <legend>Étudiant</legend>
        <div className="grille-2">
          {input('cne', 'CNE', 'student.cne', { autoFocus: !is('cne'), autoComplete: 'off' })}
          {input('niveau', 'Niveau', 'student.niveau', { placeholder: 'Licence 3' })}
          {input('nom', 'Nom', 'student.nom', { autoFocus: is('cne') })}
          {input('prenom', 'Prénom', 'student.prenom')}
          {input('dateNaissance', 'Date de naissance', 'student.dateNaissance', { type: 'date' })}
          {input('lieuNaissance', 'Lieu de naissance', 'student.lieuNaissance')}
        </div>
        {input('filiere', 'Filière', 'student.filiere', { placeholder: 'Sciences Mathématiques et Informatique' })}
      </fieldset>

      <fieldset>
        <legend>Période et usage</legend>
        <div className="grille-3">
          {input('academicYear', 'Année universitaire', 'academicYear', { placeholder: '2025-2026' })}
          {releve && (
            <Field label="Semestre" error={err('semester')}>
              <select value={v.semester} disabled={is('semester')} onChange={(e) => set('semester', e.target.value)}>
                {SEMESTRES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          )}
          <Field label="Usage">
            <select value={v.purpose} disabled={is('purpose')} onChange={(e) => set('purpose', e.target.value)}>
              {Object.entries(USAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
      </fieldset>

      {releve && (
        <fieldset>
          <legend>Notes du semestre</legend>
          <p className="champ-aide">Astuce : copiez les lignes dans Excel (code, module, note, crédits, résultat) et collez-les dans un champ « Code ».</p>
          <table className="notes">
            <thead>
              <tr><th scope="col">Code</th><th scope="col">Module</th><th scope="col">Note /20</th><th scope="col">Crédits</th><th scope="col">Résultat</th><th><span className="sr">Retirer</span></th></tr>
            </thead>
            <tbody>
              {v.grades.map((g, i) => (
                <tr key={i}>
                  <td><input aria-label={`Code du module ${i + 1}`} value={g.code} onChange={(e) => setGrade(i, 'code', e.target.value)} onPaste={onPasteGrades(i)} aria-invalid={!!err(`grades[${i}].code`)} /></td>
                  <td><input aria-label={`Intitulé du module ${i + 1}`} value={g.intitule} onChange={(e) => setGrade(i, 'intitule', e.target.value)} aria-invalid={!!err(`grades[${i}].intitule`)} /></td>
                  <td><input aria-label={`Note du module ${i + 1}`} className="num" inputMode="decimal" value={g.note} onChange={(e) => setGrade(i, 'note', e.target.value)} aria-invalid={!!err(`grades[${i}].note`)} /></td>
                  <td><input aria-label={`Crédits du module ${i + 1}`} className="num" inputMode="numeric" value={g.credits} onChange={(e) => setGrade(i, 'credits', e.target.value)} /></td>
                  <td><input aria-label={`Résultat du module ${i + 1}`} value={g.resultat} placeholder="auto" onChange={(e) => setGrade(i, 'resultat', e.target.value)} /></td>
                  <td>
                    <Button variant="quiet" aria-label={`Retirer le module ${i + 1}`} disabled={v.grades.length === 1}
                      onClick={() => setV((x) => ({ ...x, grades: x.grades.filter((_, j) => j !== i) }))}>Retirer</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="notes-pied">
            <Button onClick={() => setV((x) => ({ ...x, grades: [...x.grades, emptyGrade()] }))}>Ajouter un module</Button>
            <span className="num">Moyenne pondérée : <strong>{moyenne === null ? 'à calculer' : moyenne.toFixed(2)}</strong></span>
          </div>
          {err('grades') && <p className="champ-erreur">{err('grades')}</p>}
        </fieldset>
      )}

      {message && <p id={`${id}-msg`} className={`formulaire-message${message.error ? ' erreur' : ''}`} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
      <div className="formulaire-actions">
        <Button type="submit" variant="sign" busy={busy}>{submitLabel}</Button>
        <Button onClick={onCancel} disabled={busy}>Annuler</Button>
      </div>
    </form>
  );
}
