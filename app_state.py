# Définition du State LangGraph (Le "Cerveau")
from typing import Annotated, TypedDict, List, Dict, Any
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    # L'historique des échanges (Nécessaire pour l'aspect conversationnel) [cite: 20, 33]
    messages: Annotated[list, add_messages]
    
    # Métadonnées extraites (tables, colonnes, types) [cite: 15, 55]
    source_metadata: Dict[str, Any]
    
    # Configuration de la source
    connection_config: Dict[str, Any]
    
    # Le modèle logique OLAP proposé (Tables de Faits / Dimensions) [cite: 16, 56]
    logical_model: Dict[str, Any]
    
    # Le code SQL DDL généré [cite: 17, 25]
    sql_ddl: str
    
    # Drapeau de validation pour l'étape "Human-in-the-loop" [cite: 4, 21, 59]
    is_validated: bool

    # Rapport du Critique sur le DDL généré
    critic_review: str

    # Code PySpark/SQL généré pour l'ETL
    etl_code: str
    
    # Capture de l'erreur d'exécution si l'ETL plante
    etl_error: str
    
    # Compteur pour éviter une boucle infinie de corrections
    retry_count: int

    # Configuration de connexion vers le Data Warehouse MySQL cible (Étape D)
    dw_connection_config: Dict[str, Any]
