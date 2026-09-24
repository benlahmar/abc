import { useLocation } from 'react-router';
import { ButtonLink } from '../components/ui/Button';
import { Constellation } from '../components/ui/Constellation';
import { useDocumentTitle } from '../lib/hooks';

/** Pages non encore réalisées (et 404) : message sobre, retour à l'accueil. */
export function ComingSoonPage({ title = 'Page en préparation', message }: { title?: string; message?: string }) {
  const { pathname } = useLocation();
  useDocumentTitle(title);
  return (
    <section className="on-dark grain relative isolate flex min-h-[80svh] items-center overflow-hidden bg-midnight-950 pt-40 pb-24 text-paper">
      <Constellation className="absolute inset-0 -z-10 size-full opacity-60" />
      <div className="container-x">
        <p className="eyebrow flex items-center gap-4 text-gold">
          <span aria-hidden="true" className="h-px w-10 bg-gold" />
          <span className="font-mono tracking-normal normal-case">{pathname}</span>
        </p>
        <h1 className="display mt-8 max-w-4xl text-[clamp(2.8rem,6vw,5.5rem)] leading-[0.98]">{title}</h1>
        <p className="mt-7 max-w-xl text-[1.05rem] leading-relaxed text-paper/65">
          {message ?? 'Cette rubrique du nouveau portail de la FSBM est en cours de réalisation. Elle sera disponible très prochainement.'}
        </p>
        <div className="mt-11">
          <ButtonLink href="/" variant="gold">
            Retour à l’accueil
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
