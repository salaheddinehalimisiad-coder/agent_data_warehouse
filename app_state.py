# Définition du State LangGraph (Le "Cerveau")
from typing import Annotated, TypedDict, List, Dict, Any, Optional
from langgraph.graph.message import add_messages


# BUG FIX #2 : AgentState utilisait TypedDict strict (total=True par défaut).
# Tous les champs étaient obligatoires, mais beaucoup ne sont jamais initialisés
# au démarrage (etl_error, retry_count, healer_explanation, lineage, user_id...).
# Un accès direct state["etl_error"] levait un KeyError au runtime.
#
# SOLUTION : total=False rend tous les champs optionnels.
# Les agents utilisent state.get("champ", valeur_défaut) pour la sécurité.
#
# BUG FIX #9 : user_id était int sans valeur par défaut — crash garanti
# pour les utilisateurs non authentifiés. Maintenant Optional[int].

class AgentState(TypedDict, total=False):  # FIX: total=False — tous les champs sont optionnels

    # L'historique des échanges (Nécessaire pour l'aspect conversationnel)
    messages: Annotated[list, add_messages]

    # Métadonnées extraites (tables, colonnes, types)
    source_metadata: Dict[str, Any]

    # Configuration de la source
    connection_config: Dict[str, Any]

    # Le modèle logique OLAP proposé (Tables de Faits / Dimensions)
    logical_model: Dict[str, Any]

    # Le code SQL DDL généré
    sql_ddl: str

    # Drapeau de validation pour l'étape "Human-in-the-loop"
    is_validated: bool

    # Rapport du Critique sur le DDL généré
    critic_review: str

    # Code Pentaho/KTR généré pour l'ETL
    etl_code: str

    # Capture de l'erreur d'exécution si l'ETL plante
    # NOTE pour healer_node : toujours remettre etl_error à "" après correction
    # et incrémenter retry_count pour éviter la boucle infinie.
    etl_error: str

    # Explication humaine optionnelle de la correction apportée par Healer
    healer_explanation: str

    # Compteur pour éviter une boucle infinie de corrections
    # healer_node DOIT faire : "retry_count": state.get("retry_count", 0) + 1
    retry_count: int

    # Configuration de connexion vers le Data Warehouse MySQL cible
    dw_connection_config: Dict[str, Any]

    # Lineage des données (traçabilité source -> destination)
    lineage: Dict[str, Any]

    # Identifiant utilisateur pour le préfixage multi-tenant
    # FIX: Optional[int] pour supporter les utilisateurs non authentifiés
    user_id: Optional[int]  # FIX: était int, crash si non authentifié
    user_prefix: str
