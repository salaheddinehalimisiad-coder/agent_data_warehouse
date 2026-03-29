import React, { useState } from 'react';
import { 
  Book, ChevronRight, Terminal, Database, Code, Shield, Network, 
  Zap, Play, Box, Star, ArrowRight, Bot, Search, FileText, Cpu, 
  Activity, Workflow, CheckCircle2, Cloud, HardDrive, LayoutGrid
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import ProcessDiagram from './ProcessDiagram';

const CodeBlock = ({ language, code }) => (
  <div className="my-6 rounded-xl overflow-hidden border border-zinc-700/50 shadow-2xl bg-[#0d0d12]">
    <div className="flex items-center px-4 py-2 bg-[#12121a] border-b border-zinc-800/80">
      <div className="flex gap-2">
        <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
        <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
        <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
      </div>
      <span className="ml-4 text-xs font-mono text-zinc-500 uppercase">{language}</span>
    </div>
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent', fontSize: '14px' }}
      wrapLines={true}
    >
      {code}
    </SyntaxHighlighter>
  </div>
);

const Callout = ({ type, title, children }) => {
  const styles = {
    info: "bg-blue-500/10 border-blue-500/30 text-blue-200",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-200",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
  };
  return (
    <div className={`my-6 p-5 rounded-xl border ${styles[type]} flex gap-4 items-start`}>
      <div className="mt-1">
        {type === 'info' && <Book size={20} className="text-blue-400" />}
        {type === 'warning' && <Zap size={20} className="text-amber-400" />}
        {type === 'success' && <Shield size={20} className="text-emerald-400" />}
      </div>
      <div>
        <h4 className="font-bold text-sm mb-1 uppercase tracking-wider opacity-90">{title}</h4>
        <div className="text-sm opacity-80 leading-relaxed">{children}</div>
      </div>
    </div>
  );
};

export default function DocumentationPage({ initialTab = 'intro' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const docs = [
    // INTRODUCTION
    {
      id: 'intro',
      category: 'Démarrage',
      title: 'Vue d\'Ensemble',
      icon: <Book size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-5xl font-black tracking-tight text-white mb-6">Agent Data Warehouse</h1>
          <p className="text-xl text-zinc-400 mb-8 leading-relaxed">
            Bienvenue dans la documentation officielle de la première plateforme d'intégration de données (ETL) 100% pilotée par l'Intelligence Artificielle. Un système multi-agents capable de lire, comprendre, modéliser et charger vos données de manière conceptuelle.
          </p>
          <div className="h-px w-full bg-gradient-to-r from-zinc-800 via-zinc-600 to-zinc-800 mb-10"></div>
          
          <h2 className="text-2xl font-bold text-white mb-4">Pourquoi ce paradigme ?</h2>
          <p className="text-zinc-300 leading-loose mb-6">
            Contrairement aux ETL traditionnels (Talend, Informatica) qui requièrent un paramétrage visuel manuel complexe de chaque jointure, l'approche de notre plateforme repose sur la compréhension sémantique des données par un grand modèle de langage (LLM). L'IA explore les métadonnées brutes, raisonne sur les clés primaires, et en déduit logiquement l'architecture optimale d'un Data Warehouse (Modèles en étoile ou en flocon).
          </p>

          <Callout type="info" title="Intelligence Multi-Agents (LangGraph)">
            Plutôt que d'avoir une seule IA essayant de résoudre tout le pipeline ETL d'un coup (ce qui produit inévitablement des hallucinations de code), le système est divisé en composants cognitifs séparés (Exploration, Modélisation, Critique, Génération, Auto-guérison).
          </Callout>
        </div>
      )
    },
    {
      id: 'quickstart',
      category: 'Démarrage',
      title: 'Guide d\'Installation',
      icon: <Play size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl font-black text-white mb-6">Guide de Démarrage Rapide</h1>
          <p className="text-zinc-300 mb-4">Suivez ces étapes pour configurer et lancer la plateforme ETL Agentique en local sur votre machine.</p>

          <h3 className="text-xl font-bold text-white mt-8 mb-4">1. Configuration de l'environnement</h3>
          <p className="text-zinc-400 mb-2">Créez un fichier <code>.env</code> contenant vos accès API LLM et vos credentials de base de données.</p>
          <CodeBlock language="env" code={`# Configuration API Zhipu (Modèle GLM-5)\nZHIPUAI_API_KEY=votre_cle_zhipu_ici\n\n# (Ou) Configuration Google Gemini\nGEMINI_API_KEY=votre_cle_gemini\n\n# Data Warehouse Cible (MySQL)\nDW_HOST=localhost\nDW_PORT=3306\nDW_USER=root\nDW_PASS=votre_mot_de_passe`} />

          <h3 className="text-xl font-bold text-white mt-8 mb-4">2. Serveur Backend FastAPI</h3>
          <p className="text-zinc-400 mb-2">Installez les dépendances et démarrez le gestionnaire LangGraph (serveur Uvicorn).</p>
          <CodeBlock language="bash" code={`# Installation des packages Python\npip install fastapi uvicorn langchain langchain-google-genai langchain-openai fpdf2\n\n# Lancement du serveur API sur le port 8000\nuvicorn api.server:app --host 0.0.0.0 --port 8000 --reload`} />

          <h3 className="text-xl font-bold text-white mt-8 mb-4">3. Application Frontend React</h3>
          <p className="text-zinc-400 mb-2">Dans un nouveau terminal, lancez Vite pour propulser l'interface graphique immersive.</p>
          <CodeBlock language="bash" code={`npm install\nnpm run dev`} />
          <p className="text-zinc-300 mt-4 font-bold text-emerald-400 flex items-center gap-2"><CheckCircle2 size={16} /> Parfait ! L'application tourne désormais sur http://localhost:5173</p>
        </div>
      )
    },

    // ARCHITECTURE
    {
      id: 'architecture',
      category: 'Architecture',
      title: 'Structure LangGraph',
      icon: <Network size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl font-black text-white mb-6">Architecture Cognitive Complète</h1>
          <p className="text-zinc-300 leading-loose mb-8">
            La State Machine qui orchestre les agents est construite avec LangGraph. Voici la composition du graphe d'états :
          </p>

          <h3 className="text-xl font-bold text-indigo-400 mt-8 mb-4 flex items-center gap-2">
            <LayoutGrid size={20} /> L'Objet "AgentState"
          </h3>
          <p className="text-zinc-300 mb-4">Toutes les informations circulent dans cette classe. Chaque Agent lit l'état et y insère ses propres résultats afin de le passer à l'Agent suivant.</p>
          <CodeBlock language="python" code={`class AgentState(TypedDict):\n    connection_config: Dict[str, Any]\n    metadata: str              # Résultats de l'extraction source\n    sql_ddl: str               # Le schéma MCD en étoile\n    critic_review: str         # Commentaire sur la qualité du SQL\n    messages: List[Dict]       # Fenêtre de chat pour l'utilisateur\n    is_validated: bool         # Autorisation d'exécution\n    etl_code: str              # La transformation Pentaho (.ktr XML) finale générée\n    etl_error: str             # Pile d'erreur si l'exécution Kitchen CLI échoue\n    retry_count: int           # Nombre d'essais du "Healer" (réparation XML)`} />

          <h3 className="text-xl font-bold text-emerald-400 mt-10 mb-4 flex items-center gap-2">
            <Workflow size={20} /> Boucle Auto-Réparatrice (Try-Heal)
          </h3>
          <Callout type="success" title="Feedback Loop Résiliente">
            Le point fort de cette architecture est son tolérant de panne. Si l'exécuteur ETL jette une exception (connexion rompue, doublons, contrainte de clé étrangère), un noeud conditionnel "Route_Execution" fait basculer le flux vers le Healer.
          </Callout>
          
          <CodeBlock language="python" code={`# Logiciel de Routage Conditionnel\ndef route_etl_execution(state: AgentState) -> str:\n    error = state.get("etl_error", "")\n    retry = state.get("retry_count", 0)\n    if getattr(state, "is_validated", False) is False: return END\n    \n    if not error:\n        return END\n    elif retry < 3:\n        return "healer"  # <-- L'IA répare le XML .ktr pour corriger le bug\n    else:\n        return END`} />
        </div>
      )
    },

    // LES AGENTS
    {
      id: 'agent_explorer',
      category: 'Les Multi-Agents',
      title: '1. L\'Explorateur',
      icon: <Search size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl font-black text-white mb-4">L'Agent Explorateur</h1>
          <p className="text-zinc-300 leading-relaxed mb-6">Premier maillon de la chaîne, l'Explorateur agit comme la vision de l'Intelligence Artificielle. Il se connecte physiquement aux bases de données sources (MySQL, API CSV, MongoDB) pour cartographier le terrain sans rapatrier de données lourdes.</p>
          
          <Callout type="info" title="Extraction des Métadonnées">
            L'agent effectue des requêtes du type `DESCRIBE` ou extrait les headers de fichiers plats. Il renseigne la variable de contexte `state["metadata"]` avec le typage exact de chaque colonne détectée.
          </Callout>
          
          <CodeBlock language="sql" code={`-- Ce que l'Explorateur voit :\nTABLE: facturations_prod\n- id_patient (int)\n- date_entree (datetime)\n- code_acte (varchar)\n- montant_ttc (decimal)`} />
        </div>
      )
    },
    {
      id: 'agent_modeler',
      category: 'Les Multi-Agents',
      title: '2. Le Modélisateur',
      icon: <Bot size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl font-black text-white mb-4">L'Agent Modélisateur</h1>
          <p className="text-zinc-300 leading-relaxed mb-6">Le cœur intellectuel de la plateforme. En analysant les champs extraits ('customer_name', 'sale_amount'), il en déduit l'ontologie du métier et structure un schéma en étoile (Star Schema) optimalisé pour l'analytique BI (Business Intelligence).</p>
          
          <h3 className="text-lg font-bold text-white mt-6 mb-2">Les heuristiques internes du LLM :</h3>
          <ul className="list-disc pl-6 space-y-2 text-zinc-400 mb-6">
            <li>Conversion des clés métiers (Business Keys) en Clés Substituts (Surrogate Keys).</li>
            <li>Préfixation automatique : `dim_` pour les axes d'analyse, `fact_` pour les quantifiables temporels.</li>
            <li>Création et forçage des contraintes `FOREIGN KEY`.</li>
          </ul>

          <CodeBlock language="python" code={`prompt_modeler = """\nTu es un Architecte Data Senior.\nConçois un Schéma en Étoile (Star Schema) DDL MySQL.\nSépare rigoureusement les tables de dimensions (dim_)\net les tables de faits (fact_). Garantis les contraintes.\nSource Metadata : {metadata}\n"""`} />
        </div>
      )
    },
    {
      id: 'agent_critic',
      category: 'Les Multi-Agents',
      title: '3. Le Critique',
      icon: <Shield size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl font-black text-white mb-4">L'Agent Critique (Assurance Qualité)</h1>
          <p className="text-zinc-300 leading-relaxed mb-6">Le "Bad Cop". Cet agent agit contre l'Agent Modélisateur. Sa spécialité est de rechercher activement les failles logiques dans les scripts SQL générés (Cycles de dépendances infinis, tables manquantes, incohérence de typage entre une clé primaire INT et une étrangère BIGINT).</p>
          
          <Callout type="warning" title="Audit Strict">
            Si le Critique juge le modèle conceptuel mauvais, il annote massivement le `critic_review`. Ce feedback est visible par l'utilisateur final qui gardera le contrôle total pour modifier le `sql_ddl` dans l'éditeur.
          </Callout>
        </div>
      )
    },
    {
      id: 'agent_etl',
      category: 'Les Multi-Agents',
      title: '4. Créateur Pentaho',
      icon: <Code size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl font-black text-white mb-4">EtlGeneratorAgent & Pentaho</h1>
          <p className="text-zinc-300 leading-relaxed mb-6">Il s'agit de la phase d'implémentation. Le système ne se contente pas de dessiner votre architecture : il **rédige intégralement un fichier XML de transformation Pentaho (.ktr)** prêt à être ouvert dans Spoon ou exécuté via Kitchen CLI pour charger le Data Warehouse.</p>

          <h3 className="text-xl font-bold text-white mb-4">Fonctionnalités .ktr générées :</h3>
          <ul className="list-disc pl-6 text-zinc-400 space-y-3">
             <li>Steps <code>CsvInput</code> / <code>TableInput</code> avec mapping de colonnes.</li>
             <li>Steps <code>SelectValues</code> pour le renommage et le casting de types.</li>
             <li>Steps <code>TableOutput</code> configurés pour MySQL avec truncate auto.</li>
             <li>Coordonnées GUI incluses pour un rendu visuel parfait dans Pentaho Spoon.</li>
          </ul>
        </div>
      )
    },

    // CAS D'UTILISATION (Processus Complet)
    {
      id: 'process_diagram',
      category: 'Cas d\'utilisation',
      title: 'Processus Complet (Animé)',
      icon: <Workflow size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
           <ProcessDiagram />
        </div>
      )
    },
    {
      id: 'usecase',
      category: 'Cas d\'utilisation',
      title: 'Retail E-commerce',
      icon: <Star size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl font-black text-white mb-6">Cas Pratique Numéro 1 : Retail</h1>
          <p className="text-zinc-300 leading-loose mb-6">
            Découvrez concrètement comment l'Agent modifie un modèle opérationnel "Plat" en modèle BI (Star Schema). L'exemple est un E-commerce classique ayant un dump CSV.
          </p>

          <Callout type="info" title="Familiarisation de l'Expertise">
            L'IA a besoin de distinguer une donnée 'descriptive' (City, User_Status) d'une donnée 'temporelle ou quantifiable' (Amount, Quantity). C'est ce raisonnement qui gouverne sa création des tables Dim & Fact.
          </Callout>

          {/* Graphical Pipeline SVG styled with React */}
          <div className="flex justify-center my-12 relative w-full overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/10 blur-[100px] rounded-full"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-8 bg-zinc-900/80 p-8 border border-zinc-700/50 rounded-2xl shadow-2xl backdrop-blur-xl w-full max-w-3xl">
              
              <div className="flex flex-col items-center w-32 shrink-0">
                 <div className="w-20 h-20 rounded-xl bg-zinc-800 border border-zinc-600 flex items-center justify-center text-zinc-400 shadow-inner">
                    <Database size={32} />
                 </div>
                 <span className="mt-3 text-[10px] uppercase tracking-wider font-bold text-zinc-500 text-center">Table Plate<br/>(Achats)</span>
              </div>

              <div className="hidden md:flex"><ArrowRight className="text-emerald-400 animate-pulse" size={32} /></div>
              
              <div className="flex flex-col items-center flex-1 shrink-0">
                 <div className="w-24 h-24 rounded-xl bg-indigo-900/40 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:scale-105 transition-transform cursor-pointer relative group">
                    <Bot size={40} className="group-hover:animate-bounce" />
                    <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-emerald-500 animate-ping"></div>
                 </div>
                 <span className="mt-3 text-xs font-bold text-indigo-400 animate-pulse">Agent Modélisateur en Action</span>
              </div>
              
              <div className="hidden md:flex"><ArrowRight className="text-emerald-400 animate-pulse" size={32} /></div>

              <div className="flex flex-col items-center w-32 shrink-0">
                 <div className="w-20 h-20 rounded-xl bg-emerald-900/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Network size={32} />
                 </div>
                 <span className="mt-3 text-[10px] uppercase tracking-wider font-bold text-emerald-500 text-center">Data Warehouse<br/>Étoile</span>
              </div>

            </div>
          </div>

          <h3 className="text-xl font-bold text-white mt-12 mb-4">Script DDL SQL Généré :</h3>
          <CodeBlock language="sql" code={`-- Dimension Produits\nCREATE TABLE dim_produit (\n    sk_produit BIGINT PRIMARY KEY,\n    sku_code VARCHAR(100),\n    categorie VARCHAR(255)\n);\n\n-- Fait : Table Centrale\nCREATE TABLE fact_ventes (\n    sk_vente BIGINT PRIMARY KEY,\n    sk_produit BIGINT,\n    quantite INT,\n    montant_total DECIMAL(10,2),\n    FOREIGN KEY (sk_produit) REFERENCES dim_produit(sk_produit)\n);`} />
        </div>
      )
    },
    {
      id: 'usecase_health',
      category: 'Cas d\'utilisation',
      title: 'Secteur Clinique',
      icon: <Activity size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl font-black text-white mb-6">Cas Pratique Numéro 2 : Secteur Clinique</h1>
          <p className="text-zinc-300 leading-loose mb-6">
            Pour les données d'un EHPAD ou d'un centre médical, le système démontre la puissance de son Agent Healer lorsqu'il traite des données médicales hétérogènes.
          </p>

          <Callout type="warning" title="Dépendances Circulaires Médicales">
            Lorsqu'un Acte médical réfère à l'état d'un Patient TheAgent génère parfois des boucles de Clés Étrangères (`fact_acte` -{'>'} `dim_patient` -{'>'} `dim_dossier` -{'>'} `fact_acte`).
          </Callout>

          <p className="text-zinc-300 mb-6">
            Lorsque l'Agent Exécuteur essaie de déployer le schéma SQL ou MySQL, la base de données lance une erreur d'intégrité ou d'existence. Le <strong>Healer</strong> reçoit cette erreur en brut :
          </p>

          <CodeBlock language="bash" code={`Erreur du serveur MySQL : \n[42S01] Table 'dim_patient' already exists. Le script est interrompu à la ligne 14.`} />

          <p className="text-zinc-300 mb-6">
            L'agent Healer génère alors une nouvelle version du fichier .ktr, en s'assurant :
            1. De corriger les balises XML malformées.
            2. De vérifier les noms de colonnes dans les mappings <code>SelectValues</code>.
            3. De s'assurer que les connexions JDBC sont actives.
          </p>
        </div>
      )
    },
    {
      id: 'llms',
      category: 'Support Technique',
      title: 'Support GLM-5 & Gemini',
      icon: <Cpu size={18} />,
      content: (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl font-black text-white mb-6">Moteurs LLM Adaptatifs</h1>
          <p className="text-zinc-300 leading-loose mb-6">
            La vélocité de notre Agent ETL est permise par la flexibilité du code LangChain sous-jacent. Vous pouvez utiliser le modèle Zhipu (GLM-5) ou basculer sur Gemini (Google) ou GPT-4o simplement via l'URL Base API.
          </p>
          <CodeBlock language="python" code={`# Fichier: nodes/modeler.py (Extrait)\nfrom langchain_openai import ChatOpenAI\nfrom langchain_google_genai import ChatGoogleGenerativeAI\nimport os\n\nif os.getenv("GEMINI_API_KEY"):\n    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest")\nelse:\n    # Abstraction OpenAI utilisée pour le point de terminaison ZHIPU\n    llm = ChatOpenAI(\n        model="glm-4",\n        openai_api_key=os.environ["ZHIPUAI_API_KEY"],\n        openai_api_base="https://open.bigmodel.cn/api/paas/v4/"\n    )`} />
        </div>
      )
    }
  ];

  const activeDocContent = docs.find(d => d.id === activeTab)?.content;

  // Group by category
  const categories = {};
  docs.forEach(d => {
    if(!categories[d.category]) categories[d.category] = [];
    categories[d.category].push(d);
  });

  return (
    <div className="flex h-full w-full bg-[#050505] text-white">
      {/* Sidebar Navigation */}
      <div className="w-[340px] h-full border-r border-zinc-800/80 bg-[#09090b] flex flex-col p-6 overflow-y-auto custom-scrollbar shrink-0">
        <div className="mb-10 mt-2">
           <h2 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">Documentation</h2>
           <p className="text-[13px] text-zinc-500 font-mono mt-3 leading-tight border-l-2 border-indigo-500/30 pl-3">API Complète & Manuel Technique de l'Agent Data Warehouse.</p>
        </div>

        {Object.entries(categories).map(([cat, items]) => (
          <div key={cat} className="mb-8">
            <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-4 px-2 select-none border-b border-white/5 pb-2">{cat}</h4>
            <div className="flex flex-col gap-1">
              {items.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => setActiveTab(doc.id)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-left transition-all group ${
                    activeTab === doc.id 
                      ? 'bg-gradient-to-r from-indigo-600/20 to-transparent text-white shadow-[inset_3px_0_0_0_#818cf8]' 
                      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <span className={`transition-colors duration-300 ${activeTab === doc.id ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-indigo-400/50'}`}>
                    {doc.icon}
                  </span>
                  {doc.title}
                </button>
              ))}
            </div>
          </div>
        ))}
        
        <div className="mt-8 pt-8 border-t border-zinc-800/50">
          <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-5">
            <h4 className="font-bold text-indigo-400 text-sm mb-2 flex items-center gap-2"><ArrowRight size={16}/> Besoin d'aide ?</h4>
            <p className="text-xs text-indigo-200/60 leading-relaxed mb-4">Pour générer un rapport complet, ouvrez le panneau principal et cliquez sur **RAPPORT PDF**.</p>
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 h-full overflow-y-auto custom-scrollbar scroll-smooth relative">
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none"></div>
         <div className="max-w-5xl mx-auto px-12 lg:px-20 py-16 relative z-10">
           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, scale: 0.98, y: 15 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.98, y: -15 }}
               transition={{ duration: 0.25, ease: "easeInOut" }}
             >
               {activeDocContent}
             </motion.div>
           </AnimatePresence>
         </div>
      </div>
    </div>
  );
}
