# 🏭 Agent Data Warehouse — Plateforme ETL Multi-Agents IA

> **Plateforme intelligente d'automatisation ETL** propulsée par un pipeline multi-agents LangGraph. Elle analyse vos sources de données (CSV ou SQL), conçoit automatiquement un schéma Data Warehouse OLAP *Star Schema*, génère le script ETL d'intégration, l'exécute dans MySQL et se **auto-répare** en cas d'erreur — le tout avec une interface React temps réel.

---

## 🧠 Architecture du Système

```
Source de Données (CSV / SQL)
        │
        ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  🔍 Explorer  │────▶│  🧠 Modeler   │────▶│  🛡️ Critic    │
│  Extraction   │     │  OLAP Design  │     │  QA / Review  │
│  Métadonnées  │     │  Star Schema  │     │  DDL SQL      │
└───────────────┘     └───────────────┘     └───────┬───────┘
                                                     │
                                            ┌────────▼────────┐
                                            │  👤 Human Review │
                                            │  Validation +   │
                                            │  Chat Modifier  │
                                            └────────┬────────┘
                                                     │ Validé
                                            ┌────────▼────────┐
                                            │  ⚙️ ETL Generator│
                                            │  Script ETL      │
                                            └────────┬────────┘
                                                     │
                                            ┌────────▼────────┐     ┌────────────┐
                                            │  🚀 ETL Executor │────▶│  🔧 Healer  │
                                            │  MySQL DW Load   │◀────│  AI Repair  │
                                            └─────────────────┘     └────────────┘
```

### 📦 Agents IA (LangGraph Nodes)

| Agent | Fichier | Rôle |
|-------|---------|------|
| 🔍 **Explorer** | `nodes/explorer.py` | Connexion à la source (CSV/SQL) et extraction des métadonnées |
| 🧠 **Modeler** | `nodes/modeler.py` | Génération IA du schéma OLAP Star Schema + DDL SQL |
| 🛡️ **Critic** | `nodes/critic.py` | Révision qualité du DDL : cohérence PK/FK, types de données |
| 💬 **Chat Modifier** | `nodes/chat_modifier.py` | Modification itérative du modèle via chat conversationnel |
| ⚙️ **ETL Generator** | `nodes/etl_generator.py` | Génération d'une transformation Pentaho (.ktr XML) |
| 🚀 **ETL Executor** | `nodes/etl_executor.py` | Création du schéma MySQL + exécution Kitchen CLI ou export .ktr |
| 🔧 **Healer** | `nodes/healer.py` | Auto-réparation du fichier .ktr en cas d'erreur (jusqu'à 3 tentatives) |

---

## 🤖 Moteur LLM — Sélection Automatique

Le projet utilise un **factory pattern intelligent** (`nodes/llm_factory.py`) qui sélectionne automatiquement le meilleur LLM disponible dans cet ordre de priorité :

```
1. ☁️  Modèles Cloud dans Ollama local (ex: glm-5:cloud, gpt-oss:120b-cloud)
       → Appel via http://localhost:11434 avec clé API Bearer
2. 🤖  Modèles locaux Ollama (qwen2.5-coder:7b, mistral, codellama)
       → Appel via http://localhost:11434 (gratuit, 100% local)
3. 🌐  Google Gemini API (gemini-1.5-flash)
       → Dernier recours si Ollama est inaccessible
```

> **Note :** Les modèles `glm-5:cloud` et `gpt-oss:120b-cloud` sont des modèles spéciaux configurés dans votre Ollama local et agissant comme proxy cloud. Ils sont interrogés via l'URL `localhost:11434`.

---

## 🚀 Pentaho Data Integration (Kettle)

Le système génère désormais des fichiers **.ktr** compatibles avec Pentaho :
- **Export direct** : Téléchargez le fichier `.ktr` depuis l'interface et ouvrez-le dans **Spoon**.
- **Exécution automatique** : Si `kitchen.bat` est dans votre PATH ou dans les dossiers standards, le pipeline l'exécute automatiquement.
- **Visualisation** : Le diagramme ETL est généré avec des coordonnées GUI pour une ouverture parfaite dans Spoon.

---

## 🚀 Démarrage Rapide

### Prérequis

- Python 3.10+, Node.js 18+
- [Ollama](https://ollama.com/) installé et en cours d'exécution (`ollama serve`)
- MySQL Server (local ou distant)
- Un modèle Ollama pulled (ex: `ollama pull qwen2.5-coder:7b`)

### 1. Installation Backend (Python)

```bash
# Créer et activer l'environnement virtuel
python -m venv .venv
.venv\Scripts\Activate.ps1      # Windows
source .venv/bin/activate        # Linux/Mac

# Installer les dépendances
pip install -r requirements.txt
```

### 2. Installation Frontend (React)

```bash
npm install
```

### 3. Configuration

Copier le fichier `.env.example` en `.env` et remplir vos valeurs :

```env
# Clé API Google Gemini (fallback optionnel)
GOOGLE_API_KEY=votre_cle_gemini

# Ollama (URL de votre instance locale)
OLLAMA_BASE_URL=http://localhost:11434

# Clé API pour modèles cloud dans Ollama (optionnel)
OLLAMA_API_KEY=votre_cle_api

# Nom du modèle cloud configuré dans Ollama (optionnel)
OLLAMA_CLOUD_MODEL=glm-5:cloud
```

### 4. Lancement

```bash
# Terminal 1 — Backend FastAPI
.venv\Scripts\python.exe -m uvicorn api.server:app --reload --port 8000

# Terminal 2 — Frontend React (Vite)
npm run dev
```

Ouvrir l'interface : **http://localhost:5173/**

---

## 📁 Structure du Projet

```
agent_data_warehouse/
│
├── 📄 main.py              # Définition du graph LangGraph (flux & boucles)
├── 📄 app_state.py         # Définition du State partagé entre les agents
│
├── 📁 api/
│   └── server.py           # Backend FastAPI : REST endpoints + SSE temps réel
│
├── 📁 nodes/               # Les 7 agents IA du pipeline
│   ├── explorer.py
│   ├── modeler.py
│   ├── critic.py
│   ├── chat_modifier.py
│   ├── etl_generator.py
│   ├── etl_executor.py
│   ├── healer.py
│   └── llm_factory.py      # Sélection automatique du LLM
│
├── 📁 utils/
│   └── connectors.py       # Adaptateurs CSV & SQL (Common Connectivity Layer)
│
├── 📁 uploads/             # Fichiers CSV téléversés via l'interface
│
├── 🎨 App.jsx              # Application React principale (router)
├── 🎨 LandingPage.jsx      # Page d'accueil avec présentation
├── 🎨 ConnectionModal.jsx  # Modale de configuration de la connexion source
├── 🎨 PipelineCanvas.jsx   # Visualisation du pipeline en temps réel
├── 🎨 ChatInterface.jsx    # Interface de chat avec les agents
├── 🎨 DocumentationPage.jsx
├── 🎨 ProfilePage.jsx
├── 🎨 AuthModal.jsx
│
├── 📄 requirements.txt     # Dépendances Python
├── 📄 package.json         # Dépendances Node.js
├── 📄 .env                 # Variables d'environnement (NON versionné)
└── 📄 .env.example         # Template des variables d'environnement
```

---

## 🔌 API REST Backend

L'API FastAPI est accessible sur `http://localhost:8000`.

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/start` | Démarre le pipeline IA avec la config de connexion |
| `POST` | `/api/chat` | Discute avec l'agent pour modifier le modèle ou le code ETL |
| `POST` | `/api/validate` | Valide le modèle et lance le déploiement ETL en arrière-plan |
| `POST` | `/api/execute-etl` | Réexécute manuellement l'ETL avec le script actuel |
| `GET`  | `/api/pipeline-stream` | **SSE** — Flux temps réel de l'état du pipeline |
| `GET`  | `/api/pipeline-status` | Snapshot de l'état courant |
| `POST` | `/api/upload-csv` | Upload d'un fichier CSV source |
| `GET`  | `/api/export` | Export JSON du rapport (DDL + ETL + critique) |
| `GET`  | `/api/export-pdf` | Génération d'un rapport PDF |
| `GET`  | `/api/sessions` | Liste de la session courante (mémoire) |
| `POST` | `/api/sessions/resume` | Reprendre une session précédente |
| `POST` | `/api/sessions/new` | Démarrer une nouvelle session propre |

---

## 💡 Fonctionnalités Clés

- **🔄 Human-in-the-loop** : L'utilisateur valide le modèle avant l'exécution ETL
- **💬 Chat conversationnel** : Modification du schéma OLAP ou du script ETL en langage naturel
- **🔧 Auto-guérison** : En cas d'erreur ETL, l'agent Healer corrige le code automatiquement (max 3 tentatives)
- **📡 Temps réel** : L'interface se met à jour via Server-Sent Events (SSE)
- **💾 État** : La session est maintenue en mémoire pendant l'exécution
- **📊 Sources multiples** : Compatible CSV et bases de données SQL (via SQLAlchemy)
- **📤 Export** : Rapport complet en PDF ou JSON (DDL SQL + Code ETL + Critique IA)
- **📧 Notifications** : Alertes email optionnelles en fin de pipeline (via SMTP)

---

## 🛠️ Stack Technique

| Couche | Technologie |
|--------|-------------|
| **Orchestration IA** | [LangGraph](https://github.com/langchain-ai/langgraph) |
| **LLM** | Ollama (local) / Google Gemini (fallback) |
| **Backend** | FastAPI + Uvicorn |
| **Frontend** | React 18 + Vite + Framer Motion |
| **Visualisation Pipeline** | @xyflow/react |
| **Base de données DW cible** | MySQL via SQLAlchemy + mysql-connector-python |
| **Checkpointing Sessions** | Mémoire (`langgraph.checkpoint.memory`) |
| **Données** | Pandas |

---

## 📊 Exemple de Fichier Source

Le projet inclut un fichier `ventes.csv` (1 500 lignes) pour tester le pipeline :

- **Colonnes** : `id_vente`, `date`, `client_id`, `produit`, `categorie`, `region`, `canal`, `quantite`, `prix_unitaire`, `remise_pct`, `montant_total`
- **Produits** : 10 références tech (Laptop, Souris, Clavier, Écran, etc.)
- **Période** : Année 2024 complète
- **Régions** : 8 régions françaises

---

## ⚙️ Paramètres Avancés

### Retry & Resilience

- **Quota API (429)** : Attente exponentielle automatique (5s → 10s → backoff)
- **Timeout réseau** : Retry progressif (5s → 10s → 15s)
- **Auto-guérison ETL** : Max 3 tentatives de correction IA via l'agent Healer

### Modèles Ollama Supportés (Local)

```bash
ollama pull qwen2.5-coder:7b   # Recommandé pour le code
ollama pull mistral:latest      # Bon généraliste
ollama pull codellama:latest    # Spécialisé code
```

---

*Développé avec ❤️ — Pipeline ETL entièrement automatisé par des agents IA*
