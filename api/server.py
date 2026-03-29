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

def get_config():
    return {"configurable": {"thread_id": current_session_id}}

# ── Pipeline State (partagé entre les routes et le SSE) ───────────────────────
STAGES = [
    {"id": "explorer",   "label": "🔍 Exploration",          "status": "idle"},
    {"id": "modeler",    "label": "🧠 Modélisation IA",       "status": "idle"},
    {"id": "critic",     "label": "🛡️ Agent Critique",       "status": "idle"},
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
    logging.info(msg)
    pipeline_state["logs"].append({"t": round(time.time() - pipeline_state["started_at"], 1), "msg": msg})
    _broadcast()


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
                _set_stage("modeler", "success", "Schéma généré")
                _set_stage("critic", "running")
                _log("Agent Critique analyse la conformité...")
            elif node == "critic_node":
                _set_stage("critic", "success", "Revue terminée")
                _set_stage("human",   "running")
                _log("En attente de validation humaine...")

        current_state = agent_app.get_state(config).values
        _set_stage("explorer", "success")
        _set_stage("modeler",  "success")
        _set_stage("critic",   "success")
        _set_stage("human", "running", "En attente de votre validation")
        _log("Modèle prêt — validez pour lancer l'ETL.")
        _broadcast()

        return {"status": "waiting_for_review",
                "sql_ddl": current_state.get("sql_ddl", ""),
                "critic_review": current_state.get("critic_review", ""),
                "message": "Modèle généré avec succès."}

    except Exception as e:
        pipeline_state["status"] = "failed"
        _set_stage("explorer", "failed", str(e))
        _broadcast()
        return {"status": "failed", "message": f"Erreur: {str(e)}"}


# ── /api/chat ─────────────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat_with_agent(req: ChatRequest):
    try:
        config = get_config()
        state_snapshot = agent_app.get_state(config)
        current_state = state_snapshot.values if state_snapshot else {}

        if req.context == "etl":
            # Modification spécifique du script ETL
            from langchain_core.prompts import ChatPromptTemplate
                        
            current_etl_code = current_state.get("etl_code", "")
            if not current_etl_code:
                _log("⚠️ Erreur Chat : Aucun script ETL trouvé dans la session actuelle.")
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
            
            _log(f"Agent ETL (Chat) : modification du script ETL demandée...")
            _broadcast()
            
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
            
            _log(f"Script ETL mis à jour avec succès via le chat.")
            _broadcast()
            return {"status": "waiting_for_review", "etl_code": clean_code}
        
        else:
            # Modification du modèle logique SQL
            if not current_state:
                 return {"status": "error", "message": "Session expirée ou introuvable. Veuillez re-générer un modèle."}
                 
            agent_app.update_state(config, {"messages": [{"role": "user", "content": req.message}]})
            for event in agent_app.stream(None, config=config):
                pass
            
            new_state = agent_app.get_state(config).values
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
    try:
        agent_app.update_state(config, {"is_validated": True})

        for event in agent_app.stream(None, config=config):
            node = list(event.keys())[0] if event else None
            if node == "etl_generator":
                _set_stage("human", "success", "Validation reçue")
                _set_stage("etl_gen",  "success", "Script ETL généré")
                pipeline_state["etl_code_used"] = agent_app.get_state(config).values.get("etl_code", "")
                _set_stage("etl_exec", "running")
                _log("Exécution ETL → MySQL…")
            elif node == "etl_executor":
                pass   # on attendra le retour
            elif node == "healer":
                _set_stage("healer", "running", "Correction automatique en cours…")
                _log("Agent Healer activé…")
                
            _broadcast() # Notify UI step by step

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

def re_execute_etl_pipeline(config: dict):
    from nodes.etl_executor import etl_executor_node
    try:
        _set_stage("etl_exec", "running", "Réexécution demandée par l'utilisateur…")
        _log("Lancement manuel de l'exécuteur ETL…")
        _broadcast()
        
        current_state = agent_app.get_state(config).values
        result = etl_executor_node(current_state)
        agent_app.update_state(config, result)
        
        if result.get("etl_error"):
            _set_stage("etl_exec", "failed", result["etl_error"][:80])
            pipeline_state["status"] = "failed"
            _log(f"Échec de l'exécution manuelle: {result['etl_error'][:80]}")
        else:
            _set_stage("etl_exec", "success", "Tables créées dans MySQL (Custom)")
            pipeline_state["status"] = "success"
            pipeline_state["ended_at"] = time.time()
            _log("✅ Data Warehouse personnalisé opérationnel !")
            
        _broadcast()
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

@app.post("/api/execute-etl")
async def execute_etl_custom(background_tasks: BackgroundTasks):
    config = get_config()
    _set_stage("etl_gen", "success", "Script manuel validé")
    pipeline_state["status"] = "running"
    _broadcast()
    background_tasks.add_task(re_execute_etl_pipeline, config)
    return {"status": "background", "message": "Réexécution du pipeline lancée en arrière-plan !"}

@app.get("/api/sessions")
def get_history_sessions():
    """Retourne la session courante uniquement (persistance mémoire)."""
    global current_session_id
    sessions = [{
        "id": current_session_id,
        "name": f"Session Active ({current_session_id})",
        "updated_at": datetime.datetime.now().isoformat()
    }]
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
        state_snapshot = agent_app.get_state(config)
        current_state = state_snapshot.values if state_snapshot else {}
        messages = current_state.get("messages", [])
        msgs = [{"role": getattr(m, "type", "human"), "content": m.content} for m in messages] if messages else []
        return {
            "status": "success",
            "sql_ddl": current_state.get("sql_ddl", ""),
            "etl_code": current_state.get("etl_code", ""),
            "critic_review": current_state.get("critic_review", ""),
            "messages": msgs
        }
    return {"status": "error"}

@app.post("/api/sessions/new")
def new_session_endpoint():
    global current_session_id
    current_session_id = f"session_dw_{uuid.uuid4().hex[:8]}"
    return {"status": "success", "session_id": current_session_id}

from fastapi.responses import Response

@app.get("/api/export-pdf")
def export_pipeline_pdf():
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
        intro = "Ce document recapitule la configuration du Data Warehouse et des processus ETL générés. L'architecture repose sur un schéma en étoile (Star Schema) optimisé pour les performances décisionnelles."
        pdf.multi_cell(0, 7, intro.encode('latin-1', 'replace').decode('latin-1'))
        pdf.ln(5)

        config = get_config()
        state = agent_app.get_state(config).values if agent_app else {}

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
        pdf.cell(0, 10, '3. Transformation Pentaho (.ktr)', 0, 1)
        pdf.set_font('Courier', '', 8)
        etl_text = state.get('etl_code', '<!-- Aucun code ETL genere -->') or "<!-- Vide -->"
        pdf.multi_cell(0, 4, etl_text.encode('latin-1', 'replace').decode('latin-1'), fill=True)

        pdf_bytes = pdf.output()
        content = bytes(pdf_bytes)
        return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=rapport_etl.pdf"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.get("/api/export-mcd-pdf")
def export_mcd_pdf():
    from fpdf import FPDF
    import math

    config = get_config()
    state = agent_app.get_state(config).values if agent_app else {}
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
def export_ktr():
    """Téléchargement du fichier de transformation Pentaho (.ktr) généré."""
    ktr_file = "outputs/transformation.ktr"
    if os.path.exists(ktr_file):
        return FileResponse(
            path=ktr_file, 
            filename="transformation_pentaho.ktr",
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


# ── Authentification & Email Verification ─────────────────────────────────────

@app.post("/api/auth/register-init")
async def register_init(req: RegisterInitRequest):
    import random
    code = f"{random.randint(100000, 999999)}"
    PENDING_VERIFICATIONS[req.email] = code
    
    subject = "Votre code de vérification - Agentic ETL"
    html_body = f"""
    <html>
    <body style="font-family: 'Inter', Arial, sans-serif; background-color: #0f1117; color: #e2e8f0; padding: 0; margin: 0;">
      <div style="max-width: 560px; margin: 40px auto; background: #1a1f2e; border-radius: 16px; overflow: hidden; border: 1px solid #2d3748;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 40px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; letter-spacing: -0.5px;">🔐 Agentic ETL</h1>
          <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Plateforme d'Intelligence Data</p>
        </div>
        <!-- Body -->
        <div style="padding: 40px;">
          <p style="margin: 0 0 16px; font-size: 16px; color: #94a3b8;">Bonjour <strong style="color: #e2e8f0;">{req.name}</strong>,</p>
          <p style="margin: 0 0 24px; font-size: 15px; color: #94a3b8; line-height: 1.6;">
            Merci de rejoindre <strong style="color: #e2e8f0;">Agentic ETL</strong>. Voici votre code de vérification à 6 chiffres :
          </p>
          <!-- Code Block -->
          <div style="background: #0f1117; border: 2px solid #6366f1; border-radius: 12px; padding: 28px; text-align: center; margin: 24px 0;">
            <p style="margin: 0 0 8px; font-size: 12px; color: #6366f1; letter-spacing: 2px; text-transform: uppercase;">CODE DE VÉRIFICATION</p>
            <p style="margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #ffffff; font-family: 'Courier New', monospace;">{code}</p>
          </div>
          <p style="margin: 24px 0 0; font-size: 13px; color: #64748b; line-height: 1.6;">
            ⚠️ Ce code expire dans <strong>10 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
          </p>
        </div>
        <!-- Footer -->
        <div style="background: #111827; padding: 20px 40px; text-align: center; border-top: 1px solid #1e2a3a;">
          <p style="margin: 0; font-size: 12px; color: #475569;">© 2026 Agentic ETL — Plateforme d'automatisation Data Warehouse</p>
          <p style="margin: 6px 0 0; font-size: 12px; color: #374151;">Envoyé depuis halimimohamedsalaheddine2026@gmail.com</p>
        </div>
      </div>
    </body>
    </html>
    """
    
    # Envoi réel ou log
    _send_notification(subject, html_body, req.email)
    
    # Toujours afficher le code en console pour debug
    print(f"\n{'='*60}")
    print(f"📧 EMAIL DE VÉRIFICATION")
    print(f"   Destinataire : {req.email}")
    print(f"   Nom          : {req.name}")
    print(f"   CODE         : {code}")
    print(f"{'='*60}\n")
    
    return {"status": "success", "message": "Code envoyé."}

@app.post("/api/auth/register-verify")
async def register_verify(req: RegisterVerifyRequest):
    expected_code = PENDING_VERIFICATIONS.get(req.email)
    if expected_code and expected_code == req.code:
        # Nettoyer après succès
        del PENDING_VERIFICATIONS[req.email]
        return {"status": "success", "message": "Compte vérifié."}
    return Response(content="Code invalide.", status_code=400)

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
