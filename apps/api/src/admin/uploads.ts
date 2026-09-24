import { randomUUID } from 'node:crypto';
import { mkdir, open, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import express, { Router } from 'express';
import multer from 'multer';
import { eq } from 'drizzle-orm';
import type { UploadResult } from '@fsbm/shared';
import type { Db } from '../db/index.js';
import { categoryMembers } from '../db/schema.js';
import { HttpError } from '../errors.js';
import { audit, requestIp } from './audit.js';
import { currentUser } from './auth.js';

const MAX_SIZE = 15 * 1024 * 1024;

/** Types acceptés, vérifiés par leur signature binaire (et non par l'extension déclarée). */
const types: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  'application/pdf': { ext: '.pdf', magic: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  'image/jpeg': { ext: '.jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: '.png', magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { ext: '.webp', magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
};

export function uploadsRouter(db: Db, uploadsDir: string) {
  const router = Router();
  const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const now = new Date();
      const dir = join(uploadsDir, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
      try {
        await mkdir(dir, { recursive: true });
        cb(null, dir);
      } catch (error) {
        cb(error as Error, dir);
      }
    },
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${types[file.mimetype]?.ext ?? extname(file.originalname)}`),
  });
  const upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE, files: 1 },
    fileFilter: (_req, file, cb) => cb(null, file.mimetype in types),
  });

  router.post('/uploads', async (req, _res, next) => {
    const me = currentUser(req);
    if (!me.isAdmin) {
      const [membership] = await db.select().from(categoryMembers).where(eq(categoryMembers.userId, me.id)).limit(1);
      if (!membership) throw new HttpError(403, 'forbidden', 'Aucun rôle ne vous autorise à téléverser des fichiers.');
    }
    next();
  });

  router.post('/uploads', (req, res, next) => {
    upload.single('file')(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'payload_too_large', 'Fichier trop volumineux (15 Mo maximum).'));
      next(error);
    });
  });

  router.post('/uploads', async (req, res) => {
    const me = currentUser(req);
    const file = req.file;
    if (!file) throw new HttpError(422, 'invalid_body', 'Fichier manquant ou type non autorisé (PDF, JPEG, PNG ou WebP).');
    const handle = await open(file.path, 'r');
    const head = Buffer.alloc(16);
    await handle.read(head, 0, 16, 0);
    await handle.close();
    if (!types[file.mimetype]?.magic(head)) {
      await unlink(file.path).catch(() => {});
      throw new HttpError(422, 'invalid_body', 'Le contenu du fichier ne correspond pas à son type.');
    }
    const relative = file.path.slice(uploadsDir.length).split('\\').join('/');
    const result: UploadResult = { url: `/uploads${relative}`, name: file.originalname.slice(0, 200), size: file.size, type: file.mimetype };
    await audit(db, { userId: me.id, action: 'upload.created', entityType: 'upload', entityId: result.url, summary: `Fichier téléversé : ${result.name}`, ip: requestIp(req) });
    res.status(201).json(result);
  });

  return router;
}

/** Service des fichiers téléversés : jamais interprétés (nosniff), sans exécution possible. */
export const serveUploads = (uploadsDir: string) =>
  express.static(uploadsDir, {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
      res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  });
