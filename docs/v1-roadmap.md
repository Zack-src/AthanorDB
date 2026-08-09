# AthanorDB — Route vers une V1 professionnelle

Audit du 2026-08-09. Objectif : identifier ce qu'il reste à construire pour que le produit soit crédible dans un usage professionnel (équipe payante, données sensibles, déploiement en prod chez un client). Organisé par les axes demandés, priorité `🔴 Critique` / `🟠 Important` / `🟡 Confort` / `⚪ Optionnel`, avec taille d'effort indicative (S/M/L/XL) et fichiers concernés. Renvoie vers [`docs/todo.md`](./todo.md) pour le détail technique déjà tracké — ce document est la vue produit/stratégique, pas la liste d'implémentation.

**Ce qui marche déjà** (pour cadrer) : édition visuelle + DBML texte synchronisées en live, collaboration CRDT (Yjs) avec reconnect auto, auth email/mot de passe + sessions + invitations + équipes + permissions granulaires, export SQL (Postgres/MySQL/MSSQL), historique/versioning, système de plugins sandboxé, backup/restore, migrations DB versionnées, CI, ~125 tests automatisés. La base technique est solide. Ce qui manque est surtout : durcissement sécurité pour un contexte pro réel, fonctionnalités attendues d'un outil payant, et un gros morceau produit absent — le lien vers une vraie base de données.

---

## 1. Sécurité 🔴

Le plus urgent avant tout usage pro — données de schéma potentiellement sensibles (structure de prod d'un client).

- ✅ **Dépendances vulnérables** — `npm audit` remontait 7 vulnérabilités (2 modérées, 5 hautes) au 2026-08-09 : `fast-uri` (host confusion via backslash — haute), `js-yaml` (DoS quadratique — haute), `nanoid` (générateur qui boucle à l'infini — haute) ont été corrigées dans la foulée de cet audit (`npm audit fix`, non-breaking, build/lint/125 tests revérifiés après). Reste `esbuild`/`vite` (modérée, dev-server uniquement) — nécessite un bump majeur Vite 8, déjà tracké séparément dans `todo.md`.
- 🔴 **Pas de mot de passe oublié en self-service** — `admin/ResetPasswordModal.tsx` n'existe que côté admin (réinitialise le mot de passe d'un autre utilisateur). Un utilisateur qui oublie son mot de passe est bloqué sans admin disponible. Pour une V1 pro (utilisateurs autonomes), c'est un blocker classique de support. **M** — nécessite un flux "mot de passe oublié" avec token à usage unique + expiration, sur le modèle de l'invitation existante (`routes/invitations.ts` est un bon gabarit).
- 🟠 **Pas de révocation de sessions / "déconnecter tous les appareils"** — `sessions` a bien un TTL et un nettoyage (`purgeExpiredSessions`), mais aucun utilisateur ne peut voir/révoquer ses propres sessions actives (appareil volé, poste partagé). **M**.
- 🟠 **Pas de 2FA/MFA** — attendu pour tout outil pro qui stocke de la structure de données client. **M-L** (TOTP simple = M ; passkeys = L).
- 🟠 **`canWrite` figé à la connexion WS** — `room.ts` fixe la permission d'écriture au moment du `join()`. Si un admin révoque l'accès d'un membre pendant qu'il a la socket ouverte, l'ancien niveau reste actif jusqu'à reconnexion. À vérifier/corriger : soit ré-évaluer périodiquement, soit forcer un `close()` de toute connexion active quand une permission change (`routes/teams.ts`/`project_teams`). **S-M**.
- 🟠 **Pas de rotation ni de scoping des clés API** — il n'y a pas de clé API du tout aujourd'hui (le champ dans `SettingsTabContent.tsx` "Billing" est un placeholder visuel non fonctionnel, cf. section 3). Si une API publique est construite (section 3), elle doit naître avec rotation + scopes + révocation. **L**, à concevoir en même temps que l'API elle-même.
- 🟠 **Pas d'audit log** — aucune trace de qui a supprimé/exporté/changé les permissions d'un projet. Attendu en entreprise (conformité, incident response). **M** — une table `audit_log` + hooks sur les routes sensibles (delete, permission change, export).
- 🟡 **Secrets en clair dans `ATHANORDB_ALLOWED_ORIGINS`/env** — pas un problème en soi, mais aucun mécanisme de secret management (Vault, etc.) n'est documenté pour un déploiement multi-instance. À documenter au minimum. **S**.
- 🟡 **Pas de limite sur le nombre de projets par utilisateur/équipe** — les limites d'entités *dans* un projet existent maintenant (Phase 12), mais rien n'empêche un compte de créer un nombre illimité de projets. **S**.
- ⚪ **Pas de scan de dépendances automatisé en CI** — `npm audit` n'est pas dans `.github/workflows/ci.yml`. Ajouter un job `npm audit --audit-level=high` (ou Dependabot/Renovate) éviterait de redécouvrir ces 7 vulnérabilités à la main. **S**.

## 2. Login & comptes 🟠

Au-delà du mot de passe oublié (ci-dessus, critique) :

- 🟠 **SSO/SAML annoncé sur la landing page mais inexistant** — la section pricing "Enterprise" que j'ai écrite promet "Authentification SSO (SAML / OIDC)". C'est du marketing sans produit derrière. Avant d'exposer cette page à de vrais prospects entreprise : soit construire un vrai SSO (OIDC via un provider comme `openid-client`, **L-XL**), soit retirer/adoucir la promesse ("SSO — sur demande" plutôt qu'affirmatif). **Ne pas laisser en l'état.**
- 🟡 **Pas d'email de bienvenue/notification** — l'invitation par email reste manuelle (lien à relayer à la main, documenté et assumé). Pas de notification "vous avez été ajouté à un projet/équipe", "quelqu'un a commenté", etc. **M**, dépend d'abord d'un vrai envoi SMTP (déjà dans `todo.md`, explicitement reporté faute d'environnement pour le vérifier).
- 🟡 **Rôles binaires seulement** (`view`/`edit`/`administrator` par projet, `is_admin` global) — pas de rôle intermédiaire type "peut inviter mais pas supprimer", pas de rôle au niveau équipe distinct du niveau projet. Suffisant pour une V1, à revisiter si des clients le demandent. **M** si besoin.
- ⚪ **Pas de "se souvenir de moi" configurable** — la session dure 30 jours fixes, pas de choix court/long à la connexion. Mineur.

## 3. Nouvelles fonctionnalités produit 🟠

Ce qui manque pour rivaliser avec dbdiagram.io / DrawSQL / Prisma Studio en usage pro :

- 🔴 **Éditeurs visuels Index/PK composites** — fait cette session (voir todo.md Phase 14), à re-mentionner ici seulement pour mémoire : ce point est **résolu**.
- 🟠 **Pas d'API publique** — aucune route documentée/stable pour intégrer AthanorDB dans un pipeline externe (CI, script de synchro). Le champ "Clé API" dans les paramètres est un placeholder visuel, pas une vraie fonctionnalité. **L**, et prérequis direct de la section 7 (déploiement automatique) et de toute intégration CI.
- 🟠 **Pas de webhooks** — aucun moyen d'être notifié (Slack, Discord, endpoint custom) qu'un schéma a changé. Utile pour des équipes qui veulent brancher AthanorDB sur leur workflow. **M**.
- 🟠 **Templates de projet** — démarrer un nouveau schéma from scratch à chaque fois ; pas de galerie de modèles (e-commerce, SaaS multi-tenant, etc.) pour accélérer l'onboarding. **M**.
- 🟠 **Comparaison inter-projets / diff visuel** — `diff.ts` calcule déjà un diff structurel entre deux états d'un même projet (utilisé pour l'historique), mais rien ne permet de comparer deux **projets différents** (ex. schéma de staging vs prod). **M**, la logique existe déjà à 80%.
- 🟡 **Recherche globale multi-projets** — chaque projet a maintenant une recherche interne (dashboard + canvas, fait cette session), mais pas de "chercher une table dans tous mes projets". **S-M**.
- 🟡 **Commentaires : pas de mentions/notifications** — `CommentThread.tsx` existe (commentaires sur table/colonne) mais pas de `@mention`, pas de notification quand on est mentionné. **M**.
- 🟡 **Pas d'export vers d'autres outils** (Prisma schema, TypeORM entities, GraphQL SDL, JSON Schema) — le système de plugins permet déjà d'ajouter ça sans toucher au cœur (cf. l'exemple SQLite déjà livré comme plugin). Bon candidat pour montrer la valeur du système de plugins plutôt qu'une feature native. **M chacun, en plugin**.
- ⚪ **Pas de mode hors-ligne/PWA** — l'app ne fonctionne pas sans connexion au serveur (contrairement à ce que suggère "Local-First" sur la landing page — le stockage est côté serveur, pas vraiment local-first au sens strict). **Incohérence à trancher** : soit corriger le message marketing, soit construire un vrai mode offline (IndexedDB + sync différée) — **XL** si on va au bout.

## 4. Amélioration visuelle / UX 🟡

- 🟠 **Rupture de cohérence visuelle landing vs app** — la landing page (refaite cette session : animations au scroll, kinetic typography, bento grid) a un niveau de finition nettement au-dessus du dashboard/éditeur (redesignés mais plus sobres). Un prospect qui clique "Commencer" après la landing atterrit sur un produit visuellement en retrait. **M**, harmoniser (au minimum : mêmes micro-interactions de base — hover states, transitions — sur les boutons/cards du dashboard et de l'éditeur).
- 🟠 **Thème clair toujours absent** — `index.css` reste 100% sombre (`color-scheme: dark`), le sélecteur de thème dans les paramètres est désactivé pour toute option non-"Obsidian" (fait cette session, honnêteté du disabled plutôt que faux bouton). Beaucoup d'environnements pro exigent un thème clair (accessibilité, préférence, contraintes d'affichage). **L** — un vrai thème clair, ce n'est pas juste inverser les couleurs, c'est retravailler contrastes/ombres/glows partout.
- 🟡 **Pas d'onboarding pour un nouvel utilisateur** — après la première connexion, aucun tour guidé/tooltip pour découvrir le canvas, les raccourcis (Ctrl+F, Ctrl+D, etc.), les plugins. **M**.
- 🟡 **Responsive mobile/tablette non traité** — le canvas React Flow + la DBML panel supposent un écran large. Probablement inutilisable en usage tactile aujourd'hui. À clarifier si c'est un objectif V1 (un outil de modélisation de schéma est rarement utilisé sur mobile — potentiellement un non-problème à assumer explicitement plutôt qu'à résoudre). **XL si à traiter, sinon documenter que c'est desktop-only.**
- 🟡 **Accessibilité (a11y) non auditée** — pas de vérification systématique du contraste, navigation clavier complète, lecteurs d'écran. Le canvas React Flow en particulier est nativement peu accessible. **M-L** pour un audit + correctifs de base (formulaires, modales, contrastes) ; le canvas lui-même restera difficile à rendre pleinement accessible.
- ⚪ **Pas d'états de chargement (skeletons)** cohérents partout — certains écrans (dashboard, éditeur) ont un flash de contenu vide avant hydratation. **S**.

## 5. Code propre / modularité 🟡

- 🟠 **Bundle principal encore volumineux** — 707 Ko brut / 222 Ko gzip pour le chunk `index` après le split déjà fait (`DbmlPanel` 467 Ko, `jspdf` 390 Ko déjà lazy). Vite avertit toujours sur la taille. **M** — découper davantage (React Flow, CodeMirror) en chunks séparés via `manualChunks`, remonter le seuil d'alerte seulement après un vrai travail de découpe, pas en le masquant.
- 🟠 **i18n incohérente** — l'app est majoritairement en français (dashboard, éditeur, cette session), mais `Login.tsx`/`AcceptInvite.tsx`/`ChangePasswordModal.tsx` restent en anglais (legacy). Pas de système d'internationalisation réel (pas de fichiers de traduction, tout est en dur). Pour une V1 pro qui vise plusieurs marchés : soit tout traduire en dur en français (cohérence immédiate, **S**), soit construire un vrai i18n (react-intl/i18next, **L**) si le multi-langue est un objectif produit.
- 🟡 **Pas de documentation API/OpenAPI** — les routes Fastify (`routes/*.ts`) n'ont pas de schéma OpenAPI généré. Fastify a un écosystème mûr pour ça (`@fastify/swagger`). Prérequis direct si une API publique est construite (section 3). **M**.
- 🟡 **Pas de Storybook / catalogue de composants** — `ui/Button.tsx`, `Card.tsx`, etc. n'ont pas de documentation visuelle isolée. Utile si l'équipe grandit. **M**, faible priorité tant que l'équipe reste petite.
- 🟡 **Couverture de tests encore partielle côté web** — 32 tests ajoutés cette session (logique pure : layout, parsing DBML, raccourcis), mais le canvas React Flow lui-même, la synchronisation Yjs bout-en-bout, et les composants React ne sont testés que manuellement. Nécessite un environnement DOM (jsdom/Playwright) volontairement pas ajouté cette session. **L**.
- ⚪ **Pas de linter de dépendances circulaires / limite de complexité cyclomatique** — rien d'alarmant observé, mais aucun outil ne le surveille en continu (`madge`, `eslint-plugin-complexity`). **S** à ajouter, faible urgence.

## 6. Plugins 🟡

Déjà bien avancé (sandbox Worker, settings, raccourcis, export du code source). Ce qu'il manque pour un écosystème pro, dans l'ordre où `todo.md` les scope déjà :

- 🟠 **Pas de partage d'un plugin à l'échelle d'une équipe** — vit dans le `localStorage` d'un seul navigateur. Une équipe ne peut pas standardiser sur un exporteur commun. **L**, implique que le serveur stocke du code tiers (question de confiance à trancher avant).
- 🟡 **Pas d'UI plugin (iframe)** — un plugin ne peut aujourd'hui que contribuer des commandes/exports/paramètres, pas un panneau visuel propre. **L**, à ne construire que si un vrai plugin en a besoin (aucun cas d'usage concret identifié à ce jour).
- 🟡 **Pas de registre/marketplace de plugins** — partager un plugin = envoyer un fichier `.js` à la main. Dépend du point de partage d'équipe ci-dessus. **L**.
- 🟡 **Plugins non testés en CI** — la logique pure (`shortcuts.ts`) l'est depuis cette session ; le runtime sandbox (Worker) et le registre (`localStorage`) ne le sont pas, faute d'environnement navigateur en CI. **M**, nécessite Playwright ou jsdom + un mock de Worker.

## 7. Lier le schéma à une vraie base de données + déploiement automatique 🔴

**C'est le plus gros morceau manquant, et le plus stratégique** — c'est ce qui transformerait AthanorDB d'un éditeur de schéma isolé en un vrai outil de gestion de cycle de vie de base de données (façon Prisma Migrate / Flyway / Liquibase, avec une couche visuelle en plus). Actuellement, tout s'arrête à "exporter du SQL" — rien ne connecte ce SQL à une base réelle.

Aucun brique de départ n'existe encore ; à concevoir en phases, chacune livrable indépendamment :

**Phase A — Connexion en lecture seule (M-L)**
- Stocker une chaîne de connexion (chiffrée at-rest — nouveau besoin crypto, jamais en clair en base) vers une base cible (Postgres/MySQL/MSSQL d'abord, cohérent avec les dialectes déjà supportés).
- Introspection : lire le schéma réel d'une base et le convertir en `Project` (le sens inverse de ce qui existe aujourd'hui). C'est exactement le "reverse-engineer from a live DB" explicitement mis de côté dans `todo.md` — "nécessite un driver DB, la gestion d'identifiants, et une vraie revue de sécurité pour accepter des chaînes de connexion arbitraires." Cette revue de sécurité est un prérequis non-négociable avant cette phase (risque SSRF si le serveur AthanorDB peut être poussé à se connecter à une adresse interne arbitraire — nécessite allowlisting réseau, timeouts, pas de résolution DNS vers des IP privées sans configuration explicite).

**Phase B — Détection de drift (M)**
- Comparer périodiquement (ou à la demande) le schéma réel de la base cible avec le schéma modélisé dans AthanorDB. `diff.ts` calcule déjà ce genre de diff structurel entre deux `Project` — il "suffit" (relativement) de faire passer l'introspection de la Phase A par le même chemin.
- Afficher le drift dans l'UI ("la base réelle a divergé du modèle sur ces 3 tables").

**Phase C — Génération de migration (L)**
- À partir du diff Phase B (ou d'un diff entre deux révisions de l'historique existant), générer les `ALTER`/`CREATE`/`DROP` nécessaires pour faire converger la base réelle vers le modèle — pas juste un export SQL complet (déjà fait), mais un **diff SQL applicable** sans perte de données existantes (ordre des opérations, gestion des colonnes qui changent de type avec données existantes, etc. — c'est la partie difficile de tout outil de migration).
- Prévisualisation obligatoire avant toute exécution — jamais d'exécution automatique sans confirmation explicite affichant le SQL exact qui va tourner.

**Phase D — Application & rollback (L-XL)**
- Exécuter la migration générée contre la base cible, avec transaction quand le dialecte le permet, et un chemin de rollback (soit une migration inverse générée, soit restauration depuis un snapshot avant application — dépend fortement du SGBD cible).
- Historique des migrations appliquées, séparé par environnement (dev/staging/prod) — nécessite le concept d'"environnement" qui n'existe pas du tout aujourd'hui (un projet = un schéma, pas un schéma × plusieurs cibles).

**Phase E — Automatisation / CI-CD (L)**
- Déclenchement via API/CLI/webhook (dépend de la section 3 — pas d'API publique aujourd'hui) pour intégrer dans un pipeline (GitHub Actions, GitLab CI) : "à chaque merge sur main, applique les migrations en attente sur staging."
- Nécessite l'API publique + les clés API scopées de la section 3, en prérequis direct.

**Risques transverses à cette section, à traiter avant même la Phase A** :
- Stocker des identifiants de connexion à des bases de production tierces est, de loin, la plus grosse surface d'attaque que le produit aurait jamais eue. Chiffrement at-rest, jamais de log des chaînes de connexion, scoping strict des permissions réseau du serveur AthanorDB, et probablement un compte SGBD dédié en lecture-seule minimum recommandé à l'utilisateur plutôt que ses identifiants admin.
- Exécuter du DDL généré automatiquement contre une base de prod sans garde-fou solide (confirmation explicite, dry-run par défaut, pas d'exécution automatique sans opt-in explicite par environnement) est le genre de fonctionnalité qui peut détruire les données d'un client en un clic malheureux. Cette section entière mérite sa propre revue de sécurité dédiée avant toute implémentation, pas seulement un audit après coup.

---

## Séquencement recommandé pour une V1

1. **Immédiat (avant tout usage réel)** : `npm audit fix` (3 CVE hautes, une commande), mot de passe oublié self-service, corriger ou retirer la promesse SSO sur la landing page.
2. **Court terme** : audit log basique, révocation de session, `canWrite` ré-évalué en live, thème clair OU décision assumée de rester sombre uniquement, harmonisation visuelle landing/app, i18n cohérente (au moins tout en français).
3. **Moyen terme** : API publique + clés API scopées (débloque webhooks, CI, et toute la section 7), 2FA, templates de projet, comparaison inter-projets.
4. **Le grand chantier** : section 7 (lien DB + déploiement), en 5 phases indépendantes, chacune avec sa propre revue de sécurité — c'est ce qui différencierait le plus AthanorDB de la concurrence (dbdiagram.io/DrawSQL n'ont pas ça), mais c'est aussi, de loin, le plus risqué si bâclé.

Rien ici n'est un blocage dur — la base (auth, permissions, CRDT, plugins, tests, CI) est déjà solide pour un usage interne/early-adopters. Le tri ci-dessus distingue ce qui bloque un usage professionnel avec de vraies données sensibles (section 1 et le premier point de la section 2) de ce qui est de la montée en gamme progressive.
