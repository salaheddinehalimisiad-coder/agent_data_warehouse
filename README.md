# 🧠 Agentic Data Warehouse (Multi-Agent System)

![Beam.ai Clone UI](https://img.shields.io/badge/UI-Beam.ai%20Clone-indigo)
![Agent Framework](https://img.shields.io/badge/LangGraph-Agentic-emerald)
![LLM API](https://img.shields.io/badge/Gemini-1.5%20Flash-blue)

Une plateforme d'ingénierie de données autonome et intelligente. Ce projet utilise une architecture **Multi-Agents (LangGraph)** pour analyser, modéliser, critiquer et générer automatiquement des pipelines ETL (SQL & PySpark) à partir de sources brutes. 

L'interface utilisateur complète est un clone esthétique et fonctionnel de *Beam.ai*, garantissant une expérience Cloud native pour l'utilisateur.

## ✨ Fonctionnalités clés

1. **Agent Explorateur** : Scanne et extrait automatiquement les métadonnées de vos données (bases SQL, fichiers CSV).
2. **Agent Modélisateur** : Conçoit intelligemment un schéma OLAP en Étoile ou Flocon avec dimension et faits.
3. **Agent Critique** : Agit comme un "Senior Data Architect" autonome : il vérifie la cohérence, l'intégrité référentielle, et les bonnes pratiques avant de valider le modèle.
4. **Chat Copilot Interactif** : Une boucle de validation logicielle (« *Human-in-the-Loop* »). Vous pouvez discuter avec le modèle DDL pour le modifier avant de valider : l'I.A. corrige le code, et l'Agent Critique ré-évalue le résultat automatiquement.
5. **Génération ETL / PySpark** : Une fois le schéma validé visuellement, l'Agent génère le script Python PySpark final.
6. **Exécuteur (Data Warehouse Physique)** : Le pipeline écrit automatiquement et configure nativement les tables dans une cible finale (ex: *MySQL*).
7. **Agent Healer** : *Auto-réparation SRE*. En cas de plantage d'une requête SQL ou d'une API, cet agent corrige et relance l'étape.

## 🛠️ Stack Technique

* **Frontend** : React.js, TailwindCSS (glassmorphism UI), Framer Motion, Lucide-React, React-Flow (Pipeline Canvas)
* **Backend** : FastAPI, Python 3.12, LangChain, LangGraph StateGraph
* **AI Model** : Google Gemini-1.5-Flash (par défaut, configurable sur *Ollama Local* avec `ChatOllama` - ex: *qwen2.5-coder:7b* pour un fonctionnement hors-ligne).

## 🚀 Démarrage rapide

### 1. Pré-requis
* Node.js installé (v18+)
* Python (v3.10+) installé
* Un compte Google AI Studio (Pour la Clé API `GEMINI_API_KEY`) ou Ollama fonctionnel.

### 2. Configuration Backend
Copiez le fichier d'environnement et lancez l'API Python :
```bash
# S'assurer d'être dans le bon dossier
python -m venv .venv
# (Windows) .venv\Scripts\activate 
# (Mac/Linux) source .venv/bin/activate

pip install -r requirements.txt
uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload
```

> ⚠️ N'oubliez pas de configurer votre clé API dans le `.env` à la racine : 
> `GEMINI_API_KEY="AIzaSy..."`

### 3. Configuration Frontend
Ouvrez un second terminal pour le client Vite React :
```bash
npm install
npm run dev
```

Rendez-vous sur `http://localhost:5173/` dans votre navigateur Web pour piloter la modélisation intelligente !

## 📂 Export et Intégration

Vous pouvez cliquer sur **"EXPORTER RAPPORT (TXT)"** dans la plateforme pour télécharger un résumé local de tout votre pipeline. Un fichier local `resume_architecture.txt` et un log détaillé `pipeline.log` sont tenus prêts pour auditer les actions autonomes des bots.
