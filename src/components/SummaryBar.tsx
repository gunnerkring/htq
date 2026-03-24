type Props = {
  importedCount: number;
  eligibleCount: number;
  selectedCount: number;
  phaseLabel: string;
  windowLabel: string;
};

export function SummaryBar(props: Props) {
  const cards = [
    {
      label: "Imported",
      value: props.importedCount,
      note: "pilots pulled from workbook",
      className: "summary-card summary-card-primary"
    },
    {
      label: "Under 600",
      value: props.eligibleCount,
      note: "eligible for HTQ selection",
      className: "summary-card summary-card-success"
    },
    {
      label: "Selected",
      value: props.selectedCount,
      note: "actively projected pilots",
      className: "summary-card summary-card-accent"
    },
    {
      label: "Window",
      value: (
        <>
          {props.phaseLabel}
          <br />
          {props.windowLabel}
        </>
      ),
      note: "current forecast span",
      compact: true,
      className: "summary-card summary-card-neutral"
    }
  ];

  return (
    <section className="summary-grid">
      {cards.map((card) => (
        <div key={card.label} className={card.className}>
          <div className="summary-label">{card.label}</div>
          <div className={card.compact ? "summary-value small" : "summary-value"}>{card.value}</div>
          <div className="summary-note">{card.note}</div>
        </div>
      ))}
    </section>
  );
}
