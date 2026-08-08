import { ArchiveIcon, FolderIcon, TrashIcon } from "../Icons.js";
import type { IconProps } from "../Icons.js";
import type { ProjectStatus, ProjectSummary } from "../types.js";

export interface ProjectSection {
  key: ProjectStatus;
  label: string;
  empty: string;
  icon: (props: IconProps) => JSX.Element;
}

export const PROJECT_SECTIONS: ProjectSection[] = [
  { key: "active", label: "Projets actifs", empty: "Aucun projet actif pour le moment — créez-en un pour commencer.", icon: FolderIcon },
  { key: "archived", label: "Archives", empty: "Les archives sont vides.", icon: ArchiveIcon },
  { key: "trashed", label: "Corbeille", empty: "La corbeille est vide.", icon: TrashIcon },
];

/**
 * Left-rail section nav (Active/Archived/Trashed), each with a live count —
 * the Figma-style "Recents / Drafts / Trash" file-browser pattern, in place
 * of the horizontal tab bar this used to be.
 */
export function ProjectTabs(props: { projects: ProjectSummary[]; section: ProjectStatus; onSectionChange: (s: ProjectStatus) => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {PROJECT_SECTIONS.map((s) => {
        const count = props.projects.filter((p) => p.status === s.key).length;
        const active = props.section === s.key;
        return (
          <button
            key={s.key}
            onClick={() => props.onSectionChange(s.key)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors ${
              active ? "bg-primary-light text-primary" : "text-text-secondary hover:bg-surface-hover hover:text-text"
            }`}
          >
            <s.icon size={15} />
            <span className="flex-1">{s.label}</span>
            {count > 0 && (
              <span
                className={`rounded-full px-1.5 py-px text-[11px] font-semibold ${
                  active ? "bg-primary/20 text-primary" : "bg-surface-hover text-text-muted"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
