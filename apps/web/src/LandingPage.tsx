import { useState } from "react";
import { BrandMark } from "./ui/BrandMark.js";
import { Button } from "./ui/Button.js";
import { Badge } from "./ui/Badge.js";
import { Card } from "./ui/Card.js";
import {
  CodeIcon,
  DatabaseIcon,
  LayersIcon,
  SparklesIcon,
  UsersIcon,
  ZapIcon,
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
  MousePointerIcon,
  MoveIcon,
  KeyIcon,
  LinkIcon,
} from "./Icons.js";


export interface LandingPageProps {
  onOpenApp: () => void;
  onOpenLogin: () => void;
  isLoggedIn?: boolean;
}

export function LandingPage({ onOpenApp, onOpenLogin, isLoggedIn = false }: LandingPageProps) {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Interactive Mockup Draggable Tables state
  const [tablePos, setTablePos] = useState({
    users: { x: 40, y: 50 },
    orders: { x: 320, y: 110 },
  });
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (tableKey: "users" | "orders", e: React.MouseEvent) => {
    setDraggingTable(tableKey);
    setDragOffset({
      x: e.clientX - tablePos[tableKey].x,
      y: e.clientY - tablePos[tableKey].y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingTable) return;
    const newX = Math.max(10, Math.min(500, e.clientX - dragOffset.x));
    const newY = Math.max(10, Math.min(220, e.clientY - dragOffset.y));
    setTablePos((prev) => ({
      ...prev,
      [draggingTable]: { x: newX, y: newY },
    }));
  };

  const handleMouseUp = () => {
    setDraggingTable(null);
  };

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  // Connection path calculation between users table (right edge) and orders table (left edge)
  const pathStartX = tablePos.users.x + 220;
  const pathStartY = tablePos.users.y + 70;
  const pathEndX = tablePos.orders.x;
  const pathEndY = tablePos.orders.y + 70;
  const pathControlX1 = pathStartX + (pathEndX - pathStartX) / 2;
  const pathControlX2 = pathEndX - (pathEndX - pathStartX) / 2;

  const svgPathD = `M ${pathStartX} ${pathStartY} C ${pathControlX1} ${pathStartY}, ${pathControlX2} ${pathEndY}, ${pathEndX} ${pathEndY}`;

  return (
    <div
      className="min-h-screen bg-bg text-text font-sans selection:bg-primary/30 selection:text-white flex flex-col select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 56px Standardized Header */}
      <header className="h-14 sticky top-0 z-50 glass-panel border-b border-border/80 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onOpenApp}>
          <BrandMark size={26} />
          <span className="text-sm font-extrabold tracking-tight text-text">AthanorDB</span>
          <Badge tone="admin" className="hidden sm:inline-flex">v0.0.1 Open-Core</Badge>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-text-secondary">
          <a href="#features" className="hover:text-text transition-colors">Fonctionnalités</a>
          <a href="#demo" className="hover:text-text transition-colors">Canvas Interactif</a>
          <a href="#opensource" className="hover:text-text transition-colors">Open Source</a>
          <a href="#pricing" className="hover:text-text transition-colors">Tarifs</a>
          <a href="#faq" className="hover:text-text transition-colors">FAQ</a>
        </nav>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Button variant="primary" size="sm" onClick={onOpenApp} className="text-xs">
              Mon Espace (Dashboard) →
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onOpenApp} className="text-xs">
              Ouvrir l'Éditeur Démo <SparklesIcon size={13} />
            </Button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-6 overflow-hidden gradient-bg-hero flex flex-col items-center text-center">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[280px] bg-primary/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-card border border-primary/40 text-xs font-semibold text-primary mb-6 shadow-sm">
          <ZapIcon size={13} />
          <span>Local-First & Sync temps réel Yjs CRDT</span>
        </div>

        <h1 className="max-w-4xl text-4xl sm:text-6xl font-black tracking-tight leading-[1.1] mb-6">
          Concevez vos bases de données avec un moteur <span className="gradient-text">DBML ultra-rapide</span>.
        </h1>

        <p className="max-w-2xl text-sm sm:text-base text-text-secondary leading-relaxed mb-8">
          AthanorDB combine l'édition visuelle de schémas relationnels, la collaboration temps réel sans conflit et l'exportation SQL directe. 100% de contrôle sur vos données.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
          <Button variant="glow" size="lg" onClick={onOpenApp} className="px-7 py-3 text-sm font-bold">
            Essayer l'Éditeur Démo <SparklesIcon size={15} />
          </Button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-border-strong/80 bg-surface/60 text-text-secondary hover:text-text hover:bg-surface-hover text-xs font-semibold transition-all shadow-sm"
          >
            <CodeIcon size={15} /> GitHub Open-Source <ExternalLinkIcon size={12} />
          </a>
        </div>

        {/* Real Interactive Canvas Preview (Awwwards Style) */}
        <div id="demo" className="relative w-full max-w-5xl rounded-2xl border border-border-strong/90 glass-panel p-2 shadow-2xl glow-indigo">
          <div className="flex items-center justify-between px-4 py-2.5 bg-surface/90 rounded-t-xl border-b border-border/60 text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-danger/80" />
              <span className="w-3 h-3 rounded-full bg-warning/80" />
              <span className="w-3 h-3 rounded-full bg-success/80" />
              <span className="ml-2 font-mono text-[11px] text-text-secondary">athanordb://canvas/interactive-preview</span>
            </div>
            <div className="flex items-center gap-2 text-primary font-semibold text-[11px]">
              <MoveIcon size={13} />
              <span>Déplacez les tables pour tester les relations animées !</span>
            </div>
          </div>

          <div className="relative bg-bg-canvas h-[380px] sm:h-[420px] rounded-b-xl overflow-hidden p-6 text-left cursor-crosshair">
            {/* Canvas Dot Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#292d3f_1.2px,transparent_1.2px)] [background-size:18px_18px] opacity-40" />

            {/* SVG Animated Connection Line */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              <path
                d={svgPathD}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                className="ref-edge-flow-path"
                style={{ animation: "ref-edge-flow 0.8s linear infinite" }}
              />
              <circle cx={pathStartX} cy={pathStartY} r="4" fill="#6366f1" />
              <circle cx={pathEndX} cy={pathEndY} r="4" fill="#6366f1" />
            </svg>

            {/* Draggable Table 1: users */}
            <div
              className="absolute z-20 w-[220px] rounded-xl border border-primary/60 bg-surface/95 shadow-xl overflow-hidden cursor-move transition-shadow hover:shadow-2xl"
              style={{ left: tablePos.users.x, top: tablePos.users.y }}
              onMouseDown={(e) => handleMouseDown("users", e)}
            >
              <div className="bg-primary/20 px-3.5 py-2 border-b border-primary/30 flex justify-between items-center select-none">
                <span className="font-bold text-xs text-primary font-mono flex items-center gap-1.5">
                  <DatabaseIcon size={13} /> users
                </span>
                <span className="text-[10px] text-text-muted font-mono">4 colonnes</span>
              </div>
              <div className="p-3 text-xs font-mono space-y-1.5 text-text-secondary select-none">
                <div className="flex justify-between items-center text-text font-semibold">
                  <span className="text-warning flex items-center gap-1"><KeyIcon size={12} /> id</span>
                  <span className="text-text-muted text-[10px]">uuid [pk]</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>email</span>
                  <span className="text-text-muted text-[10px]">varchar</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>display_name</span>
                  <span className="text-text-muted text-[10px]">varchar</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>created_at</span>
                  <span className="text-text-muted text-[10px]">timestamp</span>
                </div>
              </div>
            </div>

            {/* Draggable Table 2: orders */}
            <div
              className="absolute z-20 w-[220px] rounded-xl border border-accent-purple/60 bg-surface/95 shadow-xl overflow-hidden cursor-move transition-shadow hover:shadow-2xl"
              style={{ left: tablePos.orders.x, top: tablePos.orders.y }}
              onMouseDown={(e) => handleMouseDown("orders", e)}
            >
              <div className="bg-accent-purple/20 px-3.5 py-2 border-b border-accent-purple/30 flex justify-between items-center select-none">
                <span className="font-bold text-xs text-accent-purple font-mono flex items-center gap-1.5">
                  <DatabaseIcon size={13} /> orders
                </span>
                <span className="text-[10px] text-text-muted font-mono">3 colonnes</span>
              </div>
              <div className="p-3 text-xs font-mono space-y-1.5 text-text-secondary select-none">
                <div className="flex justify-between items-center text-text font-semibold">
                  <span className="text-warning flex items-center gap-1"><KeyIcon size={12} /> id</span>
                  <span className="text-text-muted text-[10px]">uuid [pk]</span>
                </div>
                <div className="flex justify-between items-center text-primary font-semibold">
                  <span className="flex items-center gap-1"><LinkIcon size={10} /> user_id</span>
                  <span className="text-text-muted text-[10px]">uuid [ref]</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>total_amount</span>
                  <span className="text-text-muted text-[10px]">decimal</span>
                </div>
              </div>
            </div>

            {/* Floating Cursor Overlay Hint */}
            <div className="absolute bottom-4 left-4 glass-card px-3 py-1.5 rounded-lg border border-primary/40 text-[11px] text-text font-semibold flex items-center gap-2 shadow-sm pointer-events-none">
              <MousePointerIcon size={13} className="text-primary animate-bounce" />
              <span>Attrapez l'en-tête d'une table pour la déplacer</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <Badge tone="admin" className="mb-3">Architecture & Design</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Une expérience conçue pour les développeurs exigeants
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto text-xs sm:text-sm">
            Local-first, zéro latence, génération de code instantanée et collaboration sans conflit.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="glass" interactive className="p-6">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center mb-4">
              <DatabaseIcon size={20} />
            </div>
            <h3 className="text-base font-bold mb-2">Local-First & In-Memory</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Vos schémas restent sauvegardés dans votre navigateur. Réponse instantanée et fonctionnement hors-ligne.
            </p>
          </Card>

          <Card variant="glass" interactive className="p-6">
            <div className="w-10 h-10 rounded-xl bg-accent-purple/20 text-accent-purple flex items-center justify-center mb-4">
              <UsersIcon size={20} />
            </div>
            <h3 className="text-base font-bold mb-2">Collaboration Yjs CRDT</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Édition simultanée sans conflit. Suivez les curseurs et modifications de votre équipe en direct.
            </p>
          </Card>

          <Card variant="glass" interactive className="p-6">
            <div className="w-10 h-10 rounded-xl bg-accent-cyan/20 text-accent-cyan flex items-center justify-center mb-4">
              <CodeIcon size={20} />
            </div>
            <h3 className="text-base font-bold mb-2">DBML & Exports SQL</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Importation et exportation en SQL (PostgreSQL, MySQL, SQLite, Snowflake) et syntaxe DBML propre.
            </p>
          </Card>
        </div>
      </section>

      {/* Pricing Matrix */}
      <section id="pricing" className="py-20 px-6 max-w-6xl mx-auto w-full border-t border-border/50">
        <div className="text-center mb-16">
          <Badge tone="admin" className="mb-3">Tarification Transparente</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Gratuit en Open Source. Puissant dans le Cloud.
          </h2>
          <p className="text-text-secondary max-w-lg mx-auto text-xs sm:text-sm">
            Auto-hébergez le cœur gratuitement sous licence MIT ou choisissez la version Cloud Managed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Community */}
          <Card variant="default" className="p-7 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Community</div>
              <div className="text-3xl font-black mb-1">0 € <span className="text-xs text-text-muted font-normal">/ mois</span></div>
              <p className="text-xs text-text-secondary mb-6">Auto-hébergement gratuit & Open Source sous licence MIT.</p>

              <ul className="space-y-3 text-xs text-text-secondary mb-8">
                <li className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-success shrink-0" /> Tables & schémas illimités
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-success shrink-0" /> Import / Export DBML & SQL
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-success shrink-0" /> Stockage Local-First
                </li>
              </ul>
            </div>

            <Button variant="outline" onClick={onOpenApp} className="w-full text-xs">
              Utiliser Gratuitement
            </Button>
          </Card>

          {/* Cloud Pro */}
          <Card variant="glow" className="p-7 flex flex-col justify-between relative border-primary">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-[10px] font-extrabold uppercase text-white tracking-wider shadow-sm">
              Recommandé Équipes
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Cloud Pro</div>
              <div className="text-3xl font-black mb-1">12 € <span className="text-xs text-text-muted font-normal">/ utilisateur / mo</span></div>
              <p className="text-xs text-text-secondary mb-6">Infrastructure Cloud gérée avec collaboration temps réel.</p>

              <ul className="space-y-3 text-xs text-text mb-8">
                <li className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-primary shrink-0" /> Serveur Yjs Cloud géré & sauvegardes
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-primary shrink-0" /> Espaces d'équipe & rôles de membres
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-primary shrink-0" /> Exports HD SVG & PDF vectoriels
                </li>
              </ul>
            </div>

            <Button variant="primary" onClick={onOpenApp} className="w-full text-xs">
              Essai Gratuit Cloud Pro
            </Button>
          </Card>

          {/* Enterprise */}
          <Card variant="default" className="p-7 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-accent-purple mb-2">Enterprise</div>
              <div className="text-3xl font-black mb-1">Sur Mesure</div>
              <p className="text-xs text-text-secondary mb-6">Pour les organisations nécessitant sécurité et conformité.</p>

              <ul className="space-y-3 text-xs text-text-secondary mb-8">
                <li className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-accent-purple shrink-0" /> Authentification SSO (SAML / OIDC)
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-accent-purple shrink-0" /> Instance cloud dédiée On-Premise
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon size={14} className="text-accent-purple shrink-0" /> Journaux d'audit de sécurité & SLA 99.9%
                </li>
              </ul>
            </div>

            <Button variant="outline" onClick={onOpenApp} className="w-full text-xs">
              Contacter l'Équipe
            </Button>
          </Card>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section id="faq" className="py-16 px-6 max-w-3xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Foire Aux Questions</h2>
          <p className="text-xs text-text-secondary">Questions fréquentes sur AthanorDB.</p>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "AthanorDB est-il vraiment open-source ?",
              a: "Oui ! Le moteur de rendu, l'éditeur DBML, le serveur Yjs et l'application web sont 100% open-source sous licence MIT.",
            },
            {
              q: "Où sont stockées mes données de base de données ?",
              a: "Par défaut, en mode Local-First, vos données restent stockées dans le navigateur et sur votre propre serveur auto-hébergé.",
            },
            {
              q: "Quels langages SQL sont pris en charge ?",
              a: "Import et export directs vers PostgreSQL, MySQL, SQLite, et Snowflake.",
            },
          ].map((item, idx) => (
            <div key={idx} className="glass-card rounded-xl overflow-hidden border border-border/60">
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold hover:bg-surface-hover/50 transition-colors"
              >
                <span>{item.q}</span>
                <ChevronDownIcon size={15} className={`transition-transform duration-200 ${activeFaq === idx ? "rotate-180 text-primary" : "text-text-muted"}`} />
              </button>
              {activeFaq === idx && (
                <div className="px-4 pb-4 text-xs text-text-secondary border-t border-border/40 pt-3 leading-relaxed animate-modal-in">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-surface/60 py-8 px-6 text-xs text-text-muted">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BrandMark size={20} />
            <span className="font-bold text-text">AthanorDB</span>
            <span>— Editeur de schémas DBML Open-Source Local-First</span>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <button onClick={onOpenApp} className="hover:text-text transition-colors">Éditeur Démo</button>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-text transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
