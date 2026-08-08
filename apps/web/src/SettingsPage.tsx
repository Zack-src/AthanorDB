import type { ReactNode } from "react";
import { Button } from "./ui/Button.js";
import { BrandMark } from "./ui/BrandMark.js";
import { ChangePasswordModal } from "./ChangePasswordModal.js";
import { useSettingsPanelState, type SettingsTab } from "./settings/useSettingsPanelState.js";
import { SettingsTabContent } from "./settings/SettingsTabContent.js";
import {
  ChevronLeftIcon,
  UserIcon,
  PaletteIcon,
  SlidersIcon,
  UsersIcon,
  CreditCardIcon,
  InfoIcon,
  LogOutIcon,
} from "./Icons.js";

import type { Session } from "./types.js";

export interface SettingsPageProps {
  session: Session;
  onBack: () => void;
  onDisplayNameChange: (name: string) => void;
  onLogout?: () => void;
}

const NAV_ITEMS: { id: SettingsTab; label: string; icon: ReactNode }[] = [
  { id: "profile", label: "Profil & Compte", icon: <UserIcon size={16} /> },
  { id: "appearance", label: "Apparence & Thèmes", icon: <PaletteIcon size={16} /> },
  { id: "editor", label: "Éditeur & Canvas", icon: <SlidersIcon size={16} /> },
  { id: "team", label: "Équipe & Espaces", icon: <UsersIcon size={16} /> },
  { id: "billing", label: "Licence & Offres", icon: <CreditCardIcon size={16} /> },
  { id: "about", label: "À propos & Système", icon: <InfoIcon size={16} /> },
];

export function SettingsPage({ session, onBack, onDisplayNameChange, onLogout }: SettingsPageProps) {
  const state = useSettingsPanelState(session, onDisplayNameChange);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans select-none">
      <header className="h-14 shrink-0 px-6 border-b border-border/80 bg-surface/90 glass-panel flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-xs">
            <ChevronLeftIcon size={16} /> Retour
          </Button>
          <span className="w-px h-4 bg-border/60" />
          <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
            <BrandMark size={24} />
            <span className="font-extrabold text-sm tracking-tight text-text">Paramètres du compte</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onLogout && (
            <Button variant="danger-ghost" size="sm" onClick={onLogout}>
              <LogOutIcon size={14} /> Déconnexion
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 flex max-w-6xl w-full mx-auto px-6 py-8 gap-8">
        <aside className="w-64 shrink-0 space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Configuration
          </div>
          {NAV_ITEMS.map((item) => {
            const active = state.activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => state.setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all text-left ${
                  active
                    ? "bg-primary text-white shadow-sm font-bold"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        <main className="flex-1 max-w-2xl bg-surface/40 p-6 rounded-xl border border-border/60 space-y-6">
          <SettingsTabContent tab={state.activeTab} session={session} state={state} />
        </main>
      </div>

      {state.showChangePassword && <ChangePasswordModal onClose={() => state.setShowChangePassword(false)} />}
    </div>
  );
}
