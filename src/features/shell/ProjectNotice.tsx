type ProjectNoticeProps = {
  onClose: () => void;
};

const commitments = [
  {
    number: "01",
    title: "No monetization",
    description: "No payments, subscriptions, advertising, donations, sponsorships, affiliate compensation, fundraising, or investors.",
  },
  {
    number: "02",
    title: "No commercial services",
    description: "No paid consulting, custom development, support contracts, API access, or data sales. Equity Lab does not solicit customers or clients.",
  },
  {
    number: "03",
    title: "No financial services",
    description: "No accounts, customer funds, brokerage services, trade execution, or investment advisory services.",
  },
  {
    number: "04",
    title: "Personal open-source work",
    description: "No employees or contractors. The project is developed using personal time and resources, and its source code is publicly available.",
  },
] as const;

export function ProjectNotice({ onClose }: ProjectNoticeProps) {
  return <div className="modal-backdrop project-notice-backdrop" onMouseDown={onClose}>
    <section
      className="project-notice"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-notice-title"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="project-notice__header">
        <div>
          <span className="eyebrow">Project status</span>
          <h2 id="project-notice-title">Personal, non-commercial project</h2>
        </div>
        <button onClick={onClose} aria-label="Close project notice">×</button>
      </header>

      <div className="project-notice__body">
        <p className="project-notice__intro">
          Equity Lab is a personal, open-source project for education and independent research. It is not operated as a business or startup.
        </p>
        <div className="project-notice__grid">
          {commitments.map((commitment) => <article key={commitment.number}>
            <span>{commitment.number}</span>
            <div>
              <h3>{commitment.title}</h3>
              <p>{commitment.description}</p>
            </div>
          </article>)}
        </div>
      </div>

      <footer className="project-notice__footer">
        <p>Data may be delayed, incomplete, or inaccurate. Nothing on this site is investment advice.</p>
        <button className="primary-button" onClick={onClose}>Understood</button>
      </footer>
    </section>
  </div>;
}
