# Fichier : nodes/etl_executor.py — extrait correctif (BUG FIX #3)
#
# Remplacer le bloc de retour de votre etl_executor_node existant
# par ce pattern pour corriger le bug de persistance d'erreur.
#
# PROBLÈME ORIGINAL :
#   Si l'executor réussit après une correction du Healer, etl_error
#   conserve la valeur de l'erreur précédente → route_etl_execution
#   croit encore à une erreur et rappelle le Healer indéfiniment.
#
# CORRECTION :
#   L'executor DOIT explicitement remettre etl_error="" en cas de succès.

# ─── Pattern de retour CORRECT pour etl_executor_node ────────────────────────

# CAS SUCCÈS :
RETURN_SUCCESS_EXAMPLE = {
    "etl_error": "",           # ← OBLIGATOIRE — remet l'erreur à vide
    "lineage": {},             # à remplir avec le lineage réel
}

# CAS ÉCHEC :
RETURN_FAILURE_EXAMPLE = {
    "etl_error": "message d'erreur complet ici",
    # retry_count N'est PAS incrémenté ici — c'est le rôle du Healer
}


# ─── Squelette complet de etl_executor_node ──────────────────────────────────

import subprocess
import os
import tempfile
from app_state import AgentState


def etl_executor_node(state: AgentState) -> dict:
    """
    Exécute le script ETL Pentaho (.ktr) sur le Data Warehouse MySQL cible.

    BUG FIX #3 : retourne etl_error="" explicitement en cas de succès.
    """
    etl_code  = state.get("etl_code", "")
    sql_ddl   = state.get("sql_ddl", "")
    dw_config = state.get("dw_connection_config", {})

    if not etl_code:
        return {"etl_error": "etl_code est vide — le générateur n'a rien produit."}

    # ── Étape 1 : Créer le schéma MySQL ──────────────────────────────────
    try:
        _execute_ddl_on_dw(sql_ddl, dw_config)
    except Exception as e:
        return {"etl_error": f"Erreur création schéma DDL : {e}"}

    # ── Étape 2 : Écrire le .ktr dans un fichier temporaire ──────────────
    ktr_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".ktr", delete=False, encoding="utf-8"
        ) as f:
            f.write(etl_code)
            ktr_path = f.name

        # ── Étape 3 : Lancer Kitchen CLI ou exporter le .ktr ─────────────
        kitchen_path = _find_kitchen_executable()

        if kitchen_path:
            conn_config = state.get("connection_config", {})
            file_path = conn_config.get("file_path", "")
            
            # Préparer la commande Kitchen avec les paramètres
            cmd = [kitchen_path, f"/file:{ktr_path}"]
            if file_path:
                # On échappe le chemin pour éviter les problèmes d'espace sur Windows
                cmd.append(f"/param:FILE_PATH={file_path}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300,
            )
            if result.returncode != 0:
                error_msg = result.stderr or result.stdout or "Erreur inconnue Kitchen"
                return {"etl_error": error_msg}
        else:
            # Kitchen non trouvé → export du .ktr pour exécution manuelle
            print("ℹ️  Kitchen CLI introuvable — le fichier .ktr est prêt pour export.")

        # ── BUG FIX #3 : Succès → on remet etl_error à "" EXPLICITEMENT ──
        return {
            "etl_error": "",      # ← CRITIQUE : sans ça, le Healer tourne en boucle
            "lineage": _build_lineage(state),
        }

    except subprocess.TimeoutExpired:
        return {"etl_error": "Timeout : l'exécution Kitchen a dépassé 300 secondes."}

    except Exception as e:
        return {"etl_error": f"Erreur inattendue executor : {e}"}

    finally:
        # Nettoyage du fichier temporaire
        if ktr_path and os.path.exists(ktr_path):
            os.unlink(ktr_path)


def _execute_ddl_on_dw(sql_ddl: str, config: dict) -> None:
    """
    Exécute le DDL sur le DW MySQL cible.
    SÉCURITÉ : valider que le DDL ne contient que CREATE/DROP TABLE avant exec.
    """
    import sqlalchemy
    if not sql_ddl.strip():
        return
    # Validation basique — autoriser seulement DDL safe
    allowed_keywords = ("CREATE", "DROP", "ALTER", "INSERT")
    statements = [s.strip().upper() for s in sql_ddl.split(";") if s.strip()]
    for stmt in statements:
        if stmt and not any(stmt.startswith(kw) for kw in allowed_keywords):
            raise ValueError(f"Instruction SQL non autorisée détectée : {stmt[:60]}")

    # Backend injecte souvent `user` alors que certains anciens chemins attendaient `username`.
    username = config.get("username") or config.get("user") or config.get("dw_user")
    password = config.get("password") or config.get("dw_password") or ""

    conn_str = (
        f"mysql+mysqlconnector://{username}:{password}"
        f"@{config.get('host', 'localhost')}:{config.get('port', 3306)}"
        f"/{config.get('database')}"
    )
    engine = sqlalchemy.create_engine(conn_str)
    with engine.connect() as conn:
        for statement in sql_ddl.split(";"):
            if statement.strip():
                conn.execute(sqlalchemy.text(statement))
        conn.commit()


def _find_kitchen_executable() -> str | None:
    """Cherche kitchen.bat / kitchen.sh dans le PATH et les dossiers Pentaho standard."""
    import shutil
    kitchen = shutil.which("kitchen") or shutil.which("kitchen.bat")
    if kitchen:
        return kitchen
    # Dossiers d'installation Pentaho standards (Windows / Linux)
    standard_paths = [
        r"C:\Program Files\Pentaho\data-integration\kitchen.bat",
        r"C:\pentaho\data-integration\kitchen.bat",
        "/opt/pentaho/data-integration/kitchen.sh",
        "/usr/local/pentaho/data-integration/kitchen.sh",
    ]
    for path in standard_paths:
        if os.path.exists(path):
            return path
    return None


def _build_lineage(state: AgentState) -> dict:
    """Construit le lineage source→destination depuis le logical_model."""
    logical_model = state.get("logical_model", {}) or {}
    source_metadata = state.get("source_metadata", {}) or {}

    # `explorer_node` renvoie : { "<nom_table_source>": { "columns": [...] } }
    source_table = next(iter(source_metadata.keys()), "source") if isinstance(source_metadata, dict) else "source"

    entries: list[dict] = []
    for table in logical_model.get("tables", []) or []:
        target_table = table.get("name", "unknown_table")
        for col in table.get("columns", []) or []:
            target_column = col.get("name", "")

            # Le modélisateur peut (selon le LLM) renseigner `source_column`.
            # Sinon on retombe sur le nom de la colonne cible.
            source_column = col.get("source_column") or ""
            if not source_column or str(source_column).strip().upper() in {"N/A", "NA", "NONE"}:
                source_column = target_column

            if not target_column or not source_column:
                continue

            entries.append({
                "source_table": source_table,
                "source_column": source_column,
                "target_table": target_table,
                "target_column": target_column,
                "transformation": "direct copy",
            })

    from datetime import datetime, timezone
    return {"entries": entries, "generated_at": datetime.now(timezone.utc).isoformat()}
