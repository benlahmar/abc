import { eq, inArray } from 'drizzle-orm';
import type { CategoryRole } from '@fsbm/shared';
import type { Db } from './db/index.js';
import { categories, categoryMembers, users } from './db/schema.js';
import { hashPassword } from './admin/security.js';

/** Comptes de démonstration (développement uniquement) couvrant les trois circuits. */
export const demoAccounts: Array<{ email: string; name: string; isAdmin?: boolean; roles: Array<[string, CategoryRole]> }> = [
  { email: 'admin@fsbm.test', name: 'Administrateur du portail', isAdmin: true, roles: [] },
  { email: 'redaction.recherche@fsbm.test', name: 'Rédaction Recherche', roles: [['recherche', 'redacteur'], ['institutionnel', 'redacteur']] },
  { email: 'communication@fsbm.test', name: 'Service Communication', roles: [['recherche', 'verificateur'], ['institutionnel', 'verificateur']] },
  { email: 'vicedoyen.recherche@fsbm.test', name: 'Vice-doyen Recherche', roles: [['recherche', 'validateur']] },
  { email: 'scolarite@fsbm.test', name: 'Agent Scolarité', roles: [['scolarite', 'redacteur']] },
  { email: 'chef.scolarite@fsbm.test', name: 'Chef du service Scolarité', roles: [['scolarite', 'validateur']] },
  { email: 'doyen@fsbm.test', name: 'Doyen', roles: [['institutionnel', 'validateur']] },
];

export async function seedDemo(db: Db, password: string) {
  const passwordHash = await hashPassword(password);
  const cats = await db.select().from(categories);
  const catId = (slug: string) => cats.find((c) => c.slug === slug)?.id;
  for (const account of demoAccounts) {
    let [user] = await db.select().from(users).where(eq(users.email, account.email));
    if (!user) {
      [user] = await db.insert(users).values({ email: account.email, name: account.name, isAdmin: account.isAdmin ?? false, passwordHash }).returning();
    }
    for (const [slug, role] of account.roles) {
      const categoryId = catId(slug);
      if (categoryId) await db.insert(categoryMembers).values({ categoryId, userId: user!.id, role }).onConflictDoNothing();
    }
  }
  await db
    .update(categories)
    .set({ active: true, urgentAllowed: false })
    .where(inArray(categories.slug, ['recherche', 'scolarite', 'institutionnel']));
  await db.update(categories).set({ urgentAllowed: true }).where(eq(categories.slug, 'scolarite'));
}
