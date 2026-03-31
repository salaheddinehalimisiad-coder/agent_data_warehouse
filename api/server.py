from langchain_google_genai import ChatGoogleGenerativeAI
# Fichier : api/server.py

from fastapi import FastAPI, Request, File, UploadFile, BackgroundTasks
import shutil
import os
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, AsyncGenerator
import uuid, asyncio, json, time
from dotenv import load_dotenv

load_dotenv()
import logging
from main import create_agent_workflow

logging.basicConfig(filename='pipeline.log', level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Data Warehouse AI Agent API",
    description="API de conception assistée et ETL automatisé",
    version="2.0"
)

import datetime

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://localhost:5173","http://127.0.0.1:5173",
                   "http://localhost:5174","http://127.0.0.1:5174","http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── LangGraph agent ───────────────────────────────────────────────────────────
agent_app = create_agent_workflow()
current_session_id = "session_dw_1"

def get_config(session_id: str = None):
    sid = session_id or current_session_id
    return {"configurable": {"thread_id": sid}}

import mysql.connector

META_DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
META_DB_PORT = int(os.getenv("DB_PORT", "3306"))
META_DB_USER = os.getenv("DB_USER", "root")
META_DB_PASS = os.getenv("DB_PASSWORD", "23102802Sd;")
META_DB_NAME = "agent_metadata"

def _get_db_connection():
    try:
        import mysql.connector
        return mysql.connector.connect(host=META_DB_HOST, port=META_DB_PORT, user=META_DB_USER, password=META_DB_PASS, database=META_DB_NAME)
    except:
        return None

def _init_metadata_db():
    try:
        # 1. Base des métadonnées utilisateurs et sessions
        c = mysql.connector.connect(host=META_DB_HOST, port=META_DB_PORT, user=META_DB_USER, password=META_DB_PASS)
        cur = c.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{META_DB_NAME}` CHARACTER SET utf8mb4;")
        
        # 2. Base d'entrepôt de données UNIQUE demandée par l'utilisateur
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `data_warehouse` CHARACTER SET utf8mb4;")
        c.commit()
        cur.close()
        c.close()
        
        c = mysql.connector.connect(host=META_DB_HOST, port=META_DB_PORT, user=META_DB_USER, password=META_DB_PASS, database=META_DB_NAME)
        cur = c.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(500) NOT NULL,
                role VARCHAR(50) DEFAULT 'Data Analyst',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS agent_sessions (
                session_id VARCHAR(255) PRIMARY KEY,
                state_data JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                user_id INT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        try:
            # Migration si la table existe déjà sans user_id
            cursor_test = c.cursor()
            cursor_test.execute("ALTER TABLE agent_sessions ADD COLUMN user_id INT NULL;")
            cursor_test.execute("ALTER TABLE agent_sessions ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;")
            cursor_test.close()
        except Exception:
            pass # Déjà existant
            
        c.commit()
        cur.close()
        c.close()
    except Exception as e:
        print(f"⚠️ Erreur d'initialisation de la BD Session (MySQL): {e}")

_init_metadata_db()

def _save_session_state(session_id, state_values, user_id=None):
    try:
        c = mysql.connector.connect(host=META_DB_HOST, port=META_DB_PORT, user=META_DB_USER, password=META_DB_PASS, database=META_DB_NAME)
        cur = c.cursor()
        
        clean_state = {}
        for k, v in state_values.items():
            if k == 'messages':
                # `messages` peut contenir soit des objets LangChain (avec `.type`/`.content`)
                # soit des dicts simples (ex: branch chat SQL : {"role": "...", "content": "..."}).
                normalized = []
                for m in v:
                    if isinstance(m, dict):
                        normalized.append({
                            "role": m.get("role") or m.get("type") or "human",
                            "content": m.get("content") or "",
                        })
                    else:
                        normalized.append({
                            "role": getattr(m, "type", "human"),
                            "content": getattr(m, "content", "") or "",
                        })
                clean_state[k] = normalized
            else:
                clean_state[k] = v
                
        state_json = json.dumps(clean_state)
        if user_id:
            cur.execute("""
                INSERT INTO agent_sessions (session_id, state_data, user_id) 
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE state_data = %s, user_id = %s
            """, (session_id, state_json, user_id, state_json, user_id))
        else:
            cur.execute("""
                INSERT INTO agent_sessions (session_id, state_data) 
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE state_data = %s
            """, (session_id, state_json, state_json))
        c.commit()
        cur.close()
        c.close()
    except Exception as e:
        print(f"⚠️ Erreur lors de la sauvegarde de session: {e}")

def _load_session_state(session_id):
    try:
        c = mysql.connector.connect(host=META_DB_HOST, port=META_DB_PORT, user=META_DB_USER, password=META_DB_PASS, database=META_DB_NAME)
        cur = c.cursor()
        cur.execute("SELECT state_data FROM agent_sessions WHERE session_id = %s", (session_id,))
        row = cur.fetchone()
        cur.close()
        c.close()
        if row and row[0]:
            data = json.loads(row[0])
            from langchain_core.messages import HumanMessage, AIMessage
            if 'messages' in data:
                reconstructed = []
                for m in data['messages']:
                    if m['role'] == 'bot' or m['role'] == 'ai':
                        reconstructed.append(AIMessage(content=m['content']))
                    else:
                        reconstructed.append(HumanMessage(content=m['content']))
                data['messages'] = reconstructed
            return data
    except Exception as e:
        print(f"⚠️ Erreur lors du chargement de session: {e}")
    return None


# ── Pipeline State (partagé entre les routes et le SSE) ───────────────────────
# ── Pipeline State (isolé par session_id) ──────────────────────────────────
STAGES = [
    {"id": "explorer",   "label": "🔍 Exploration",          "status": "idle"},
    {"id": "modeler",    "label": "🧠 Modélisation IA",       "status": "idle"},
    {"id": "critic",     "label": "🛡️ Agent Critique",       "status": "idle"},
    {"id": "human",      "label": "👤 Validation Humaine",    "status": "idle"},
    {"id": "etl_gen",    "label": "⚙️ Génération ETL",        "status": "idle"},
    {"id": "etl_exec",   "label": "🚀 Exécution MySQL",       "status": "idle"},
    {"id": "healer",     "label": "🔧 Auto-Guérison",         "status": "idle"},
]

# État global indexé par session_id
sessions_state: dict[str, dict] = {}
# Clients SSE indexés par session_id
sessions_sse_clients: dict[str, list[asyncio.Queue]] = {}


def _get_pipeline_state(session_id: str) -> dict:
    if session_id not in sessions_state:
        sessions_state[session_id] = {
            "run_id":    uuid.uuid4().hex[:8],
            "status":    "idle",
            "stages":    [s.copy() for s in STAGES],
            "started_at": None,
            "ended_at":  None,
            "logs":      [],
        }
    return sessions_state[session_id]


def _reset_pipeline(session_id: str):
    state = _get_pipeline_state(session_id)
    state["run_id"]     = uuid.uuid4().hex[:8]
    state["status"]     = "running"
    state["stages"]     = [s.copy() for s in STAGES]
    state["started_at"] = time.time()
    state["ended_at"]   = None
    state["logs"]       = []


def _set_stage(session_id: str, stage_id: str, status: str, detail: str = ""):
    state = _get_pipeline_state(session_id)
    for s in state["stages"]:
        if s["id"] == stage_id:
            s["status"] = status
            s["detail"] = detail
    _broadcast(session_id)


def _broadcast(session_id: str):
    """Envoie l'état courant à tous les clients abonnés à cette session."""
    state = _get_pipeline_state(session_id)
    msg = json.dumps(state)
    
    if session_id not in sessions_sse_clients:
        return
        
    dead = []
    for q in sessions_sse_clients[session_id]:
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        sessions_sse_clients[session_id].remove(q)


def _log(session_id: str, msg: str):
    logging.info(f"[{session_id}] {msg}")
    state = _get_pipeline_state(session_id)
    start_time = state["started_at"] or time.time()
    state["logs"].append({"t": round(time.time() - start_time, 1), "msg": msg})
    _broadcast(session_id)


# ── Pydantic schemas ──────────────────────────────────────────────────────────
from typing import Optional

class ConnectionRequest(BaseModel):
    source_type: str
    file_path: Optional[str]         = None
    dw_host:     str  = "127.0.0.1"
    dw_port:     int  = 3306
    dw_user:     str  = "root"
    dw_password: str  = ""
    dw_database: str  = "data_warehouse"
    user_id: Optional[int] = None

class ChatRequest(BaseModel):
    message: str
    context: str = "sql"  # 'sql' ou 'etl'

class RegisterInitRequest(BaseModel):
    email: str
    name: str

class RegisterVerifyRequest(BaseModel):
    email: str
    code: str

PENDING_VERIFICATIONS = {}


# ── SSE endpoint ──────────────────────────────────────────────────────────────
@app.get("/api/pipeline-stream")
async def pipeline_stream(request: Request, session_id: str = "session_dw_1"):
    """Endpoint SSE – le frontend s'y abonne pour recevoir les mises à jour en temps réel."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=50)
    
    if session_id not in sessions_sse_clients:
        sessions_sse_clients[session_id] = []
    sessions_sse_clients[session_id].append(queue)

    state = _get_pipeline_state(session_id)

    async def event_generator() -> AsyncGenerator[str, None]:
        # Envoyer l'état actuel immédiatement à la connexion
        yield f"data: {json.dumps(state)}\n\n"
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"   # keepalive
        finally:
            if session_id in sessions_sse_clients and queue in sessions_sse_clients[session_id]:
                sessions_sse_clients[session_id].remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/pipeline-status")
def pipeline_status(session_id: str = "session_dw_1"):
    """Snapshot immédiat de l'état du pipeline (polling fallback)."""
    return _get_pipeline_state(session_id)


@app.get("/api/llm-status")
def llm_status():
    """Retourne le LLM actuellement utilisé (Ollama cloud, local ou Gemini)."""
    import requests as req_lib
    import os

    ollama_url    = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_key    = os.getenv("OLLAMA_API_KEY", "")
    cloud_model   = os.getenv("OLLAMA_CLOUD_MODEL", "glm-5:cloud")
    gemini_key    = os.getenv("GOOGLE_API_KEY", "")

    # Tester si Ollama tourne
    try:
        headers = {}
        if ollama_key:
            headers["Authorization"] = f"Bearer {ollama_key}"
        r = req_lib.get(f"{ollama_url}/api/tags", headers=headers, timeout=3)
        if r.status_code == 200:
            available = [m["name"] for m in r.json().get("models", [])]
            # Chercher le modèle cloud configuré
            cloud_match = next((m for m in available if cloud_model.split(":")[0] in m), None)
            if cloud_match:
                return {"status": "cloud_ollama", "model": cloud_match, "url": ollama_url, "models": available}
            # Chercher d'autres modèles cloud
            cloud_any = next((m for m in available if "cloud" in m.lower()), None)
            if cloud_any:
                return {"status": "cloud_ollama", "model": cloud_any, "url": ollama_url, "models": available}
            # Modèle local
            if available:
                return {"status": "local_ollama", "model": available[0], "url": ollama_url, "models": available}
    except Exception:
        pass

    # Gemini fallback
    if gemini_key:
        return {"status": "gemini", "model": "gemini-1.5-flash", "url": "https://generativelanguage.googleapis.com", "models": []}

    return {"status": "unavailable", "model": None, "url": None, "models": []}


@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Enregistre un fichier CSV ou Excel envoyé par le frontend."""
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
        
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"status": "success", "file_path": file_path, "filename": file.filename}


# ── /api/start ────────────────────────────────────────────────────────────────
@app.post("/api/start")
async def start_process(req: ConnectionRequest, session_id: str = "session_dw_1"):
    sid = session_id
    # FORCE SINGLE DATABASE MODE
    req.dw_database = "data_warehouse"
    user_prefix = f"u{req.user_id}_" if req.user_id else "guest_"

    _reset_pipeline(sid)
    _broadcast(sid)

    # Auto-créer la base MySQL si besoin
    try:
        import mysql.connector
        c = mysql.connector.connect(host=req.dw_host, port=req.dw_port,
                                    user=req.dw_user, password=req.dw_password)
        cur = c.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{req.dw_database}` "
                    f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        c.commit(); cur.close(); c.close()
        _log(sid, f"Base de données unique '{req.dw_database}' prête (préfixe: {user_prefix}).")
    except Exception as e:
        _get_pipeline_state(sid)["status"] = "failed"
        _broadcast(sid)
        return {"status": "failed",
                "message": f"Connexion MySQL impossible : {str(e)}"}

    initial_state = {
        "user_id": req.user_id,
        "session_id": sid,
        "user_prefix": user_prefix,
        "connection_config":    {"type": req.source_type,
                                 "file_path": req.file_path},
        "dw_connection_config": {"host": req.dw_host, "port": req.dw_port,
                                 "user": req.dw_user, "password": req.dw_password,
                                 "database": req.dw_database},
    }

    config = get_config(sid)

    try:
        _set_stage(sid, "explorer", "running")
        _log(sid, "Démarrage de l'extraction de la source…")

        for event in agent_app.stream(initial_state, config=config):
            node = list(event.keys())[0] if event else None
            # LangGraph node ids are the keys used in `add_node(...)` inside main.py.
            # Keep backward-compatibility for older event naming.
            if node in ("explorer", "explorer_node"):
                _set_stage(sid, "explorer", "success", "Métadonnées extraites")
                _set_stage(sid, "modeler",  "running")
                _log(sid, "Modélisation OLAP en cours…")
            elif node in ("modeler", "modeler_node"):
                _set_stage(sid, "modeler", "success", "Schéma généré")
                _set_stage(sid, "critic", "running")
                _log(sid, "Agent Critique analyse la conformité...")
            elif node in ("critic", "critic_node"):
                _set_stage(sid, "critic", "success", "Revue terminée")
                _set_stage(sid, "human",   "running")
                _log(sid, "En attente de validation humaine...")

        current_state = agent_app.get_state(config).values
        _save_session_state(sid, current_state)
        
        _set_stage(sid, "explorer", "success")
        _set_stage(sid, "modeler",  "success")
        _set_stage(sid, "critic",   "success")
        _set_stage(sid, "human", "running", "En attente de votre validation")
        _log(sid, "Modèle prêt — validez pour lancer l'ETL.")
        _broadcast(sid)

        return {"status": "waiting_for_review",
                "sql_ddl": current_state.get("sql_ddl", ""),
                "critic_review": current_state.get("critic_review", ""),
                "logical_model": current_state.get("logical_model", None),
                "message": "Modèle généré avec succès."}

    except Exception as e:
        _get_pipeline_state(sid)["status"] = "failed"
        _set_stage(sid, "explorer", "failed", str(e))
        _broadcast(sid)
        return {"status": "failed", "message": f"Erreur: {str(e)}"}


# ── /api/chat ─────────────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat_with_agent(req: ChatRequest, session_id: str = "session_dw_1"):
    sid = session_id
    try:
        config = get_config(sid)
        state_snapshot = agent_app.get_state(config)
        current_state = state_snapshot.values if state_snapshot else {}

        if req.context == "etl":
            # Modification spécifique du script ETL
            from langchain_core.prompts import ChatPromptTemplate
                        
            current_etl_code = current_state.get("etl_code", "")
            if not current_etl_code:
                _log(sid, "⚠️ Erreur Chat : Aucun script ETL trouvé dans la session actuelle.")
                return {"status": "error", "message": "Aucun script ETL à modifier. Veuillez relancer un pipeline."}
                
            from nodes.llm_factory import get_llm, call_with_retry
            llm = get_llm(temperature=0)
            prompt = ChatPromptTemplate.from_messages([
                ("system", """Tu es un expert en intégration de données.
Voici le script ETL actuel:

{current_etl_code}

L'utilisateur te demande une modification précise. Renvoie UNIQUEMENT le code complet et modifié, sans aucune explication markdown."""),
                ("human", "{user_request}")
            ])
            chain = prompt | llm
            
            _log(sid, f"Agent ETL (Chat) : modification du script ETL demandée...")
            _broadcast(sid)
            
            response = call_with_retry(chain, {"current_etl_code": current_etl_code, "user_request": req.message})
            
            # Gestion robuste du contenu
            raw_content = response.content
            if isinstance(raw_content, list):
                text_parts = []
                for part in raw_content:
                    if isinstance(part, dict) and "text" in part:
                        text_parts.append(part["text"])
                    else:
                        text_parts.append(str(part))
                full_text = "".join(text_parts)
            else:
                full_text = str(raw_content)

            # Nettoyage propre du code Markdown
            clean_code = full_text.replace("```python", "").replace("```python", "").replace("```", "").strip()
            
            # Mettre à jour l'état LangGraph avec le nouveau script
            agent_app.update_state(config, {"etl_code": clean_code})
            _save_session_state(config["configurable"]["thread_id"], agent_app.get_state(config).values)
            
            _log(sid, f"Script ETL mis à jour avec succès via le chat.")
            _broadcast(sid)
            return {"status": "waiting_for_review", "etl_code": clean_code}
        
        else:
            # Modification du modèle logique SQL
            if not current_state:
                 return {"status": "error", "message": "Session expirée ou introuvable. Veuillez re-générer un modèle."}

            # Important : forcer une re-validation.
            # Sinon, si la session a déjà été validée (is_validated=True),
            # le graphe peut enchaîner directement vers la génération/exécution ETL
            # au lieu de repasser par le point d'interruption human_review.
            agent_app.update_state(config, {
                "is_validated": False,
                "messages": [{"role": "user", "content": req.message}]
            })
            for event in agent_app.stream(None, config=config):
                pass
            
            new_state = agent_app.get_state(config).values
            _save_session_state(config["configurable"]["thread_id"], new_state)
            
            return {
                "status": "waiting_for_review", 
                "sql_ddl": new_state.get("sql_ddl", ""),
                "critic_review": new_state.get("critic_review", "")
            }

    except Exception as e:
        import traceback
        traceback.print_exc()
        _log(f"❌ Erreur critique dans le Chat : {str(e)}")
        return {"status": "error", "message": str(e)}


# ── /api/validate ─────────────────────────────────────────────────────────────

def run_etl_pipeline(req: Optional[ConnectionRequest], config: dict):
    sid = config["configurable"]["thread_id"]
    state = _get_pipeline_state(sid)
    try:
        agent_app.update_state(config, {"is_validated": True})

        for event in agent_app.stream(None, config=config):
            node = list(event.keys())[0] if event else None
            if node == "etl_generator":
                _set_stage(sid, "human", "success", "Validation reçue")
                _set_stage(sid, "etl_gen",  "success", "Script ETL généré")
                state["etl_code_used"] = agent_app.get_state(config).values.get("etl_code", "")
                _set_stage(sid, "etl_exec", "running")
                _log(sid, "Exécution ETL → MySQL…")
            elif node == "etl_executor":
                pass
            elif node == "healer":
                _set_stage(sid, "healer", "running", "Correction automatique en cours…")
                _log(sid, "Agent Healer activé…")
                
            _broadcast(sid)

        current_state = agent_app.get_state(config).values
        error = current_state.get("etl_error", "")

        if error:
            _set_stage(sid, "etl_exec", "failed", "Échec après tentatives")
            _set_stage(sid, "healer",   "failed", error[:80])
            state["status"] = "failed"
            state["ended_at"] = time.time()
            _broadcast(sid)
            _send_notification("❌ ETL échoué", error, req.notify_email if req else None)
            return

        _set_stage(sid, "etl_exec", "success", "Tables créées dans MySQL")
        state["status"] = "success"
        state["ended_at"] = time.time()
        state["etl_code_used"] = current_state.get("etl_code", "")
        
        _save_session_state(sid, agent_app.get_state(config).values)
        
        _log(sid, "✅ Data Warehouse opérationnel !")
        _broadcast(sid)
        
        # Fake email send notification logic to prevent errors if req missing
        try:
            if req and hasattr(req, "notify_email") and req.notify_email:
                pass
        except:
            pass

    except Exception as e:
        import traceback; traceback.print_exc()
        state["status"] = "failed"
        state["ended_at"] = time.time()
        _broadcast(sid)

def re_execute_etl_pipeline(config: dict):
    from nodes.etl_executor import etl_executor_node
    sid = config["configurable"]["thread_id"]
    state = _get_pipeline_state(sid)
    try:
        _set_stage(sid, "etl_exec", "running", "Réexécution demandée par l'utilisateur…")
        _log(sid, "Lancement manuel de l'exécuteur ETL…")
        _broadcast(sid)
        
        current_state = agent_app.get_state(config).values
        result = etl_executor_node(current_state)
        agent_app.update_state(config, result)
        
        if result.get("etl_error"):
            _set_stage(sid, "etl_exec", "failed", result["etl_error"][:80])
            state["status"] = "failed"
            _log(sid, f"Échec de l'exécution manuelle: {result['etl_error'][:80]}")
        else:
            _set_stage(sid, "etl_exec", "success", "Tables créées dans MySQL (Custom)")
            state["status"] = "success"
            state["ended_at"] = time.time()
            _log(sid, "✅ Data Warehouse personnalisé opérationnel !")
            
        _save_session_state(sid, agent_app.get_state(config).values)
        _broadcast(sid)
    except Exception as e:
        state["status"] = "failed"
        _broadcast(sid)


@app.post("/api/validate")
async def validate_and_deploy(background_tasks: BackgroundTasks, req: Optional[ConnectionRequest] = None, session_id: str = "session_dw_1"):
    sid = session_id
    config = get_config(sid)

    _set_stage(sid, "human",    "success", "Modèle approuvé")
    _set_stage(sid, "etl_gen",  "running")
    _log(sid, "Génération du script ETL en cours (tâche de fond)…")
    _broadcast(sid)

    background_tasks.add_task(run_etl_pipeline, req, config)

    return {"status": "background",
            "message": "Le pipeline d'intégration a démarré en tâche de fond. Suivez la progression !"}

@app.post("/api/execute-etl")
async def execute_etl_custom(background_tasks: BackgroundTasks, session_id: str = "session_dw_1"):
    sid = session_id
    config = get_config(sid)
    _set_stage(sid, "etl_gen", "success", "Script manuel validé")
    _get_pipeline_state(sid)["status"] = "running"
    _broadcast(sid)
    background_tasks.add_task(re_execute_etl_pipeline, config)
    return {"status": "background", "message": "Réexécution du pipeline lancée en arrière-plan !"}

@app.get("/api/sessions")
def get_history_sessions(user_id: int = None):
    """Retourne l'historique des sessions depuis MySQL."""
    global current_session_id
    sessions = []
    try:
        import mysql.connector
        c = mysql.connector.connect(host=META_DB_HOST, port=META_DB_PORT, user=META_DB_USER, password=META_DB_PASS, database=META_DB_NAME)
        cur = c.cursor()
        if user_id:
            cur.execute("SELECT session_id, updated_at FROM agent_sessions WHERE user_id = %s ORDER BY updated_at DESC LIMIT 20", (user_id,))
            rows = cur.fetchall()
        else:
            rows = []
        for r in rows:
            sessions.append({
                "id": r[0],
                "name": f"Session DW ({r[0][-6:]})",
                "updated_at": r[1].isoformat() if r[1] else ""
            })
        cur.close()
        c.close()
    except Exception as e:
        print(f"Erreur chargement liste sessions: {e}")
        sessions = [{"id": current_session_id, "name": f"Session Active ({current_session_id})", "updated_at": datetime.datetime.now().isoformat()}]
    return {"sessions": sessions}

class ResumeRequest(BaseModel):
    session_id: str

@app.post("/api/sessions/resume")
async def resume_session_endpoint(req: ResumeRequest):
    global current_session_id
    tid = req.session_id
    if tid:
        current_session_id = tid
        config = get_config()
        
        # Load from MySQL
        loaded_state = _load_session_state(tid)
        if loaded_state:
            agent_app.update_state(config, loaded_state)
            
        state_snapshot = agent_app.get_state(config)
        current_state = state_snapshot.values if state_snapshot else {}
        messages = current_state.get("messages", [])
        msgs = [{"role": getattr(m, "type", "human"), "content": m.content} for m in messages] if messages else []
        return {
            "status": "success",
            "sql_ddl": current_state.get("sql_ddl", ""),
            "etl_code": current_state.get("etl_code", ""),
            "critic_review": current_state.get("critic_review", ""),
            "logical_model": current_state.get("logical_model", None),
            "messages": msgs
        }
    return {"status": "error"}

class NewSessionRequest(BaseModel):
    user_id: int = None

@app.post("/api/sessions/new")
def new_session_endpoint(req: NewSessionRequest = None):
    global current_session_id
    uid = req.user_id if req else None
    current_session_id = f"session_dw_{uuid.uuid4().hex[:8]}"
    _save_session_state(current_session_id, {}, user_id=uid)
    return {"status": "success", "session_id": current_session_id}

# --- AUTHENTICATION ---
import hashlib
import os
import binascii

def hash_password(password: str) -> str:
    salt = hashlib.sha256(os.urandom(60)).hexdigest().encode('ascii')
    pwdhash = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt, 100000)
    pwdhash = binascii.hexlify(pwdhash)
    return (salt + pwdhash).decode('ascii')

def verify_password(password: str, hashed_password: str) -> bool:
    salt = hashed_password[:64].encode('ascii')
    pwdhash = hashed_password[64:]
    pwdhash_check = hashlib.pbkdf2_hmac('sha512', password.encode('utf-8'), salt, 100000)
    pwdhash_check = binascii.hexlify(pwdhash_check).decode('ascii')
    return pwdhash == pwdhash_check

pending_verifications = {}

class AuthRegisterInitRequest(BaseModel):
    name: str
    email: str

@app.post("/api/auth/register-init")
def register_init(req: AuthRegisterInitRequest):
    try:
        conn = _get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = %s", (req.email,))
            if cursor.fetchone():
                return {"status": "error", "message": "Cet email est déjà utilisé."}
            cursor.close()
            conn.close()
            
        import random
        code = str(random.randint(100000, 999999))
        pending_verifications[req.email] = code
        
        subject = "Votre code de vérification - Agentic ETL"
        html_body = f"""
        <html>
        <body style="font-family: 'Inter', Arial, sans-serif; background-color: #0f1117; color: #e2e8f0; padding: 0; margin: 0;">
          <div style="max-width: 560px; margin: 40px auto; background: #1a1f2e; border-radius: 16px; overflow: hidden; border: 1px solid #2d3748;">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">🔐 Agentic ETL</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Plateforme d'Intelligence Data</p>
            </div>
            <div style="padding: 40px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #94a3b8;">Bonjour <strong style="color: #e2e8f0;">{req.name}</strong>,</p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #94a3b8; line-height: 1.6;">
                Merci de rejoindre <strong style="color: #e2e8f0;">Agentic ETL</strong>. Voici votre code de vérification à 6 chiffres :
              </p>
              <div style="background: #0f1117; border: 2px solid #6366f1; border-radius: 12px; padding: 28px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px; font-size: 12px; color: #6366f1; letter-spacing: 2px; text-transform: uppercase;">CODE DE VÉRIFICATION</p>
                <p style="margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #ffffff; font-family: 'Courier New', monospace;">{code}</p>
              </div>
            </div>
          </div>
        </body>
        </html>
        """
        
        # Envoi via la fonction unifiée
        _send_notification(subject, html_body, req.email)
        
        print(f"\n{'='*60}")
        print(f"📧 EMAIL DE VÉRIFICATION")
        print(f"   Destinataire : {req.email}")
        print(f"   Nom          : {req.name}")
        print(f"   CODE         : {code}")
        print(f"{'='*60}\n")
        
        return {"status": "success", "message": "Code généré et envoyé."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class AuthRegisterVerifyRequest(BaseModel):
    email: str
    name: str
    password: str
    code: str

@app.post("/api/auth/register-verify")
def register_verify(req: AuthRegisterVerifyRequest):
    if pending_verifications.get(req.email) != req.code:
        return {"status": "error", "message": "Le code de vérification est incorrect ou a expiré."}
        
    try:
        conn = _get_db_connection()
        if not conn: return {"status": "error", "message": "Database error"}
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT id FROM users WHERE email = %s", (req.email,))
        if cursor.fetchone():
            return {"status": "error", "message": "Cet email est déjà utilisé."}
            
        hashed_pw = hash_password(req.password)
        cursor.execute("INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)", 
                       (req.name, req.email, hashed_pw))
        conn.commit()
        user_id = cursor.lastrowid
        cursor.close()
        conn.close()
        
        if req.email in pending_verifications:
            del pending_verifications[req.email]
            
        return {"status": "success", "user": {"id": user_id, "name": req.name, "email": req.email, "role": "Data Analyst"}}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class AuthLoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/login")
def login_user(req: AuthLoginRequest):
    try:
        conn = _get_db_connection()
        if not conn: return {"status": "error", "message": "Database error"}
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT id, name, email, password_hash, role FROM users WHERE email = %s", (req.email,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not user or not verify_password(req.password, user['password_hash']):
            return {"status": "error", "message": "Email ou mot de passe incorrect."}
            
        return {"status": "success", "user": {"id": user['id'], "name": user['name'], "email": user['email'], "role": user['role']}}
    except Exception as e:
        return {"status": "error", "message": str(e)}


class QueryRequest(BaseModel):
    query: str
    dw_host: str = "127.0.0.1"
    dw_port: int = 3306
    dw_user: str = "root"
    dw_password: str = ""
    dw_database: str = "data_warehouse"
    session_id: Optional[str] = None

@app.post("/api/query")
def execute_query(req: QueryRequest):
    try:
        import mysql.connector
        import re
        
        # Security: Allow only SELECT
        if not req.query.strip().lower().startswith("select"):
            return {"status": "error", "message": "Seules les requêtes SELECT sont autorisées pour des raisons de sécurité."}
            
        q = req.query
        
        # Auto-prefixer : Si on connait la session, on peut aider l'utilisateur
        if req.session_id:
            state = _get_pipeline_state(req.session_id)
            # On cherche le préfixe dans l'état (ou on le recalcule s'il est loggé)
            # Pour l'instant on va tenter une approche par session_state si chargée
            config = get_config(req.session_id)
            current_vals = agent_app.get_state(config).values
            user_prefix = current_vals.get("user_prefix", "")
            
            if user_prefix:
                # Regex simple pour trouver les noms de tables après FROM ou JOIN
                # On évite de préfixer ce qui l'est déjà
                def prefix_replacer(match):
                    tbl = match.group(2)
                    if tbl.startswith(user_prefix) or tbl.lower() in ["information_schema", "mysql"]:
                        return match.group(0)
                    return f"{match.group(1)}{user_prefix}{tbl}"
                
                q = re.sub(r'(FROM|JOIN)\s+([a-zA-Z0-9_]+)', prefix_replacer, q, flags=re.IGNORECASE)

        if "limit" not in q.lower():
            q = q.rstrip(';').rstrip() + " LIMIT 100;"

        c = mysql.connector.connect(
            host=req.dw_host, port=req.dw_port,
            user=req.dw_user, password=req.dw_password, database=req.dw_database
        )
        cur = c.cursor(dictionary=True)
        cur.execute(q)
        rows = cur.fetchall()
        columns = cur.column_names if cur.description else []
        cur.close()
        c.close()
        
        return {"status": "success", "data": rows, "columns": columns, "final_query": q}
    except Exception as e:
        return {"status": "error", "message": str(e)}

from fastapi.responses import Response

@app.get("/api/export-pdf")
def export_pipeline_pdf(session_id: str = "session_dw_1"):
    from fpdf import FPDF
    import os
    
    class PDF(FPDF):
        def header(self):
            self.set_font('Arial', 'B', 16)
            self.set_fill_color(99, 102, 241)
            self.set_text_color(255, 255, 255)
            self.cell(0, 15, 'Rapport Technique : Pipeline ETL Agentique', 0, 1, 'C', 1)
            self.ln(10)
        def footer(self):
            self.set_y(-15)
            self.set_font('Arial', 'I', 8)
            self.set_text_color(150, 150, 150)
            self.cell(0, 10, f'Genere par AI Data Engineer - Page {self.page_no()}', 0, 0, 'C')

    try:
        pdf = PDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        
        # Section 1
        pdf.set_font('Arial', 'B', 14)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 10, '1. Resume de l\'Architecture', 0, 1)
        pdf.set_font('Arial', '', 11)
        pdf.set_text_color(60, 60, 60)
        intro = f"Ce document recapitule la configuration du Data Warehouse pour la session {session_id}. L'architecture repose sur un schéma en étoile (Star Schema) optimisé pour les performances décisionnelles."
        pdf.multi_cell(0, 7, intro.encode('latin-1', 'replace').decode('latin-1'))
        pdf.ln(5)

        config = get_config(session_id)
        state_snap = agent_app.get_state(config)
        state = state_snap.values if state_snap else {}

        # Section 2 : SQL
        pdf.set_font('Arial', 'B', 14)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 10, '2. Schema SQL (DDL)', 0, 1)
        pdf.set_font('Courier', '', 9)
        pdf.set_fill_color(245, 245, 250)
        sql_text = state.get('sql_ddl', '-- Aucun schema genere') or "-- Aucun schema"
        # Remplacement manuel pour compatibilité PDF standard
        sql_text = sql_text.replace('’', "'").replace('€', 'EUR')
        pdf.multi_cell(0, 5, sql_text.encode('latin-1', 'replace').decode('latin-1'), fill=True)
        pdf.ln(10)

        # Section 3 : Pentaho
        pdf.add_page()
        pdf.set_font('Arial', 'B', 14)
        pdf.set_cell_height(10)
        pdf.cell(0, 10, '3. Transformation Pentaho (.ktr)', 0, 1)
        pdf.set_font('Courier', '', 8)
        etl_text = state.get('etl_code', '<!-- Aucun code ETL genere -->') or "<!-- Vide -->"
        pdf.multi_cell(0, 4, etl_text.encode('latin-1', 'replace').decode('latin-1'), fill=True)

        pdf_bytes = pdf.output()
        content = bytes(pdf_bytes)
        return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=rapport_etl_{session_id}.pdf"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.get("/api/export-mcd-pdf")
def export_mcd_pdf(session_id: str = "session_dw_1"):
    from fpdf import FPDF
    import math

    config = get_config(session_id)
    state_snap = agent_app.get_state(config)
    state = state_snap.values if state_snap else {}
    logical_model = state.get('logical_model', {})
    tables = logical_model.get('tables', [])
    
    if not tables:
        # Fallback si pas de modèle
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Arial", 'B', 16)
        pdf.cell(0, 15, "Modele Conceptuel (MCD) - Indisponible", 0, 1, 'C')
        pdf.ln(10)
        pdf.set_font("Arial", '', 12)
        pdf.cell(0, 10, "Veuillez generer un modele avant l'export.", 0, 1, 'C')
        pdf_bytes = pdf.output()
        return Response(content=bytes(pdf_bytes), media_type="application/pdf")

    pdf = FPDF(orientation='L', unit='mm', format='A4') # Paysage pour plus d'espace
    pdf.add_page()
    
    # Header Premium
    pdf.set_fill_color(15, 15, 20)
    pdf.rect(0, 0, 297, 40, 'F')
    pdf.set_font("Arial", 'B', 24)
    pdf.set_text_color(255, 255, 255)
    pdf.text(20, 25, "DATA WAREHOUSE SCHEMA")
    pdf.set_font("Arial", '', 10)
    pdf.set_text_color(150, 150, 150)
    pdf.text(20, 32, "Architecture Conceptuelle - Star Schema (Modèle de Faits et Dimensions)")

    # --- Style & Layout Configuration ---
    pdf = FPDF(orientation='L', unit='mm', format='A4')
    pdf.add_page()
    
    # Background "Slate" very dark
    pdf.set_fill_color(15, 17, 26)
    pdf.rect(0, 0, 297, 210, 'F')
    
    # Modern Header
    pdf.set_fill_color(22, 28, 45)
    pdf.rect(0, 0, 297, 35, 'F')
    pdf.set_draw_color(99, 102, 241) 
    pdf.set_line_width(0.8)
    pdf.line(0, 35, 297, 35)
    
    pdf.set_font("Arial", 'B', 20)
    pdf.set_text_color(240, 240, 255)
    pdf.text(15, 20, "ARCHITECTURE CONCEPTUELLE DU DATA WAREHOUSE")
    pdf.set_font("Arial", '', 9)
    pdf.set_text_color(148, 163, 184)
    pdf.text(15, 27, "Visualisation Star Schema - Genere par Agentic ETL")

    fact_tables = [t for t in tables if t.get('type') == 'FAIT']
    dim_tables = [t for t in tables if t.get('type') != 'FAIT']
    
    coords = {} # t_name -> (x, y, w, h)
    
    def draw_table(t, x, y):
        w = 58
        h_head = 9
        h_row = 5.5
        rows = len(t.get('columns', []))
        h_total = h_head + (rows * h_row) + 3
        
        is_fact = t.get('type') == 'FAIT'
        
        # Shadow / Glow
        pdf.set_fill_color(30, 41, 59)
        pdf.rect(x+0.5, y+0.5, w, h_total, 'F')
        
        # Table Body
        pdf.set_fill_color(15, 23, 42)
        pdf.set_draw_color(51, 65, 85)
        pdf.set_line_width(0.3)
        pdf.rect(x, y, w, h_total, 'FD')
        
        # Header
        color = (99, 102, 241) if is_fact else (20, 184, 166)
        pdf.set_fill_color(*color)
        pdf.rect(x, y, w, h_head, 'F')
        
        pdf.set_font("Arial", 'B', 9)
        pdf.set_text_color(255, 255, 255)
        pdf.text(x + 4, y + 6, t['name'].upper())
        
        # Rows
        cy = y + h_head + 4.5
        for col in t.get('columns', []):
            pdf.set_font("Arial", '', 8)
            pdf.set_text_color(226, 232, 240)
            
            pfx = ""
            if col.get('is_primary_key'): 
                pfx = "PK "
                pdf.set_text_color(250, 204, 21)
            elif col.get('is_foreign_key'):
                pfx = "FK "
                pdf.set_text_color(167, 139, 250)
                
            pdf.text(x + 4, cy, pfx + col['name'])
            
            pdf.set_font("Arial", 'I', 7)
            pdf.set_text_color(100, 116, 139)
            t_str = col['type'].split('(')[0]
            pdf.text(x + w - 4 - pdf.get_string_width(t_str), cy, t_str)
            cy += h_row
            
        return w, h_total

    # Placement
    cx, cy = 148, 125
    for i, ft in enumerate(fact_tables):
        tx, ty = cx - 29, cy - 25 + (i * 60)
        w, h = draw_table(ft, tx, ty)
        coords[ft['name']] = (tx, ty, w, h)

    radius = 85
    for i, dt in enumerate(dim_tables):
        ang = (i / len(dim_tables)) * 2 * math.pi
        tx, ty = cx + radius * math.cos(ang) - 29, cy + radius * math.sin(ang) - 20
        w, h = draw_table(dt, tx, ty)
        coords[dt['name']] = (tx, ty, w, h)

    # Relations behind tables (re-drawing tables after is better but we use coordinates)
    # To draw lines BEHIND, we should have calculated coörds first.
    # Let's just draw lines slightly lighter.
    pdf.set_draw_color(71, 85, 105)
    pdf.set_line_width(0.4)
    for ft in fact_tables:
        f_c = coords[ft['name']]
        for col in ft['columns']:
            ref = col.get('references')
            if ref and ref in coords:
                d_c = coords[ref]
                # Line between centers but stopped at table borders would be hard without intersection math.
                # We'll just draw them clearly.
                pdf.line(f_c[0]+29, f_c[1]+15, d_c[0]+29, d_c[1]+15)

    pdf_bytes = pdf.output()
    return Response(content=bytes(pdf_bytes), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=architecture_dwh_premium.pdf"})


@app.get("/api/export-ktr")
def export_ktr(session_id: str = "session_dw_1"):
    """Téléchargement du fichier de transformation Pentaho (.ktr) généré."""
    # Try to find user specific file first
    state = _get_pipeline_state(session_id)
    uid = state.get("user_id", "guest")
    
    ktr_file = f"outputs/transformation_{uid}.ktr"
    if not os.path.exists(ktr_file):
        ktr_file = "outputs/transformation.ktr" # global fallback
        
    if os.path.exists(ktr_file):
        return FileResponse(
            path=ktr_file, 
            filename=f"transformation_{session_id}.ktr",
            media_type='application/xml'
        )
    return {"status": "error", "message": "Fichier .ktr introuvable. Lancez le pipeline ETL d'abord."}


@app.get("/api/export")
def export_results():
    try:
        config = get_config()
        state_snapshot = agent_app.get_state(config)
        current_state = state_snapshot.values if state_snapshot else {}
        
        sql = current_state.get("sql_ddl", "-- Aucun modèle")
        etl = current_state.get("etl_code", "<!-- Aucun ETL -->")
        critic = current_state.get("critic_review", "Aucune remarque.")
        
        summary = f"""# RESUME DU DATA WAREHOUSE\n\n## Rapport de l'Agent Critique:\n{critic}\n\n## 1) DDL SQL:\n```sql\n{sql}\n```\n\n## 2) Transformation Pentaho .ktr (XML):\n```xml\n{etl}\n```\n"""
        return {"status": "success", "summary": summary, "sql": sql, "etl": etl}
    except Exception as e:
        return {"status": "error", "message": str(e)}



# ── Notifications ─────────────────────────────────────────────────────────────
def _send_notification(subject: str, body: str, email: Optional[str] = None):
    """Envoie un email HTML de notification via SMTP Gmail."""
    if not email:
        return
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        from email.utils import formataddr
        import os
        
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass = os.getenv("SMTP_PASS", "")
        
        if not smtp_user or smtp_pass == "VOTRE_APP_PASSWORD_ICI":
            logging.info(f"[MOCK] Email non envoyé (SMTP non configuré) → {email}: {subject}")
            return
        
        # Email multipart avec version HTML
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = formataddr(("Agentic ETL", smtp_user))  # Nom d'affichage
        msg["To"]      = email
        
        # Version texte brut (fallback)
        import re
        text_body = re.sub(r'<[^>]+>', '', body).strip()
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        
        # Version HTML (prioritaire)
        msg.attach(MIMEText(body, "html", "utf-8"))
        
        with smtplib.SMTP(smtp_host, smtp_port) as s:
            s.ehlo()
            s.starttls()
            s.ehlo()
            s.login(smtp_user, smtp_pass)
            s.sendmail(smtp_user, email, msg.as_string())
            logging.info(f"✅ Email envoyé à {email} : {subject}")
            print(f"✅ Email HTML envoyé à {email}")
            
    except Exception as e:
        logging.error(f"⚠️ Email non envoyé à {email}: {e}")
        print(f"⚠️ Email non envoyé: {e}")
