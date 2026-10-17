/** Fait enregistrer un fichier reçu de l'API (les liens directs n'emporteraient pas le jeton). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
