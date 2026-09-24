import { Link } from 'react-router';
import { useCollection } from '../lib/queries';
import { useDocumentTitle } from '../lib/hooks';
import { ContactForm } from '../components/contact/ContactForm';
import { ArrowUpRight, Mail, MapPin, Phone, socialIcons } from '../components/ui/Icons';
import { Reveal } from '../components/ui/Reveal';
import { Accent } from '../components/ui/Section';
import { SmartLink } from '../components/ui/SmartLink';

const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=Facult%C3%A9%20des%20Sciences%20Ben%20M%27Sik%20Casablanca';

export function ContactPage() {
  useDocumentTitle('Contact');
  const { data: site } = useCollection('site');

  return (
    <>
      <section className="on-dark grain relative isolate overflow-hidden bg-midnight-950 pt-44 pb-24 text-paper lg:pt-52 lg:pb-32">
        <img src="/images/facade-fsbm.webp" alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-25 mix-blend-luminosity" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-midnight-950 via-midnight-950/90 to-midnight-950/50" />
        <div className="container-x">
          <nav aria-label="Fil d’Ariane" className="text-[0.75rem] text-paper/55">
            <ol className="flex items-center gap-2">
              <li><Link to="/" className="link-draw hover:text-paper">Accueil</Link></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-paper/80">Contact</li>
            </ol>
          </nav>
          <Reveal>
            <h1 className="display mt-12 max-w-4xl text-[clamp(2.8rem,6vw,5.6rem)] leading-[0.98]">
              Écrivez-nous, <Accent tone="dark">nous vous répondrons</Accent>.
            </h1>
            <p className="mt-8 max-w-xl text-[1.05rem] leading-relaxed text-paper/70">
              Scolarité, formations, recherche ou partenariats : adressez votre question au bon service de la Faculté des Sciences Ben M’Sik.
            </p>
          </Reveal>
        </div>
      </section>

      <section aria-label="Coordonnées et formulaire" className="bg-ivory py-20 lg:py-28">
        <div className="container-x grid gap-14 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-5">
            <figure className="relative">
              <span aria-hidden="true" className="absolute top-4 -right-4 -bottom-4 left-4 border border-gold/60" />
              <img
                src="/images/facade-fsbm.webp"
                alt="Entrée principale de la Faculté des Sciences Ben M’Sik"
                width={516}
                height={387}
                className="relative aspect-[4/3] w-full object-cover"
              />
            </figure>

            <dl className="mt-14 grid gap-8">
              <div className="flex gap-5">
                <MapPin className="mt-1 size-5 shrink-0 text-brand" />
                <div>
                  <dt className="eyebrow text-muted">Adresse</dt>
                  <dd className="mt-2 font-serif text-[1.4rem] leading-snug">
                    {(site?.contact.address ?? ['Faculté des Sciences Ben M’Sik', 'Boulevard Driss El Harti, Ben M’Sik', 'Casablanca, Maroc']).map((line) => (
                      <span key={line} className="block">{line}</span>
                    ))}
                  </dd>
                  <SmartLink href={MAPS_URL} className="group mt-3 inline-flex items-center gap-2 text-[0.8125rem] font-medium">
                    <span className="link-draw">Itinéraire</span>
                    <ArrowUpRight className="size-3.5 text-brand" />
                  </SmartLink>
                </div>
              </div>
              <div className="flex gap-5">
                <Phone className="mt-1 size-5 shrink-0 text-brand" />
                <div>
                  <dt className="eyebrow text-muted">Téléphone</dt>
                  <dd className="mt-2 font-serif text-[1.4rem]">
                    <a href={`tel:${site?.contact.phone ?? '+212661442427'}`} className="link-draw">{site?.contact.phoneDisplay ?? '(+212) 6 61 44 24 27'}</a>
                  </dd>
                </div>
              </div>
              <div className="flex gap-5">
                <Mail className="mt-1 size-5 shrink-0 text-brand" />
                <div>
                  <dt className="eyebrow text-muted">E-mail</dt>
                  <dd className="mt-2 font-serif text-[1.4rem] break-all">
                    <a href={`mailto:${site?.contact.email ?? 'fsbm.contact@univh2c.ma'}`} className="link-draw">{site?.contact.email ?? 'fsbm.contact@univh2c.ma'}</a>
                  </dd>
                </div>
              </div>
            </dl>

            {site && site.socials.length > 0 && (
              <ul className="mt-10 flex gap-2 border-t border-midnight/10 pt-8" aria-label="Réseaux sociaux">
                {site.socials.map((social) => {
                  const Icon = socialIcons[social.network];
                  return (
                    <li key={social.network}>
                      <SmartLink href={social.url} aria-label={social.label} className="grid size-11 place-items-center border border-midnight/15 transition-colors hover:border-midnight hover:bg-midnight hover:text-gold">
                        <Icon className="size-4" />
                      </SmartLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-7">
            <ContactForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
