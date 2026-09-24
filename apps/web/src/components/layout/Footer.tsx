import { footerNav } from '../../lib/navigation';
import { useCollection } from '../../lib/queries';
import { MapPin, Mail, Phone, socialIcons } from '../ui/Icons';
import { SmartLink } from '../ui/SmartLink';
import { Brand } from './Brand';

export function Footer() {
  const { data: site } = useCollection('site');
  const year = new Date().getFullYear();

  return (
    <footer className="on-dark relative overflow-hidden bg-midnight-950 text-paper" aria-labelledby="footer-title">
      <h2 id="footer-title" className="sr-only">Pied de page</h2>
      <div className="container-x relative">
        <div className="grid gap-14 border-b border-paper/10 py-20 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Brand tone="dark" size="lg" />
            <p className="mt-8 max-w-sm text-[0.95rem] leading-relaxed text-paper/60">
              {site ? `${site.name}. ${site.tagline}` : 'Faculté des Sciences Ben M’Sik. Offrant une éducation de qualité et des opportunités de recherche innovantes.'}
            </p>
            {site && site.socials.length > 0 && (
              <ul className="mt-8 flex gap-2" aria-label="Réseaux sociaux">
                {site.socials.map((social) => {
                  const Icon = socialIcons[social.network];
                  return (
                    <li key={social.network}>
                      <SmartLink
                        href={social.url}
                        aria-label={social.label}
                        className="grid size-10 place-items-center border border-paper/15 text-paper/70 transition-colors duration-300 hover:border-gold hover:text-gold"
                      >
                        <Icon className="size-4" />
                      </SmartLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <nav aria-label="Pied de page" className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-8">
            {(
              [
                ['Liens rapides', footerNav.quick],
                ['Ressources', footerNav.resources],
              ] as const
            ).map(([title, links]) => (
              <div key={title}>
                <h3 className="eyebrow text-gold">{title}</h3>
                <ul className="mt-6 space-y-3.5 text-[0.9rem] text-paper/65">
                  {links.map((link) => (
                    <li key={link.href}>
                      <SmartLink href={link.href} className="link-draw transition-colors hover:text-paper">
                        {link.label}
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-1">
              <h3 className="eyebrow text-gold">Contact</h3>
              <address className="mt-6 flex gap-3 text-[0.9rem] leading-relaxed text-paper/65 not-italic">
                <MapPin className="mt-1 size-4 shrink-0 text-gold" />
                <span>
                  {(site?.contact.address ?? ['Faculté des Sciences Ben M’Sik', 'Boulevard Driss El Harti, Ben M’Sik', 'Casablanca, Maroc']).map((line) => (
                    <span key={line} className="block">{line}</span>
                  ))}
                </span>
              </address>
              <ul className="mt-5 space-y-3 text-[0.9rem] text-paper/65">
                <li>
                  <a className="flex items-center gap-3 hover:text-paper" href={`tel:${site?.contact.phone ?? '+212661442427'}`}>
                    <Phone className="size-4 text-gold" /> {site?.contact.phoneDisplay ?? '(+212) 6 61 44 24 27'}
                  </a>
                </li>
                <li>
                  <a className="flex items-center gap-3 break-all hover:text-paper" href={`mailto:${site?.contact.email ?? 'fsbm.contact@univh2c.ma'}`}>
                    <Mail className="size-4 shrink-0 text-gold" /> {site?.contact.email ?? 'fsbm.contact@univh2c.ma'}
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="flex flex-col gap-4 py-8 text-[0.75rem] text-paper/45 md:flex-row md:items-center md:justify-between">
          <p>© {year} FSBM — Portail Campus. Tous droits réservés.</p>
          <ul className="flex flex-wrap gap-x-7 gap-y-2">
            {footerNav.legal.map((link) => (
              <li key={link.href}>
                <SmartLink href={link.href} className="link-draw hover:text-paper">{link.label}</SmartLink>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Grand monogramme */}
      <p
        aria-hidden="true"
        className="pointer-events-none -mb-[0.2em] text-center font-serif text-[31vw] leading-[0.8] tracking-[-0.04em] text-transparent select-none [-webkit-text-stroke:1px_rgb(197_160_89/0.22)]"
      >
        FSBM
      </p>
    </footer>
  );
}
