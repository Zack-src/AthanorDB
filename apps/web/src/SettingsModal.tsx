import { Modal } from "./Modal.js";
import { Button } from "./ui/Button.js";
import { ChangePasswordModal } from "./ChangePasswordModal.js";
import { useSettingsPanelState, type SettingsTab } from "./settings/useSettingsPanelState.js";
import { SettingsTabContent } from "./settings/SettingsTabContent.js";
import { LogOutIcon } from "./Icons.js";
import type { Session } from "./types.js";

export interface SettingsModalProps {
  session: Session;
  onClose: () => void;
  onDisplayNameChange: (name: string) => void;
  onLogout?: () => void;
}

const NAV_ITEMS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: "profile", label: "Profil & Compte", icon: "👤" },
  { id: "appearance", label: "Apparence & Thème", icon: "🎨" },
  { id: "editor", label: "Éditeur & Canvas", icon: "⚡" },
  { id: "team", label: "Équipe & Rôles", icon: "👥" },
  { id: "billing", label: "Plan & Monétisation", icon: "💎" },
  { id: "about", label: "À propos & Licence", icon: "ℹ️" },
];

export function SettingsModal({ session, onClose, onDisplayNameChange, onLogout }: SettingsModalProps) {
  const state = useSettingsPanelState(session, onDisplayNameChange);

  return (
    <>
      <Modal title="Paramètres & Configuration" onClose={onClose} wide>
        <div className="flex flex-col md:flex-row min-h-[460px] gap-6">
          <div className="w-full md:w-56 shrink-0 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border/50 pr-0 md:pr-4 pb-4 md:pb-0">
            <div className="space-y-1">
              {NAV_ITEMS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => state.setActiveTab(t.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
                    state.activeTab === t.id
                      ? "bg-primary text-white shadow-sm glow-indigo"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text"
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {onLogout && (
              <div className="pt-4 border-t border-border/40 mt-4">
                <Button variant="danger-ghost" size="sm" onClick={onLogout} className="w-full justify-start gap-2">
                  <LogOutIcon size={14} /> Se déconnecter
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 text-xs text-text-secondary">
            <SettingsTabContent tab={state.activeTab} session={session} state={state} />
          </div>
        </div>
      </Modal>

      {state.showChangePassword && <ChangePasswordModal onClose={() => state.setShowChangePassword(false)} />}
    </>
  );
}
