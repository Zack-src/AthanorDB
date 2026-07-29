import type { TableNodeType } from "./TableNode.js";
import type { ZoneNodeType } from "./ZoneNode.js";
import type { StickyNoteNodeType } from "./StickyNoteNode.js";
import type { CursorNodeType } from "./CursorNode.js";

export type CanvasNode = TableNodeType | ZoneNodeType | StickyNoteNodeType;
export type AllNodes = CanvasNode | CursorNodeType;

export type ProjectStatus = "active" | "archived" | "trashed";
export type PermissionLevel = "view" | "edit" | "administrator";

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  created_at: string;
  permission: PermissionLevel;
}

export interface Session {
  id: string;
  email: string;
  isAdmin: boolean;
  displayName: string;
}

export interface UserSummary {
  id: string;
  email: string;
  isAdmin: boolean;
  displayName: string;
  createdAt: string;
}

export interface InvitationSummary {
  token: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "accepted" | "expired";
}

export interface TeamSummary {
  id: string;
  name: string;
  createdAt?: string;
  memberCount: number;
}

export interface TeamDetail {
  id: string;
  name: string;
  createdAt: string;
  members: UserSummary[];
}

export interface ProjectTeamGrant {
  teamId: string;
  teamName: string;
  permission: PermissionLevel;
}

export type SqlDialect = "postgres" | "mysql" | "mssql";
export type ImageFormat = "png" | "svg" | "pdf";
export type ExportFormat = "dbml" | SqlDialect | ImageFormat;

export interface CanvasImageCapture {
  dataUrl: string;
  width: number;
  height: number;
}

export interface CanvasExportHandle {
  capture: (format: "png" | "svg") => Promise<CanvasImageCapture>;
}
