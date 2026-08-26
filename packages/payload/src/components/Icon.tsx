/**
 * The compact mark, used wherever the admin has room for a glyph and not a
 * wordmark. Same tile as `Logo`, same theme variables.
 * SOT-KEYWORDS: payload admin icon brand graphics mark moyo
 */
export function Icon() {
  return (
    <span aria-label="Moyo" className="moyo-lockup__tile moyo-lockup__tile--solo">
      <span aria-hidden>M</span>
    </span>
  );
}
