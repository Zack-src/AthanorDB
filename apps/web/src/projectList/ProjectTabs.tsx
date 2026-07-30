import type { ProjectStatus, ProjectSummary } from "../types.js";

export interface ProjectSection {
  key: ProjectStatus;
  label: string;
  empty: string;
}

export const PROJECT_SECTIONS: ProjectSection[] = [
  { key: "active", label: "Projects", empty: "No projects yet — create one above to get started." },
  { key: "archived", label: "Archive", empty: "Archive is empty." },
  { key: "trashed", label: "Trash", empty: "Trash is empty." },
];

/** Active/Archive/Trash tab bar, each with a count badge. */
export function ProjectTabs(props: { projects: ProjectSummary[]; section: ProjectStatus; onSectionChange: (s: ProjectStatus) => void }) {
  return (
    <div className="mb-[18px] flex gap-3.5 border-b border-border">
      {PROJECT_SECTIONS.map((s) => {
        const count = props.projects.filter((p) => p.status === s.key).length;
        const active = props.section === s.key;
        return (
          <button
            key={s.key}
            className={`-mb-px flex items-center gap-1.5 border-b-2 py-2 text-[13px] font-semibold ${
              active ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"
            }`}
            onClick={() => props.onSectionChange(s.key)}
          >
            {s.label}
            {count > 0 && (
              <span
                className={`rounded-full px-1.5 py-px text-[11px] font-semibold ${
                  active ? "bg-primary-light text-primary" : "bg-surface-hover text-text-muted"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
