/** Animated Entity hex mark — DBD title-screen motif */
export function EntityMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`entity-mark entity-mark-${size}`} aria-hidden>
      <div className="entity-mark-ring entity-mark-ring-outer" />
      <div className="entity-mark-ring entity-mark-ring-inner" />
      <div className="entity-mark-core" />
    </div>
  );
}
