/**
 * Per-widget save lifecycle:
 * - `saved`: the stored text matches what the user sees
 * - `pending`: there are local edits that have not been sent yet
 * - `saving`: a save request is in flight
 * - `error`: the last save failed; the edits are kept for a retry
 */
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';
