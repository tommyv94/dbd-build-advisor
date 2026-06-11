/** Persistent title-screen fog, vignette, and grain across the app shell */
export function FogAtmosphere() {
  return (
    <div className="fog-atmosphere" aria-hidden>
      <div className="fog-atmosphere-void" />
      <div className="fog-atmosphere-red fog-atmosphere-red-a" />
      <div className="fog-atmosphere-red fog-atmosphere-red-b" />
      <div className="fog-atmosphere-mist" />
      <div className="fog-atmosphere-scratches" />
      <div className="fog-atmosphere-vignette" />
      <div className="fog-atmosphere-grain" />
    </div>
  );
}
