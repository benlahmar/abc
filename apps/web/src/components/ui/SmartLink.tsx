import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { isInternalUrl, safeUrl } from '@fsbm/shared';

interface SmartLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactNode;
}

/** Lien interne (router) ou externe (nouvel onglet), avec filtrage des URL dangereuses. */
export function SmartLink({ href, children, ...rest }: SmartLinkProps) {
  const url = safeUrl(href);
  if (isInternalUrl(url)) {
    return (
      <Link to={url} {...rest}>
        {children}
      </Link>
    );
  }
  const external = /^https?:/.test(url);
  return (
    <a href={url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
      {children}
      {external && <span className="sr-only"> (nouvel onglet)</span>}
    </a>
  );
}
