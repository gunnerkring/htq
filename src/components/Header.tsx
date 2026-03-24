export function Header() {
  return (
    <header className="topbar">
      <div className="topbar-copy">
        <p className="eyebrow">SHARP Forecast Console</p>
        <h1>Hours to Qualify</h1>
        <p>
          Import the SHARP workbook, tune pilot-specific assumptions, and compare HTQ and sortie
          output in one desktop workflow.
        </p>
      </div>
      <div className="topbar-badges">
        <div className="topbar-badge">Workbook parity</div>
        <div className="topbar-badge muted">Electron desktop</div>
      </div>
    </header>
  );
}
