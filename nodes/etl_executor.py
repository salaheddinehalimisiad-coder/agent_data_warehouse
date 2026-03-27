# Fichier : nodes/etl_executor.py
# Stratégie :
#   1. Sauvegarder le fichier .ktr Pentaho dans outputs/transformation.ktr
#   2. Tenter l'exécution via Kitchen CLI si Pentaho est installé
#   3. Fallback : charger les données via Pandas → MySQL si Kitchen absent
#   4. Retourner le statut au pipeline LangGraph

import os
import traceback
import subprocess
import re
import pandas as pd
from sqlalchemy import create_engine, text
from app_state import AgentState

KTR_OUTPUT_DIR  = "outputs"
KTR_OUTPUT_FILE = os.path.join(KTR_OUTPUT_DIR, "transformation.ktr")

# Chemins typiques de l'installation Pentaho (Windows / Linux)
KITCHEN_PATHS = [
    r"C:\Program Files\Pentaho\data-integration\Kitchen.bat",
    r"C:\pentaho\data-integration\Kitchen.bat",
    "/opt/pentaho/data-integration/kitchen.sh",
    "/usr/local/pentaho/data-integration/kitchen.sh",
]


def _save_ktr(ktr_xml: str) -> str:
    """Sauvegarde le fichier .ktr sur disque et retourne son chemin absolu."""
    os.makedirs(KTR_OUTPUT_DIR, exist_ok=True)
    with open(KTR_OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(ktr_xml)
    abs_path = os.path.abspath(KTR_OUTPUT_FILE)
    print(f"   💾 Fichier .ktr sauvegardé : {abs_path}")
    return abs_path


def _find_kitchen() -> str | None:
    """Détecte l'exécutable Kitchen CLI de Pentaho."""
    for path in KITCHEN_PATHS:
        if os.path.exists(path):
            return path
    # Chercher dans le PATH système
    try:
        result = subprocess.run(["where", "kitchen.bat"], capture_output=True, text=True, timeout=3)
        if result.returncode == 0:
            return result.stdout.strip().split("\n")[0]
    except Exception:
        pass
    return None


def _run_kitchen(kitchen_path: str, ktr_path: str) -> tuple[bool, str]:
    """Exécute la transformation via Pentaho Kitchen CLI."""
    try:
        cmd = [kitchen_path, f"/file:{ktr_path}", "/level:Basic"]
        print(f"   🚀 Exécution Pentaho Kitchen : {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            return True, "Transformation Pentaho exécutée avec succès via Kitchen CLI."
        else:
            return False, f"Kitchen CLI a retourné une erreur :\n{result.stderr or result.stdout}"
    except subprocess.TimeoutExpired:
        return False, "Timeout : Pentaho Kitchen a dépassé 300 secondes."
    except Exception as e:
        return False, f"Erreur lors du lancement de Kitchen : {e}"


def _get_mysql_engine(config: dict):
    """Crée un moteur SQLAlchemy vers le Data Warehouse MySQL cible."""
    from urllib.parse import quote_plus
    host     = config.get("host", "127.0.0.1")
    port     = int(config.get("port", 3306))
    user     = config.get("user", "root")
    password = quote_plus(config.get("password", ""))
    database = config.get("database", "data_warehouse")
    url = f"mysql+mysqlconnector://{user}:{password}@{host}:{port}/{database}"
    return create_engine(url, pool_pre_ping=True, pool_recycle=3600)


def _strip_foreign_keys(ddl: str) -> str:
    """Supprime les contraintes FOREIGN KEY du DDL (best practice OLAP)."""
    lines = ddl.split('\n')
    cleaned = [l for l in lines if 'FOREIGN KEY' not in l.upper() and
               not ('REFERENCES' in l.upper() and l.upper().strip().startswith(','))]
    result = '\n'.join(cleaned)
    result = re.sub(r',(\s*\n\s*)\)', r'\1)', result)
    return result


def _create_warehouse_schema(engine, ddl: str) -> tuple[bool, str]:
    """Crée les tables DDL dans la base MySQL cible."""
    try:
        ddl_clean = re.sub(r'--[^\n]*', '', ddl)
        ddl_clean = _strip_foreign_keys(ddl_clean)
        statements = [s.strip() for s in ddl_clean.split(';') if s.strip()]
        create_stmts = [s for s in statements if re.search(r'CREATE\s+TABLE', s, re.IGNORECASE)]
        table_names = []
        for s in create_stmts:
            m = re.search(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?', s, re.IGNORECASE)
            if m:
                table_names.append(m.group(1))

        with engine.begin() as conn:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            for tbl in reversed(table_names):
                conn.execute(text(f"DROP TABLE IF EXISTS `{tbl}`;"))
            for stmt in create_stmts:
                stmt_safe = re.sub(r'CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)',
                                   'CREATE TABLE IF NOT EXISTS ', stmt, flags=re.IGNORECASE)
                try:
                    conn.execute(text(stmt_safe))
                except Exception as e:
                    print(f"   ⚠️ Warning DDL (non bloquant) : {e}")
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))

        return True, f"Schéma MySQL créé : {len(table_names)} table(s) — {', '.join(table_names)}"
    except Exception:
        return False, f"Erreur création du schéma :\n{traceback.format_exc()}"


def _pandas_fallback_load(engine, state: AgentState) -> tuple[bool, str]:
    """Chargement des données via Pandas si Kitchen est absent (fallback)."""
    try:
        conn_config = state.get("connection_config", {})
        source_path = conn_config.get("file_path", "")
        if not source_path or not os.path.exists(source_path):
            return True, "Pas de fichier source CSV/Excel — schéma DDL créé, données non chargées."

        ext = os.path.splitext(source_path)[1].lower()
        if ext in ('.xlsx', '.xls'):
            df = pd.read_excel(source_path)
        else:
            df = pd.read_csv(source_path)

        print(f"   📋 Source : {len(df)} lignes × {len(df.columns)} colonnes")

        logical_model = state.get("logical_model", {})
        tables = logical_model.get("tables", [])
        rows_total = 0
        for table in tables:
            tbl_name = table.get("name", "")
            if not tbl_name:
                continue
            df.to_sql(tbl_name, engine, if_exists='replace', index=False, chunksize=2000, method='multi')
            rows_total += len(df)
            print(f"   ✅ {tbl_name} : {len(df)} lignes")

        return True, f"Fallback Pandas → MySQL : {rows_total} lignes chargées."
    except Exception:
        return False, f"Erreur chargement Pandas :\n{traceback.format_exc()}"


def etl_executor_node(state: AgentState) -> dict:
    """
    Nœud d'exécution ETL Pentaho (Étape D).
    1. Sauvegarde le .ktr sur disque
    2. Exécute via Pentaho Kitchen CLI si disponible
    3. Fallback : Pandas + SQLAlchemy si Kitchen absent
    """
    print("\n--- 🏭 EXÉCUTEUR ETL PENTAHO : Instanciation du Data Warehouse ---")

    ktr_xml  = state.get("etl_code", "")
    sql_ddl  = state.get("sql_ddl", "")
    dw_config = state.get("dw_connection_config", {})

    if not ktr_xml or "<transformation>" not in ktr_xml:
        return {"etl_error": "Aucun fichier .ktr valide trouvé dans l'état du pipeline."}

    if not dw_config:
        return {"etl_error": "Configuration MySQL cible manquante."}

    # ── Étape 1 : Sauvegarder le .ktr ────────────────────────────────────────
    ktr_path = _save_ktr(ktr_xml)

    # ── Étape 2 : Connexion MySQL ─────────────────────────────────────────────
    try:
        print(f"   🔌 Connexion MySQL → {dw_config.get('host')}:{dw_config.get('port')}/{dw_config.get('database')}")
        engine = _get_mysql_engine(dw_config)
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
        print("   ✅ Connexion MySQL établie.")
    except Exception:
        return {"etl_error": f"Impossible de se connecter à MySQL :\n{traceback.format_exc()}"}

    # ── Étape 3 : Créer le schéma DDL ────────────────────────────────────────
    if sql_ddl and not sql_ddl.strip().startswith("--"):
        schema_ok, schema_msg = _create_warehouse_schema(engine, sql_ddl)
        print(f"   {'✅' if schema_ok else '❌'} {schema_msg}")
        if not schema_ok:
            return {"etl_error": schema_msg}

    # ── Étape 4 : Tenter Pentaho Kitchen CLI ─────────────────────────────────
    kitchen = _find_kitchen()
    if kitchen:
        print(f"   🥘 Pentaho Kitchen détecté : {kitchen}")
        ok, msg = _run_kitchen(kitchen, ktr_path)
        print(f"   {'✅' if ok else '❌'} {msg}")
        if not ok:
            return {"etl_error": msg}
        print(f"\n🎉 Data Warehouse opérationnel via Pentaho Kitchen !")
        return {"etl_error": ""}

    # ── Étape 5 : Fallback Pandas ─────────────────────────────────────────────
    print("   ℹ️  Pentaho Kitchen non détecté — fallback chargement Pandas → MySQL.")
    load_ok, load_msg = _pandas_fallback_load(engine, state)
    print(f"   {'✅' if load_ok else '❌'} {load_msg}")
    if not load_ok:
        return {"etl_error": load_msg}

    print(f"\n🎉 Data Warehouse opérationnel ! Fichier .ktr disponible : {ktr_path}")
    return {"etl_error": ""}
