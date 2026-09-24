import { ButtonLink } from '../ui/Button';
import { Reveal } from '../ui/Reveal';

/** Appel à l'action final : photo du campus sous un voile bleu FSBM. */
export function JoinCta() {
  return (
    <section aria-labelledby="cta-title" className="on-dark relative isolate overflow-hidden bg-brand text-paper">
      <img
        src="/images/amphi-portes-ouvertes.webp"
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-10 size-full object-cover opacity-30 mix-blend-luminosity"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-brand via-brand/90 to-brand/40" />
      <div className="container-x grid gap-12 py-24 lg:grid-cols-12 lg:items-end lg:py-32">
        <Reveal className="lg:col-span-8">
          <p className="eyebrow flex items-center gap-4 text-paper/75">
            <span aria-hidden="true" className="h-px w-10 bg-gold" />
            Rejoindre la FSBM
          </p>
          <h2 id="cta-title" className="display mt-7 text-[clamp(2.7rem,5.8vw,5.6rem)] leading-[0.96]">
            Prêt à rejoindre notre <em className="font-medium italic">communauté campus</em>&nbsp;?
          </h2>
          <p className="mt-7 max-w-xl text-[1.02rem] leading-relaxed text-paper/80">
            Étudiant potentiel, membre du corps professoral ou partenaire : connectez-vous avec nous et découvrez les opportunités de notre campus.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="flex flex-col gap-4 sm:flex-row lg:col-span-4 lg:flex-col lg:items-end">
          <ButtonLink href="/contact" variant="light" className="sm:min-w-64">
            Contactez-nous
          </ButtonLink>
          <ButtonLink href="/accueil/mot-du-doyen" variant="outline-light" className="sm:min-w-64">
            En savoir plus
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}
