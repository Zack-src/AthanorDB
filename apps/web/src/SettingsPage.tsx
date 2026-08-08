import { useState } from "react";
import { Button } from "./ui/Button.js";
import { Field } from "./ui/Field.js";
import { Badge } from "./ui/Badge.js";
import { Card } from "./ui/Card.js";
import { Tabs } from "./ui/Tabs.js";
import { ChangePasswordModal } from "./ChangePasswordModal.js";
import { BrandMark } from "./ui/BrandMark.js";
import {
  ChevronLeftIcon,
  UserIcon,
  PaletteIcon,
  SlidersIcon,
  UsersIcon,
  CreditCardIcon,
  InfoIcon,
  KeyIcon,
  CheckIcon,
  SparklesIcon,
  LogOutIcon,
  ShieldCheckIcon,
  ZapIcon,
} from "./Icons.js";

import type { Session } from "./types.js";

export interface SettingsPageProps {
  session: Session;
  onBack: () => void;
  onDisplayNameChange: (name: string) => void;
  onLogout?: () => void;
}

export function SettingsPage({ session, onBack, onDisplayNameChange, onLogout }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "appearance" | "editor" | "team" | "billing" | "about">("profile");
  const [displayName, setDisplayName] = useState(session.displayName);
  const [savingName, setSavingName] = useState(false);
  const [nameSavedSuccess, setNameSavedSuccess] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Local preferences
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

  const navItems = [
    { id: "profile", label: "Profil & Compte", icon: <UserIcon size={16} /> },
    { id: "appearance", label: "Apparence & Thèmes", icon: <PaletteIcon size={16} /> },
    { id: "editor", label: "Éditeur & Canvas", icon: <SlidersIcon size={16} /> },
    { id: "team", label: "Équipe & Espaces", icon: <UsersIcon size={16} /> },
    { id: "billing", label: "Licence & Offres", icon: <CreditCardIcon size={16} /> },
    { id: "about", label: "À propos & Système", icon: <InfoIcon size={16} /> },
  ] as const;

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans select-none">
      {/* 56px Standardized Header */}
      <header className="h-14 shrink-0 px-6 border-b border-border/80 bg-surface/90 glass-panel flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-xs">
            <ChevronLeftIcon size={16} /> Retour
          </Button>
          <span className="w-px h-4 bg-border/60" />
          <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
            <BrandMark size={24} />
            <span className="font-extrabold text-sm tracking-tight text-text">Paramètres du Compte</span>
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

      {/* Main Settings Body */}
      <div className="flex-1 flex max-w-6xl w-full mx-auto px-6 py-8 gap-8">
        {/* Left Sidebar Navigation */}
        <aside className="w-64 shrink-0 space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Configuration
          </div>
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
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

        {/* Right Content Panel */}
        <main className="flex-1 max-w-2xl bg-surface/40 p-6 rounded-xl border border-border/60 space-y-6">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-text mb-1">Informations du Profil</h2>
                <p className="text-xs text-text-muted">Gérez vos identifiants d'accès et votre nom d'affichage.</p>
              </div>

              <form onSubmit={handleSaveDisplayName} className="space-y-4 max-w-md">
                <Field label="Adresse Email (Identifiant)" type="email" value={session.email} disabled readOnly />
                <Field
                  label="Nom d'affichage"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={savingName || !displayName.trim() || displayName === session.displayName}
                  >
                    {savingName ? "Enregistrement…" : "Enregistrer les modifications"}
                  </Button>
                  {nameSavedSuccess && (
                    <span className="text-xs text-success font-semibold flex items-center gap-1">
                      <CheckIcon size={14} /> Mis à jour !
                    </span>
                  )}
                </div>
              </form>

              <div className="pt-6 border-t border-border/60">
                <h3 className="text-sm font-bold text-text mb-1">Sécurité de l'accès</h3>
                <p className="text-xs text-text-muted mb-4">Modifiez votre mot de passe pour sécuriser votre compte.</p>
                <Button variant="outline" onClick={() => setShowChangePassword(true)} className="gap-2 text-xs">
                  <KeyIcon size={14} /> Modifier le mot de passe
                </Button>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-text mb-1">Apparence & Thèmes Visuels</h2>
                <p className="text-xs text-text-muted">Personnalisez l'Esthétique globale d'AthanorDB.</p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-text">Préréglage de Couleur</label>
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
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        themePreset === p.id ? "border-primary ring-1 ring-primary/40 font-bold text-text bg-surface-raised" : "border-border/60 hover:border-border"
                      }`}
                    >
                      <span>{p.name}</span>
                      <span className={`w-4 h-4 rounded-full ${p.color}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-border/60">
                <label className="text-xs font-semibold text-text">Style de la Grille du Canvas</label>
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

          {/* Editor Tab */}
          {activeTab === "editor" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-text mb-1">Préférences de l'Éditeur DBML</h2>
                <p className="text-xs text-text-muted">Ajustez le comportement du canvas et de la réorganisation visuelle.</p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-text">Algorithme d'Auto-Layout</label>
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

              <div className="space-y-3 pt-6 border-t border-border/60">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-raised border border-border/60">
                  <div>
                    <div className="font-bold text-xs text-text">Aimantage des Tables (Grid Snapping)</div>
                    <div className="text-[11px] text-text-muted">Aligne automatiquement les tables sur la grille lors des déplacements.</div>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary cursor-pointer" />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-raised border border-border/60">
                  <div>
                    <div className="font-bold text-xs text-text">Surlignage des Clés Étrangères</div>
                    <div className="text-[11px] text-text-muted">Met en surbrillance les relations au survol des colonnes.</div>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-primary cursor-pointer" />
                </div>
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === "team" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-text mb-1">Équipe & Collaborateurs</h2>
                <p className="text-xs text-text-muted">Gérez les permissions et l'accès à vos schémas.</p>
              </div>

              <Card variant="glass" className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                      {session.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-text">{session.displayName}</div>
                      <div className="text-[11px] text-text-muted">{session.email}</div>
                    </div>
                  </div>
                  <Badge tone={session.isAdmin ? "admin" : "success"}>
                    {session.isAdmin ? "Administrateur" : "Propriétaire"}
                  </Badge>
                </div>
              </Card>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-text mb-1">Licence & Monétisation</h2>
                <p className="text-xs text-text-muted">Détails de l'offre AthanorDB et statut de votre espace.</p>
              </div>

              <Card variant="glow" className="p-5 border-primary">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <SparklesIcon size={18} className="text-primary" />
                    <span className="font-bold text-xs text-text">Offre : <b>Community Open-Core</b></span>
                  </div>
                  <Badge tone="success">Gratuit à Vie (MIT)</Badge>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed mb-4">
                  Vous utilisez la version Open Source auto-hébergée. Profitez des projets illimités et des exports SQL.
                </p>

                <Button variant="gradient" className="w-full py-2 text-xs">
                  Passer à Cloud Pro (12€ / mois)
                </Button>
              </Card>

              <div className="space-y-2 pt-4 border-t border-border/60">
                <h3 className="text-xs font-bold text-text">Clé API Espace de Travail</h3>
                <Field label="Clé API Utilisateur" type="password" value="ath_live_994857362514392817" readOnly />
              </div>
            </div>
          )}

          {/* About Tab */}
          {activeTab === "about" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-text mb-1">À propos & Système</h2>
                <p className="text-xs text-text-muted">Informations sur la version et le statut opérationnel.</p>
              </div>

              <div className="space-y-3 font-mono text-xs bg-surface p-4 rounded-xl border border-border/80">
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
                  <span className="text-success font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse-subtle" /> Opérationnel
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
