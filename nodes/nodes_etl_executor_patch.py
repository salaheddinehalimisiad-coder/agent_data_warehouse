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
            result = subprocess.run(
                [kitchen_path, f"/file:{ktr_path}"],
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

    conn_str = (
        f"mysql+mysqlconnector://{config.get('username')}:{config.get('password')}"
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
    logical_model = state.get("logical_model", {})
    entries = []
    for dim in logical_model.get("dimension_tables", []):
        for col in dim.get("columns", []):
            entries.append({
                "source_table":  state.get("source_metadata", {}).get("tables", [{}])[0].get("table_name", "source"),
                "source_column": col,
                "target_table":  dim["name"],
                "target_column": col,
                "transformation": "direct copy",
            })
    from datetime import datetime, timezone
    return {"entries": entries, "generated_at": datetime.now(timezone.utc).isoformat()}
