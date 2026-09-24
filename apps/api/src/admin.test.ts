import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { runScheduledTransitions } from './admin/contents.js';
import { contents } from './db/schema.js';
import { createTestApp, loginAs } from './testing.js';

type TestApp = Awaited<ReturnType<typeof createTestApp>>;
let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const categoryId = async (client: Awaited<ReturnType<typeof loginAs>>, slug: string) =>
  ((await client.get('/categories')).body as Array<{ id: string; slug: string }>).find((c) => c.slug === slug)!.id;

const draft = (categoryId: string, over: Record<string, unknown> = {}) => ({
  categoryId,
  title: 'Soutenance de thèse en physique des matériaux',
  excerpt: 'Soutenance publique au grand amphithéâtre.',
  body: ['Premier paragraphe.', 'Second paragraphe.'],
  attachments: [{ label: 'Programme', url: '/uploads/programme.pdf' }],
  publishAt: inHours(-1),
  expireAt: null,
  ...over,
});

describe('Authentification', () => {
  it('refuse les identifiants invalides avec un message générique', async () => {
    const res = await request(t.app).post('/api/admin/auth/login').set('x-fsbm-csrf', '1').send({ email: 'doyen@fsbm.test', password: 'mauvais' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/Identifiants invalides/);
  });

  it('exige l’en-tête anti-CSRF sur les requêtes d’écriture', async () => {
    const res = await request(t.app).post('/api/admin/auth/login').send({ email: 'doyen@fsbm.test', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('csrf');
  });

  it('refuse une origine étrangère', async () => {
    const res = await request(t.app)
      .post('/api/admin/auth/login')
      .set('x-fsbm-csrf', '1')
      .set('Origin', 'https://evil.example')
      .send({ email: 'doyen@fsbm.test', password: 'x' });
    expect(res.status).toBe(403);
  });

  it('exige une session pour les routes protégées', async () => {
    expect((await request(t.app).get('/api/admin/dashboard')).status).toBe(401);
  });

  it('pose un cookie de session HttpOnly et SameSite=Strict, et renvoie les rôles', async () => {
    const res = await request(t.app).post('/api/admin/auth/login').set('x-fsbm-csrf', '1').send({ email: 'communication@fsbm.test', password: 'Demo-FSBM-2026' });
    expect(res.status).toBe(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(res.body.memberships.map((m: { role: string }) => m.role)).toEqual(['verificateur', 'verificateur']);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('verrouille le compte après 5 échecs, même avec le bon mot de passe ensuite', async () => {
    const admin = await loginAs(t.app, 'admin@fsbm.test');
    await admin.post('/users', { name: 'Compte Test', email: 'verrou@fsbm.test', password: 'Provisoire-2026' });
    for (let i = 0; i < 5; i++) {
      await request(t.app).post('/api/admin/auth/login').set('x-fsbm-csrf', '1').send({ email: 'verrou@fsbm.test', password: 'faux' });
    }
    const res = await request(t.app).post('/api/admin/auth/login').set('x-fsbm-csrf', '1').send({ email: 'verrou@fsbm.test', password: 'Provisoire-2026' });
    expect(res.status).toBe(401);
  });

  it('impose le changement du mot de passe provisoire avant tout accès', async () => {
    const admin = await loginAs(t.app, 'admin@fsbm.test');
    await admin.post('/users', { name: 'Nouvelle Rédactrice', email: 'nouvelle@fsbm.test', password: 'Provisoire-2026' });
    const user = await loginAs(t.app, 'nouvelle@fsbm.test', 'Provisoire-2026');
    expect((await user.get('/dashboard')).status).toBe(403);
    const weak = await user.post('/auth/password', { currentPassword: 'Provisoire-2026', newPassword: 'court' });
    expect(weak.status).toBe(422);
    const ok = await user.post('/auth/password', { currentPassword: 'Provisoire-2026', newPassword: 'Definitif-2026-FSBM' });
    expect(ok.status).toBe(200);
    expect((await user.get('/dashboard')).status).toBe(200);
  });

  it('réserve la gestion des comptes aux administrateurs', async () => {
    const redac = await loginAs(t.app, 'redaction.recherche@fsbm.test');
    expect((await redac.get('/users')).status).toBe(403);
    expect((await redac.get('/audit')).status).toBe(403);
  });
});

describe('Circuit Recherche : rédaction → vérification → validation → publication programmée', () => {
  it('déroule le circuit complet et publie à l’heure prévue', async () => {
    const redac = await loginAs(t.app, 'redaction.recherche@fsbm.test');
    const verif = await loginAs(t.app, 'communication@fsbm.test');
    const vd = await loginAs(t.app, 'vicedoyen.recherche@fsbm.test');
    const cat = await categoryId(redac, 'recherche');

    const created = await redac.post('/contents', draft(cat, { title: 'Colloque international sur les nanomatériaux', publishAt: inHours(48) }));
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('draft');
    expect(created.body.permissions.actions).toEqual(['submit', 'trash']);
    const id = created.body.id;

    // Le validateur ne peut rien faire tant que le contenu n'est pas passé par la vérification.
    const early = await vd.post(`/contents/${id}/transitions`, { action: 'validate', version: 1 });
    expect(early.status).toBe(403);

    const submitted = await redac.post(`/contents/${id}/transitions`, { action: 'submit', version: 1 });
    expect(submitted.body.status).toBe('in_review');

    // Le vérificateur peut corriger la forme pendant la relecture.
    const fixed = await verif.patch(`/contents/${id}`, { version: 2, data: draft(cat, { title: 'Colloque international sur les nanomatériaux (FSBM)', publishAt: inHours(48) }) });
    expect(fixed.status).toBe(200);

    const reviewed = await verif.post(`/contents/${id}/transitions`, { action: 'approve_review', version: 3 });
    expect(reviewed.body.status).toBe('in_validation');
    expect(reviewed.body.reviewer.name).toBe('Service Communication');

    const validated = await vd.post(`/contents/${id}/transitions`, { action: 'validate', version: 4 });
    expect(validated.body.status).toBe('scheduled');
    expect(validated.body.validator.name).toBe('Vice-doyen Recherche');

    // Programmé : invisible sur le site tant que l'heure n'est pas venue.
    const slug = validated.body.slug;
    expect((await request(t.app).get(`/api/v1/news/${slug}`)).status).toBe(404);

    // Le temps passe : l'heure de publication est atteinte, le planificateur publie.
    await t.db.update(contents).set({ publishAt: new Date(Date.now() - 1000) }).where(eq(contents.id, id));
    await runScheduledTransitions(t.db);
    const live = await request(t.app).get(`/api/v1/news/${slug}`);
    expect(live.status).toBe(200);
    expect(live.body.item.title).toBe('Colloque international sur les nanomatériaux (FSBM)');
    expect(live.body.category.label).toBe('Recherche');

    const history = (await redac.get(`/contents/${id}`)).body.comments.map((c: { action: string }) => c.action);
    expect(history).toEqual(['submit', 'approve_review', 'validate']);
  });

  it('exige un commentaire pour renvoyer, puis permet la correction et la resoumission', async () => {
    const redac = await loginAs(t.app, 'redaction.recherche@fsbm.test');
    const verif = await loginAs(t.app, 'communication@fsbm.test');
    const cat = await categoryId(redac, 'recherche');
    const { body } = await redac.post('/contents', draft(cat, { title: 'Appel à communications 2027' }));
    await redac.post(`/contents/${body.id}/transitions`, { action: 'submit', version: 1 });

    const noComment = await verif.post(`/contents/${body.id}/transitions`, { action: 'return', version: 2 });
    expect(noComment.status).toBe(422);
    const returned = await verif.post(`/contents/${body.id}/transitions`, { action: 'return', version: 2, comment: 'Merci d’ajouter la date limite.' });
    expect(returned.body.status).toBe('changes_requested');

    const dash = (await redac.get('/dashboard')).body;
    expect(dash.pending.map((c: { id: string }) => c.id)).toContain(body.id);

    const edited = await redac.patch(`/contents/${body.id}`, { version: 3, data: draft(cat, { title: 'Appel à communications 2027 — date limite le 15 mars' }) });
    expect(edited.status).toBe(200);
    const resubmitted = await redac.post(`/contents/${body.id}/transitions`, { action: 'submit', version: 4 });
    expect(resubmitted.body.status).toBe('in_review');
  });

  it('rejette une modification concurrente (verrouillage optimiste)', async () => {
    const redac = await loginAs(t.app, 'redaction.recherche@fsbm.test');
    const cat = await categoryId(redac, 'recherche');
    const { body } = await redac.post('/contents', draft(cat, { title: 'Contenu modifié deux fois' }));
    await redac.patch(`/contents/${body.id}`, { version: 1, data: draft(cat, { title: 'Première modification' }) });
    const stale = await redac.patch(`/contents/${body.id}`, { version: 1, data: draft(cat, { title: 'Seconde modification' }) });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('stale');
  });

  it('interdit au vérificateur de valider et au rédacteur de vérifier', async () => {
    const redac = await loginAs(t.app, 'redaction.recherche@fsbm.test');
    const verif = await loginAs(t.app, 'communication@fsbm.test');
    const cat = await categoryId(redac, 'recherche');
    const { body } = await redac.post('/contents', draft(cat, { title: 'Règle des quatre yeux' }));
    await redac.post(`/contents/${body.id}/transitions`, { action: 'submit', version: 1 });
    expect((await redac.post(`/contents/${body.id}/transitions`, { action: 'approve_review', version: 2 })).status).toBe(403);
    await verif.post(`/contents/${body.id}/transitions`, { action: 'approve_review', version: 2 });
    expect((await verif.post(`/contents/${body.id}/transitions`, { action: 'validate', version: 3 })).status).toBe(403);
  });
});

describe('Circuit Scolarité (sans vérification) et visibilité par catégorie', () => {
  it('passe directement en validation et publie immédiatement si la date est passée', async () => {
    const agent = await loginAs(t.app, 'scolarite@fsbm.test');
    const chef = await loginAs(t.app, 'chef.scolarite@fsbm.test');
    const cat = await categoryId(agent, 'scolarite');
    const { body } = await agent.post('/contents', draft(cat, { title: 'Liste des admis en Master Chimie 2026-2028' }));
    const submitted = await agent.post(`/contents/${body.id}/transitions`, { action: 'submit', version: 1 });
    expect(submitted.body.status).toBe('in_validation');
    const validated = await chef.post(`/contents/${body.id}/transitions`, { action: 'validate', version: 2 });
    expect(validated.body.status).toBe('published');
    const page = await request(t.app).get('/api/v1/news?category=scolarite');
    expect(page.body.items[0].title).toBe('Liste des admis en Master Chimie 2026-2028');
  });

  it('ne montre à un utilisateur que les contenus de ses catégories', async () => {
    const redac = await loginAs(t.app, 'redaction.recherche@fsbm.test');
    const agent = await loginAs(t.app, 'scolarite@fsbm.test');
    const cat = await categoryId(redac, 'recherche');
    const { body } = await redac.post('/contents', draft(cat, { title: 'Contenu réservé à la recherche' }));
    expect((await agent.get(`/contents/${body.id}`)).status).toBe(404);
    const list = (await agent.get('/contents')).body as Array<{ category: { slug: string } }>;
    expect(list.every((c) => c.category.slug === 'scolarite')).toBe(true);
    // Et un rédacteur ne peut pas créer dans une catégorie qui n'est pas la sienne.
    expect((await agent.post('/contents', draft(cat))).status).toBe(403);
  });
});

describe('Révision d’un contenu publié', () => {
  it('garde l’original en ligne puis le remplace à la validation de la révision', async () => {
    const agent = await loginAs(t.app, 'scolarite@fsbm.test');
    const chef = await loginAs(t.app, 'chef.scolarite@fsbm.test');
    const cat = await categoryId(agent, 'scolarite');
    const { body: original } = await agent.post('/contents', draft(cat, { title: 'Emploi du temps S1 (version 1)' }));
    await agent.post(`/contents/${original.id}/transitions`, { action: 'submit', version: 1 });
    await chef.post(`/contents/${original.id}/transitions`, { action: 'validate', version: 2 });

    const revision = await agent.post(`/contents/${original.id}/revision`);
    expect(revision.status).toBe(201);
    expect(revision.body.revisionOf).toBe(original.id);
    expect((await agent.post(`/contents/${original.id}/revision`)).status).toBe(409);

    await agent.patch(`/contents/${revision.body.id}`, { version: 1, data: draft(cat, { title: 'Emploi du temps S1 (version 2)' }) });
    const slug = (await agent.get(`/contents/${original.id}`)).body.slug;
    expect((await request(t.app).get(`/api/v1/news/${slug}`)).body.item.title).toBe('Emploi du temps S1 (version 1)');

    await agent.post(`/contents/${revision.body.id}/transitions`, { action: 'submit', version: 2 });
    const merged = await chef.post(`/contents/${revision.body.id}/transitions`, { action: 'validate', version: 3 });
    expect(merged.body.id).toBe(original.id);
    expect((await request(t.app).get(`/api/v1/news/${slug}`)).body.item.title).toBe('Emploi du temps S1 (version 2)');
    expect((await agent.get(`/contents/${revision.body.id}`)).status).toBe(404);
  });
});

describe('Retrait, archivage, expiration et corbeille', () => {
  it('retire en urgence avec justification et archive automatiquement à expiration', async () => {
    const agent = await loginAs(t.app, 'scolarite@fsbm.test');
    const chef = await loginAs(t.app, 'chef.scolarite@fsbm.test');
    const cat = await categoryId(agent, 'scolarite');
    const { body } = await agent.post('/contents', draft(cat, { title: 'Report des examens', expireAt: inHours(2) }));
    await agent.post(`/contents/${body.id}/transitions`, { action: 'submit', version: 1 });
    await chef.post(`/contents/${body.id}/transitions`, { action: 'validate', version: 2 });

    await runScheduledTransitions(t.db, new Date(Date.now() + 3 * 3600_000));
    expect((await agent.get(`/contents/${body.id}`)).body.status).toBe('archived');

    const { body: other } = await agent.post('/contents', draft(cat, { title: 'Annonce publiée par erreur' }));
    await agent.post(`/contents/${other.id}/transitions`, { action: 'submit', version: 1 });
    await chef.post(`/contents/${other.id}/transitions`, { action: 'validate', version: 2 });
    expect((await chef.post(`/contents/${other.id}/transitions`, { action: 'withdraw', version: 3 })).status).toBe(422);
    const withdrawn = await chef.post(`/contents/${other.id}/transitions`, { action: 'withdraw', version: 3, comment: 'Publiée par erreur' });
    expect(withdrawn.body.status).toBe('withdrawn');
    expect((await request(t.app).get(`/api/v1/news/${withdrawn.body.slug}`)).status).toBe(404);
  });

  it('corbeille : l’auteur y met son brouillon, seul l’administrateur restaure ou supprime', async () => {
    const redac = await loginAs(t.app, 'redaction.recherche@fsbm.test');
    const admin = await loginAs(t.app, 'admin@fsbm.test');
    const cat = await categoryId(redac, 'recherche');
    const { body } = await redac.post('/contents', draft(cat, { title: 'Brouillon abandonné' }));
    const trashed = await redac.post(`/contents/${body.id}/transitions`, { action: 'trash', version: 1 });
    expect(trashed.body.trashed).toBe(true);
    expect((await redac.post(`/contents/${body.id}/restore`)).status).toBe(403);
    expect((await admin.post(`/contents/${body.id}/restore`)).status).toBe(200);
    const again = await redac.post(`/contents/${body.id}/transitions`, { action: 'trash', version: 3 });
    expect((await admin.del(`/contents/${again.body.id}`)).status).toBe(204);
  });
});

describe('Catégories', () => {
  it('refuse d’activer une catégorie sans validateur', async () => {
    const admin = await loginAs(t.app, 'admin@fsbm.test');
    const created = await admin.post('/categories', { name: 'Coopération', slug: 'cooperation', requiresReview: true });
    expect(created.status).toBe(201);
    expect(created.body.issues).toContain('Aucun validateur');
    const activate = await admin.patch(`/categories/${created.body.id}`, { active: true });
    expect(activate.status).toBe(422);
  });

  it('refuse de retirer le dernier validateur d’une catégorie active', async () => {
    const admin = await loginAs(t.app, 'admin@fsbm.test');
    const cats = (await admin.get('/categories')).body as Array<{ id: string; slug: string; members: Array<{ userId: string; role: string }> }>;
    const scolarite = cats.find((c) => c.slug === 'scolarite')!;
    const validator = scolarite.members.find((m) => m.role === 'validateur')!;
    const res = await admin.del(`/categories/${scolarite.id}/members/${validator.userId}/validateur`);
    expect(res.status).toBe(409);
  });

  it('refuse un identifiant déjà utilisé', async () => {
    const admin = await loginAs(t.app, 'admin@fsbm.test');
    expect((await admin.post('/categories', { name: 'Recherche bis', slug: 'recherche' })).status).toBe(409);
  });
});

describe('Téléversement et journal', () => {
  it('accepte un vrai PDF et refuse un faux', async () => {
    const redac = await loginAs(t.app, 'redaction.recherche@fsbm.test');
    const ok = await redac.agent
      .post('/api/admin/uploads')
      .set('x-fsbm-csrf', '1')
      .attach('file', Buffer.from('%PDF-1.4\n%fin'), { filename: 'liste.pdf', contentType: 'application/pdf' });
    expect(ok.status).toBe(201);
    expect(ok.body.url).toMatch(/^\/uploads\/\d{4}\/\d{2}\/[0-9a-f-]+\.pdf$/);
    const served = await request(t.app).get(ok.body.url);
    expect(served.status).toBe(200);
    expect(served.headers['x-content-type-options']).toBe('nosniff');

    const fake = await redac.agent
      .post('/api/admin/uploads')
      .set('x-fsbm-csrf', '1')
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'piege.pdf', contentType: 'application/pdf' });
    expect(fake.status).toBe(422);
    const html = await redac.agent
      .post('/api/admin/uploads')
      .set('x-fsbm-csrf', '1')
      .attach('file', Buffer.from('<html></html>'), { filename: 'page.html', contentType: 'text/html' });
    expect(html.status).toBe(422);
  });

  it('trace les actions dans le journal d’audit', async () => {
    const admin = await loginAs(t.app, 'admin@fsbm.test');
    const log = (await admin.get('/audit?limit=500')).body as Array<{ action: string }>;
    const actions = new Set(log.map((e) => e.action));
    for (const a of ['auth.login', 'auth.failed', 'auth.locked', 'content.created', 'content.submit', 'content.validate', 'content.published_auto', 'content.withdraw', 'content.purged']) {
      expect(actions, a).toContain(a);
    }
  });
});
