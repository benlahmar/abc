import { Campus } from '../components/home/Campus';
import { Dean } from '../components/home/Dean';
import { Faculty } from '../components/home/Faculty';
import { Hero } from '../components/home/Hero';
import { JoinCta } from '../components/home/JoinCta';
import { KeyFigures } from '../components/home/KeyFigures';
import { News } from '../components/home/News';
import { Programmes } from '../components/home/Programmes';
import { QuickAccess } from '../components/home/QuickAccess';
import { Testimonials } from '../components/home/Testimonials';
import { useDocumentTitle } from '../lib/hooks';

export function HomePage() {
  useDocumentTitle('Faculté des Sciences Ben M’Sik — Université Hassan II de Casablanca');
  return (
    <>
      <Hero />
      <QuickAccess />
      <Programmes />
      <KeyFigures />
      <Campus />
      <News />
      <Dean />
      <Faculty />
      <Testimonials />
      <JoinCta />
    </>
  );
}
