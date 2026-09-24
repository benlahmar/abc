import { motion, useReducedMotion } from 'motion/react';
import { useCollection } from '../../lib/queries';
import { ButtonLink } from '../ui/Button';
import { Constellation } from '../ui/Constellation';
import { MaskLine } from '../ui/Reveal';
import { Accent } from '../ui/Section';
import { Announcements } from './Announcements';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const reduced = useReducedMotion();
  const { data: hero } = useCollection('hero');
  const fade = (delay: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.1, ease: EASE, delay } };

  return (
    <section aria-labelledby="hero-title" className="on-dark grain relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-midnight-950 text-paper">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {hero?.image && (
          <motion.img
            src={hero.image}
            alt=""
            fetchPriority="high"
            decoding="async"
            initial={reduced ? false : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 0.55, scale: 1 }}
            transition={{ duration: 2.2, ease: EASE }}
            className="absolute inset-0 size-full object-cover mix-blend-luminosity"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-midnight-950 via-midnight-950/85 to-midnight-950/35" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_78%_32%,rgb(29_51_84/0.55),transparent_70%)]" />
        <div className="absolute -right-48 -bottom-80 size-[52rem] rounded-full bg-gold/[0.13] blur-[150px]" />
        <div className="absolute -top-40 -left-40 size-[34rem] rounded-full bg-midnight-700/60 blur-[120px]" />
        <Constellation className="absolute inset-0 size-full opacity-70" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-midnight-950 via-midnight-950/70 to-transparent" />
      </div>

      <div className="container-x flex flex-1 flex-col pt-36 pb-10 sm:pt-44 xl:pt-48">
        <div className="grid flex-1 items-end gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <motion.p {...fade(0.05)} className="eyebrow flex items-center gap-4 text-paper/65">
              <span aria-hidden="true" className="h-px w-10 bg-gold" />
              Université Hassan II de Casablanca
            </motion.p>

            <h1 id="hero-title" className="display mt-7 text-[clamp(3rem,6.1vw,6.6rem)] leading-[0.94]">
              <MaskLine delay={0.15}>L’excellence</MaskLine>
              <MaskLine delay={0.27}>
                scientifique, <Accent tone="dark">au cœur</Accent>
              </MaskLine>
              <MaskLine delay={0.39}>de Casablanca.</MaskLine>
            </h1>

            <motion.p {...fade(0.6)} className="mt-8 max-w-[35rem] text-[1.0625rem] leading-[1.75] text-paper/70">
              La Faculté des Sciences Ben M’Sik forme chaque année des milliers d’étudiants, portée par une vision d’excellence,
              d’innovation et de responsabilité sociale.
            </motion.p>

            <motion.div {...fade(0.75)} className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <ButtonLink href="/formation" variant="gold">
                Découvrir nos formations
              </ButtonLink>
              <ButtonLink href="/pre-candidature" variant="outline-light">
                Pré-candidature en ligne
              </ButtonLink>
            </motion.div>
          </div>

          <motion.div {...fade(0.9)} className="lg:col-span-5 xl:col-span-4 xl:col-start-9">
            <Announcements />
          </motion.div>
        </div>

        <motion.div
          {...fade(1.1)}
          className="mt-14 flex items-center justify-between gap-6 border-t border-paper/10 pt-6 text-[0.625rem] font-semibold tracking-eyebrow text-paper/45 uppercase"
        >
          <a href="#acces-rapide" className="group flex items-center gap-4 transition-colors hover:text-paper">
            <span aria-hidden="true" className="relative h-9 w-px overflow-hidden bg-paper/15">
              <span className="absolute inset-0 animate-scroll-cue bg-gold" />
            </span>
            Découvrir la faculté
          </a>
          <p className="hidden md:block" aria-hidden="true">
            33°33′N · 7°34′W — Ben M’Sik, Casablanca
          </p>
          <p className="hidden sm:block">Depuis la Licence jusqu’au Doctorat</p>
        </motion.div>
      </div>
    </section>
  );
}
