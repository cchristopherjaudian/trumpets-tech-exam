/**
 * Maximum widget text length in UTF-16 code units.
 * Matches how `String.length`, zod's `.max()` and the HTML `maxlength` attribute count,
 * so the client and server enforce exactly the same limit.
 */
export const MAX_TEXT_LENGTH = 50_000;
