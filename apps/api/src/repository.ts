import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { collections, type CollectionMap, type CollectionName } from '@fsbm/shared';

export class ContentError extends Error {
  constructor(
    message: string,
    readonly collection: CollectionName,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ContentError';
  }
}

export interface ContentRepository {
  get<N extends CollectionName>(name: N): Promise<CollectionMap[N]>;
}

/**
 * Dépôt de contenu basé sur des fichiers JSON (un par collection).
 * Chaque fichier est validé par son schéma Zod et mis en cache tant qu'il n'est pas modifié :
 * une modification sur disque (ou par le futur back-office) est prise en compte sans redémarrage.
 *
 * Pour passer à une base de données, il suffira d'implémenter ContentRepository.
 */
export class JsonFileRepository implements ContentRepository {
  private readonly cache = new Map<CollectionName, { mtimeMs: number; data: unknown }>();

  constructor(private readonly dataDir: string) {}

  async get<N extends CollectionName>(name: N): Promise<CollectionMap[N]> {
    const file = join(this.dataDir, `${name}.json`);
    let mtimeMs: number;
    try {
      ({ mtimeMs } = await stat(file));
    } catch (error) {
      throw new ContentError(`Collection « ${name} » introuvable`, name, error);
    }

    const cached = this.cache.get(name);
    if (cached && cached.mtimeMs === mtimeMs) return cached.data as CollectionMap[N];

    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      throw new ContentError(`Collection « ${name} » : JSON invalide`, name, error);
    }

    const parsed = collections[name].safeParse(raw);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ; ');
      throw new ContentError(`Collection « ${name} » non conforme au schéma — ${details}`, name, parsed.error);
    }

    this.cache.set(name, { mtimeMs, data: parsed.data });
    return parsed.data as CollectionMap[N];
  }
}
