import { FolderIcon, PlusIcon } from "./Icons.js";
import type { ProjectSummary } from "./types.js";

export function ProjectList(props: {
  projects: ProjectSummary[];
  newName: string;
  onNewNameChange: (v: string) => void;
  onCreate: () => void;
  onOpen: (p: ProjectSummary) => void;
}) {
  const { projects, newName, onNewNameChange, onCreate, onOpen } = props;
  return (
    <div className="project-list-page">
      <div className="project-list-inner">
        <h1 className="project-list-heading">Projects</h1>
        <p className="project-list-sub">DBML-native schema diagrams, versioned and shared live.</p>
        <div className="project-create-row">
          <input
            className="input"
            placeholder="New project name"
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
            maxLength={200}
          />
          <button className="btn btn-primary" onClick={onCreate}>
            <PlusIcon size={14} /> Create
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="empty-state">No projects yet — create one above to get started.</div>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <button key={p.id} className="project-card" onClick={() => onOpen(p)}>
                <span className="project-card-icon">
                  <FolderIcon size={17} />
                </span>
                <div className="project-card-name">{p.name}</div>
                <div className="project-card-date">{p.created_at}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
