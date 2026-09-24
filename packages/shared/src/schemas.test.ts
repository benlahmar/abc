import { describe, expect, it } from 'vitest';
import { ContactMessageSchema } from './schemas.js';

describe('ContactMessageSchema', () => {
  it('renvoie des messages d’erreur en français', () => {
    const result = ContactMessageSchema.safeParse({ name: '', email: 'x', subject: '', message: 'court' });
    expect(result.success).toBe(false);
    const messages = Object.fromEntries(result.error!.issues.map((i) => [String(i.path[0]), i.message]));
    expect(messages).toEqual({
      name: 'Indiquez votre nom',
      email: 'Adresse e-mail invalide',
      subject: 'Choisissez l’objet de votre message',
      message: 'Votre message est trop court (10 caractères minimum)',
    });
  });

  it('accepte un message valide sans téléphone', () => {
    const result = ContactMessageSchema.safeParse({ name: 'Amina', email: 'a@b.ma', subject: 'autre', message: 'Bonjour à toute l’équipe.' });
    expect(result.success).toBe(true);
  });
});
