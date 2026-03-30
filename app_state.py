# Fichier : app_state.py — State LangGraph (version corrigée & typée)
#
# AMÉLIORATIONS :
#   - TypedDict imbriqués pour source_metadata, logical_model, lineage
#     (remplace les Dict[str, Any] trop lâches)
#   - Valeurs par défaut documentées
#   - Séparation claire des sections

from typing import Annotated, TypedDict, List, Dict, Any, Optional
from langgraph.graph.message import add_messages


# ─────────────────────────────────────────────────────────────────────────────
# Sous-types pour un typage plus strict (évite les Dict[str, Any] génériques)
# ─────────────────────────────────────────────────────────────────────────────

class ColumnMetadata(TypedDict):
    name: str
    dtype: str
    nullable: bool
    sample_values: List[Any]


class TableMetadata(TypedDict):
    table_name: str
    row_count: int
    columns: List[ColumnMetadata]


class SourceMetadata(TypedDict):
    tables: List[TableMetadata]
    source_type: str       # "csv" | "mysql" | "postgres" | ...
    source_path: str       # chemin fichier ou chaîne de connexion (masquée)


class DimensionTable(TypedDict):
    name: str
    columns: List[str]
    primary_key: str
    source_column: str


class FactTable(TypedDict):
    name: str
    columns: List[str]
    primary_key: str
    foreign_keys: Dict[str, str]   # { colonne_fk: nom_dim }
    measures: List[str]


class LogicalModel(TypedDict):
    fact_tables: List[FactTable]
    dimension_tables: List[DimensionTable]
    schema_name: str


class ConnectionConfig(TypedDict):
    type: str        # "csv" | "mysql" | "postgres" | "sqlite"
    host: Optional[str]
    port: Optional[int]
    database: Optional[str]
    username: Optional[str]
    password: Optional[str]   # ⚠️ masquer avant tout export/log
    file_path: Optional[str]  # pour CSV


class LineageEntry(TypedDict):
    source_table: str
    source_column: str
    target_table: str
    target_column: str
    transformation: str   # ex: "direct copy", "aggregation SUM", "type cast"


class Lineage(TypedDict):
    entries: List[LineageEntry]
    generated_at: str   # ISO 8601


# ─────────────────────────────────────────────────────────────────────────────
# State principal partagé entre tous les agents
# ─────────────────────────────────────────────────────────────────────────────

class AgentState(TypedDict):

    # ── Conversation ──────────────────────────────────────────────────────
    # Historique des échanges (nécessaire pour l'aspect conversationnel)
    # add_messages assure l'accumulation au lieu de l'écrasement
    messages: Annotated[list, add_messages]

    # ── Source de données ─────────────────────────────────────────────────
    source_metadata: SourceMetadata       # Tables, colonnes, types extraits
    connection_config: ConnectionConfig   # Config source (CSV / SQL)

    # ── Modélisation OLAP ─────────────────────────────────────────────────
    logical_model: LogicalModel           # Star Schema : Faits + Dimensions
    sql_ddl: str                          # DDL SQL généré (CREATE TABLE ...)
    critic_review: str                    # Rapport du Critic sur le DDL

    # ── Human-in-the-loop ─────────────────────────────────────────────────
    # BUG FIX #5 : chat_modifier DOIT remettre is_validated=False
    # pour forcer une re-validation après modification du modèle
    is_validated: bool

    # ── ETL ───────────────────────────────────────────────────────────────
    etl_code: str                         # Contenu XML du fichier .ktr Pentaho

    # BUG FIX #3 : etl_executor doit remettre etl_error="" en cas de succès
    # sinon route_etl_execution croit encore à une erreur après correction
    etl_error: str

    healer_explanation: str               # Explication humaine de la correction

    # BUG FIX #4 : retry_count DOIT être incrémenté dans healer_node
    # via : return {"retry_count": state.get("retry_count", 0) + 1, ...}
    retry_count: int

    # ── Data Warehouse cible ──────────────────────────────────────────────
    dw_connection_config: ConnectionConfig   # Config MySQL/PG cible
    lineage: Lineage                         # Traçabilité source → destination

    # ── Multi-tenant ─────────────────────────────────────────────────────
    # IMPORTANT : passer un thread_id unique par session dans la config
    # d'invocation du graph pour isoler les états entre utilisateurs.
    # Ex: graph.invoke(input, config={"configurable": {"thread_id": session_id}})
    user_id: int
    user_prefix: str
