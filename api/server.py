# Fichier : api/server.py

from fastapi import FastAPI, Request, File, UploadFile, BackgroundTasks
import shutil
import os
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, AsyncGenerator
import uuid, asyncio, json, time
from dotenv import load_dotenv

load_dotenv()
from main import create_agent_workflow

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Data Warehouse AI Agent API",
    description="API de conception assistée et ETL automatisé",
    version="2.0"
)

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

def get_config():
    return {"configurable": {"thread_id": current_session_id}}

# ── Pipeline State (partagé entre les routes et le SSE) ───────────────────────
STAGES = [
    {"id": "explorer",   "label": "🔍 Exploration",          "status": "idle"},
    {"id": "modeler",    "label": "🧠 Modélisation IA",       "status": "idle"},
    {"id": "human",      "label": "👤 Validation Humaine",    "status": "idle"},
    {"id": "etl_gen",    "label": "⚙️ Génération ETL",        "status": "idle"},
    {"id": "etl_exec",   "label": "🚀 Exécution MySQL",       "status": "idle"},
    {"id": "healer",     "label": "🔧 Auto-Guérison",         "status": "idle"},
]

pipeline_state: dict = {
    "run_id":    None,
    "status":    "idle",       # idle | running | success | failed
    "stages":    [s.copy() for s in STAGES],
    "started_at": None,
    "ended_at":  None,
    "logs":      [],
}

# Clients SSE connectés
sse_clients: list[asyncio.Queue] = []


def _reset_pipeline():
    pipeline_state["run_id"]     = uuid.uuid4().hex[:8]
    pipeline_state["status"]     = "running"
    pipeline_state["stages"]     = [s.copy() for s in STAGES]
    pipeline_state["started_at"] = time.time()
    pipeline_state["ended_at"]   = None
    pipeline_state["logs"]       = []


def _set_stage(stage_id: str, status: str, detail: str = ""):
    for s in pipeline_state["stages"]:
        if s["id"] == stage_id:
            s["status"] = status
            s["detail"] = detail
    _broadcast()


def _broadcast():
    """Envoie l'état courant à tous les clients SSE."""
    msg = json.dumps(pipeline_state)
    dead = []
    for q in sse_clients:
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        sse_clients.remove(q)


def _log(msg: str):
    pipeline_state["logs"].append({"t": round(time.time() - pipeline_state["started_at"], 1), "msg": msg})
    _broadcast()


# ── Pydantic schemas ──────────────────────────────────────────────────────────
from typing import Optional

class ConnectionRequest(BaseModel):
    source_type: str
    connection_string: Optional[str] = None
    file_path: Optional[str]         = None
    dw_host:     str  = "127.0.0.1"
    dw_port:     int  = 3306
    dw_user:     str  = "root"
    dw_password: str  = ""
    dw_database: str  = "data_warehouse"
    # Notifications
    notify_email: Optional[str] = None

class ChatRequest(BaseModel):
    message: str


# ── SSE endpoint ──────────────────────────────────────────────────────────────
@app.get("/api/pipeline-stream")
async def pipeline_stream(request: Request):
    """Endpoint SSE – le frontend s'y abonne pour recevoir les mises à jour en temps réel."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=50)
    sse_clients.append(queue)

    async def event_generator() -> AsyncGenerator[str, None]:
        # Envoyer l'état actuel immédiatement à la connexion
        yield f"data: {json.dumps(pipeline_state)}\n\n"
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
            if queue in sse_clients:
                sse_clients.remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/pipeline-status")
def pipeline_status():
    """Snapshot immédiat de l'état du pipeline (polling fallback)."""
    return pipeline_state


@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Enregistre un fichier CSV envoyé par le frontend."""
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
        
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"status": "success", "file_path": file_path, "filename": file.filename}


# ── /api/start ────────────────────────────────────────────────────────────────
@app.post("/api/start")
async def start_process(req: ConnectionRequest):
    global current_session_id
    current_session_id = f"session_{uuid.uuid4().hex[:8]}"

    _reset_pipeline()
    _broadcast()

    # Auto-créer la base MySQL si besoin
    try:
        import mysql.connector
        c = mysql.connector.connect(host=req.dw_host, port=req.dw_port,
                                    user=req.dw_user, password=req.dw_password)
        cur = c.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{req.dw_database}` "
                    f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        c.commit(); cur.close(); c.close()
        _log(f"Base MySQL '{req.dw_database}' prête.")
    except Exception as e:
        pipeline_state["status"] = "failed"
        _broadcast()
        return {"status": "failed",
                "message": f"Connexion MySQL impossible : {str(e)}"}

    initial_state = {
        "connection_config":    {"type": req.source_type,
                                 "connection_string": req.connection_string,
                                 "file_path": req.file_path},
        "dw_connection_config": {"host": req.dw_host, "port": req.dw_port,
                                 "user": req.dw_user, "password": req.dw_password,
                                 "database": req.dw_database},
    }

    config = get_config()

    try:
        _set_stage("explorer", "running")
        _log("Démarrage de l'extraction de la source…")

        for event in agent_app.stream(initial_state, config=config):
            node = list(event.keys())[0] if event else None
            if node == "explorer_node":
                _set_stage("explorer", "success", "Métadonnées extraites")
                _set_stage("modeler",  "running")
                _log("Modélisation OLAP en cours…")
            elif node == "modeler_node":
                _set_stage("modeler", "success", "Schéma Star Schema généré")
                _set_stage("human",   "running")
                _log("En attente de validation humaine…")

        current_state = agent_app.get_state(config).values
        _set_stage("explorer", "success")
        _set_stage("modeler",  "success")
        _set_stage("human", "running", "En attente de votre validation")
        _log("Modèle prêt — validez pour lancer l'ETL.")
        _broadcast()

        return {"status": "waiting_for_review",
                "sql_ddl": current_state.get("sql_ddl", ""),
                "message": "Modèle généré avec succès."}

    except Exception as e:
        pipeline_state["status"] = "failed"
        _set_stage("explorer", "failed", str(e))
        _broadcast()
        return {"status": "failed", "message": f"Erreur: {str(e)}"}


# ── /api/chat ─────────────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat_with_agent(req: ChatRequest):
    config = get_config()
    agent_app.update_state(config, {"messages": [{"role": "user", "content": req.message}]})
    for event in agent_app.stream(None, config=config):
        pass
    current_state = agent_app.get_state(config).values
    return {"status": "waiting_for_review", "sql_ddl": current_state.get("sql_ddl", "")}


# ── /api/validate ─────────────────────────────────────────────────────────────

def run_etl_pipeline(req: Optional[ConnectionRequest], config: dict):
    try:
        agent_app.update_state(config, {"is_validated": True})

        for event in agent_app.stream(None, config=config):
            node = list(event.keys())[0] if event else None
            if node == "etl_generator":
                _set_stage("etl_gen",  "success", "Script PySpark généré")
                _set_stage("etl_exec", "running")
                _log("Exécution ETL → MySQL…")
            elif node == "etl_executor":
                pass   # on attendra le retour
            elif node == "healer":
                _set_stage("healer", "running", "Correction automatique en cours…")
                _log("Agent Healer activé…")

        current_state = agent_app.get_state(config).values
        error = current_state.get("etl_error", "")

        if error:
            _set_stage("etl_exec", "failed", "Échec après tentatives")
            _set_stage("healer",   "failed", error[:80])
            pipeline_state["status"] = "failed"
            pipeline_state["ended_at"] = time.time()
            _broadcast()
            _send_notification("❌ ETL échoué", error, req.notify_email if req else None)
            return

        _set_stage("etl_exec", "success", "Tables créées dans MySQL")
        pipeline_state["status"] = "success"
        pipeline_state["ended_at"] = time.time()
        pipeline_state["etl_code_used"] = current_state.get("etl_code", "")
        _log("✅ Data Warehouse opérationnel !")
        _broadcast()
        _send_notification("✅ ETL réussi", "Le Data Warehouse est opérationnel.", req.notify_email if req else None)

    except Exception as e:
        import traceback; traceback.print_exc()
        pipeline_state["status"] = "failed"
        _broadcast()


@app.post("/api/validate")
async def validate_and_deploy(background_tasks: BackgroundTasks, req: Optional[ConnectionRequest] = None):
    config = get_config()

    _set_stage("human",    "success", "Modèle approuvé")
    _set_stage("etl_gen",  "running")
    _log("Génération du script ETL en cours (tâche de fond)…")
    _broadcast()

    background_tasks.add_task(run_etl_pipeline, req, config)

    return {"status": "background",
            "message": "Le pipeline d'intégration a démarré en tâche de fond. Suivez la progression !"}


# ── Notifications ─────────────────────────────────────────────────────────────
def _send_notification(subject: str, body: str, email: Optional[str] = None):
    """Envoie un email de notification si configuré."""
    if not email:
        return
    try:
        import smtplib
        from email.mime.text import MIMEText
        # Utiliser un serveur SMTP public (Gmail par ex.)
        # Configurer via variables d'environnement SMTP_*
        import os
        smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_pass = os.getenv("SMTP_PASS", "")
        if not smtp_user:
            return
        msg = MIMEText(body)
        msg["Subject"] = f"[Agent DW] {subject}"
        msg["From"]    = smtp_user
        msg["To"]      = email
        with smtplib.SMTP(smtp_host, smtp_port) as s:
            s.starttls()
            s.login(smtp_user, smtp_pass)
            s.send_message(msg)
        print(f"📧 Email envoyé à {email}: {subject}")
    except Exception as e:
        print(f"⚠️ Email non envoyé: {e}")