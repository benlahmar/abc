import { ButtonLink } from '../ui/Button';
import { Reveal } from '../ui/Reveal';

/** Appel à l'action final, sur fond or. */
export function JoinCta() {
  return (
    <section aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-gold text-midnight-950">
      <svg aria-hidden="true" className="absolute inset-0 -z-10 size-full opacity-[0.14]" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1200 600">
        <g fill="none" stroke="#050E1C" strokeWidth="0.8">
          <circle cx="1020" cy="300" r="120" />
          <circle cx="1020" cy="300" r="220" />
          <circle cx="1020" cy="300" r="330" />
          <circle cx="1020" cy="300" r="450" strokeDasharray="2 8" />
          <path d="M0 520 C 300 440, 520 600, 820 470 S 1120 380, 1200 420" />
        </g>
        <g fill="#050E1C">
          <circle cx="1020" cy="180" r="4" />
          <circle cx="800" cy="300" r="3" />
          <circle cx="1120" cy="520" r="3" />
        </g>
      </svg>
      <div className="container-x grid gap-12 py-24 lg:grid-cols-12 lg:items-end lg:py-32">
        <Reveal className="lg:col-span-8">
          <p className="eyebrow flex items-center gap-4 text-midnight-950/70">
            <span aria-hidden="true" className="h-px w-10 bg-midnight-950/60" />
            Rejoindre la FSBM
          </p>
          <h2 id="cta-title" className="display mt-7 text-[clamp(2.7rem,5.8vw,5.6rem)] leading-[0.96]">
            Prêt à rejoindre notre <em className="italic">communauté campus</em>&nbsp;?
          </h2>
          <p className="mt-7 max-w-xl text-[1.02rem] leading-relaxed text-midnight-950/75">
            Étudiant potentiel, membre du corps professoral ou partenaire : connectez-vous avec nous et découvrez les opportunités de notre campus.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="flex flex-col gap-4 sm:flex-row lg:col-span-4 lg:flex-col lg:items-end">
          <ButtonLink href="/contact" variant="dark" className="sm:min-w-64">
            Contactez-nous
          </ButtonLink>
          <ButtonLink href="/accueil/mot-du-doyen" variant="outline-dark" className="border-midnight-950/40 sm:min-w-64">
            En savoir plus
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}
