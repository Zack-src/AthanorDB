import { useState } from "react";
import { Modal } from "./Modal.js";
import { Tabs } from "./ui/Tabs.js";
import { Button } from "./ui/Button.js";
import { Field } from "./ui/Field.js";
import { Badge } from "./ui/Badge.js";
import { Card } from "./ui/Card.js";
import { ChangePasswordModal } from "./ChangePasswordModal.js";
import {
  UsersIcon,
  KeyIcon,
  SparklesIcon,
  CheckIcon,
  CodeIcon,
  DatabaseIcon,
  LayersIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ZapIcon,
  LogOutIcon,
} from "./Icons.js";
import type { Session } from "./types.js";

export interface SettingsModalProps {
  session: Session;
  onClose: () => void;
  onDisplayNameChange: (name: string) => void;
  onLogout?: () => void;
}

export function SettingsModal({ session, onClose, onDisplayNameChange, onLogout }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "appearance" | "editor" | "team" | "billing" | "about">("profile");
  const [displayName, setDisplayName] = useState(session.displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameSavedSuccess, setNameSavedSuccess] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Appearance & Editor preferences local state
  const [themePreset, setThemePreset] = useState<"obsidian" | "midnight" | "emerald" | "light">("obsidian");
  const [gridStyle, setGridStyle] = useState<"dots" | "lines" | "cross">("dots");
  const [autoLayoutAlgo, setAutoLayoutAlgo] = useState<"dagre" | "force">("dagre");

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || displayName === session.displayName) return;
    setSavingName(true);
    setNameSavedSuccess(false);
    try {
      await onDisplayNameChange(displayName.trim());
      setNameSavedSuccess(true);
      setTimeout(() => setNameSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <>
      <Modal title="Paramètres & Configuration" onClose={onClose} wide>
        <div className="flex flex-col md:flex-row min-h-[460px] gap-6">

          {/* Sidebar Tab Selector */}
          <div className="w-full md:w-56 shrink-0 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border/50 pr-0 md:pr-4 pb-4 md:pb-0">
            <div className="space-y-1">
              {[
                { id: "profile", label: "Profil & Compte", icon: "👤" },
                { id: "appearance", label: "Apparence & Thème", icon: "🎨" },
                { id: "editor", label: "Éditeur & Canvas", icon: "⚡" },
                { id: "team", label: "Équipe & Rôles", icon: "👥" },
                { id: "billing", label: "Plan & Monétisation", icon: "💎" },
                { id: "about", label: "À propos & Licence", icon: "ℹ️" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
                    activeTab === t.id
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
                  <LogOutIcon size={14} /> Se Déconnecter
                </Button>
              </div>
            )}
          </div>

          {/* Content Panel */}
          <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 space-y-5 text-xs text-text-secondary">
            {/* Tab 1: Profile */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Informations du Profil</h3>
                  <p className="text-text-muted">Gérez vos identifiants d'accès et votre nom d'affichage.</p>
                </div>

                <form onSubmit={handleSaveDisplayName} className="space-y-4">
                  <Field label="Adresse Email (Identifiant)" type="email" value={session.email} disabled readOnly />
                  <Field
                    label="Nom d'affichage"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={savingName || !displayName.trim() || displayName === session.displayName}
                    >
                      {savingName ? "Enregistrement…" : "Enregistrer le nom"}
                    </Button>
                    {nameSavedSuccess && (
                      <span className="text-success font-semibold flex items-center gap-1">
                        <CheckIcon size={14} /> Nom mis à jour !
                      </span>
                    )}
                  </div>
                </form>

                <div className="pt-4 border-t border-border/50">
                  <h4 className="font-bold text-text mb-2">Sécurité & Mot de passe</h4>
                  <p className="text-text-muted mb-3">Modifiez votre mot de passe pour sécuriser votre compte.</p>
                  <Button variant="outline" onClick={() => setShowChangePassword(true)} className="gap-2">
                    <KeyIcon size={14} /> Modifier le mot de passe
                  </Button>
                </div>
              </div>
            )}

            {/* Tab 2: Appearance */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Thème & Styles Visuels</h3>
                  <p className="text-text-muted">Personnalisez l'esthétique de votre espace de travail.</p>
                </div>

                <div className="space-y-3">
                  <label className="font-semibold text-text">Préréglage de Couleur</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "obsidian", name: "Obsidian Sombre", color: "bg-[#090a0f] border-primary" },
                      { id: "midnight", name: "Midnight Ardoise", color: "bg-[#0f172a] border-blue-500" },
                      { id: "emerald", name: "Emerald Cyber", color: "bg-[#064e3b] border-emerald-500" },
                      { id: "light", name: "Clair Moderne", color: "bg-[#f8fafc] text-slate-900 border-slate-400" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setThemePreset(p.id as any)}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                          themePreset === p.id ? "border-primary ring-2 ring-primary/30 font-bold text-text" : "border-border/60 hover:border-border"
                        }`}
                      >
                        <span>{p.name}</span>
                        <span className={`w-4 h-4 rounded-full ${p.color}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border/50">
                  <label className="font-semibold text-text">Style de Grille de Canvas</label>
                  <Tabs
                    variant="boxed"
                    tabs={[
                      { id: "dots", label: "Points (Dots)" },
                      { id: "lines", label: "Lignes (Grid)" },
                      { id: "cross", label: "Croix (Cross)" },
                    ]}
                    activeTab={gridStyle}
                    onChange={(g) => setGridStyle(g as any)}
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Editor */}
            {activeTab === "editor" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Préférences de l'Éditeur & Canvas</h3>
                  <p className="text-text-muted">Ajustez le comportement de disposition des schémas visuels.</p>
                </div>

                <div className="space-y-3">
                  <label className="font-semibold text-text">Algorithme d'Auto-Layout</label>
                  <Tabs
                    variant="boxed"
                    tabs={[
                      { id: "dagre", label: "Dagre (Hiérarchique)" },
                      { id: "force", label: "Force-Directed" },
                    ]}
                    activeTab={autoLayoutAlgo}
                    onChange={(a) => setAutoLayoutAlgo(a as any)}
                  />
                </div>

                <div className="space-y-3 pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-raised border border-border/50">
                    <div>
                      <div className="font-bold text-text">Bordures Magnétiques (Grid Snapping)</div>
                      <div className="text-[11px] text-text-muted">Aligne automatiquement les tables lors du déplacement.</div>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary cursor-pointer" />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-raised border border-border/50">
                    <div>
                      <div className="font-bold text-text">Surlignage des Liens Directs</div>
                      <div className="text-[11px] text-text-muted">Met en surbrillance les relations au survol des clés étrangères.</div>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary cursor-pointer" />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Team */}
            {activeTab === "team" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Espace d'Équipe & Coéquipiers</h3>
                  <p className="text-text-muted">Membres ayant accès à vos schémas partagés.</p>
                </div>

                <Card variant="glass" className="p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                        {session.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-text">{session.displayName}</div>
                        <div className="text-[10px] text-text-muted">{session.email}</div>
                      </div>
                    </div>
                    <Badge tone={session.isAdmin ? "admin" : "success"}>
                      {session.isAdmin ? "Administrateur" : "Propriétaire"}
                    </Badge>
                  </div>
                </Card>
              </div>
            )}

            {/* Tab 5: Billing & Monetization */}
            {activeTab === "billing" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Abonnement & Licence Commerciale</h3>
                  <p className="text-text-muted">Informations sur votre offre produit et votre statut de monétisation.</p>
                </div>

                <Card variant="glow" className="p-5 border-primary">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <SparklesIcon size={18} className="text-primary" />
                      <span className="font-bold text-sm text-text">Offre Actuelle : <b>Community Open Source</b></span>
                    </div>
                    <Badge tone="success">Gratuit à Vie (MIT)</Badge>
                  </div>

                  <p className="text-xs text-text-secondary leading-relaxed mb-4">
                    Vous utilisez la version Open-Core auto-hébergée. Profitez des tables illimitées, des sauvegardes local-first et des exports SQL.
                  </p>

                  <Button variant="gradient" className="w-full py-2">
                    Passer à l'offre Cloud Pro (12€/mois) <SparklesIcon size={14} />
                  </Button>
                </Card>

                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-text">Clé API & Webhooks</h4>
                  <Field label="Clé d'API Utilisateur" type="password" value="ath_live_994857362514392817" readOnly />
                </div>
              </div>
            )}

            {/* Tab 6: About */}
            {activeTab === "about" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">À Propos d'AthanorDB</h3>
                  <p className="text-text-muted">Éditeur de schémas DBML local-first avec collaboration temps réel.</p>
                </div>

                <div className="space-y-3 font-mono text-xs bg-surface p-4 rounded-xl border border-border">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Version Produit :</span>
                    <span className="text-text font-bold">v0.0.1-open-core</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Licence Globale :</span>
                    <span className="text-success font-bold">MIT Open Source</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Statut Serveur Sync :</span>
                    <span className="text-success font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-success animate-ping" /> Opérationnel
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </>
  );
}
