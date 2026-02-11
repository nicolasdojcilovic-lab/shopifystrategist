/**
 * Utilitaires pour l'extraction propre des codes d'erreur sans cast sauvage.
 *
 * Référence: docs/ARCHITECTURE_MAP.md — Action 1 (P2)
 */

/**
 * Extrait le code d'erreur d'un objet `unknown` (catch).
 *
 * Certaines bibliothèques (Supabase, Playwright) attachent un `code` à l'erreur
 * sans le typer correctement. Cette fonction effectue une vérification de type
 * sûre plutôt qu'un cast `as unknown as { code?: string }`.
 *
 * @param err - Erreur capturée (unknown)
 * @returns Le code d'erreur ou undefined
 *
 * @example
 * try {
 *   await supabase.storage.upload(...);
 * } catch (error: unknown) {
 *   const code = getErrorCode(error);
 *   return { success: false, error: { message: String(error), ...(code ? { code } : {}) } };
 * }
 */
export function getErrorCode(err: unknown): string | undefined {
  if (err === null || err === undefined) return undefined;
  const obj = err as Record<string, unknown>;
  if (typeof obj !== 'object') return undefined;
  const code = obj.code;
  return typeof code === 'string' ? code : undefined;
}
