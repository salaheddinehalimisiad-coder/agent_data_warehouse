# Fichier : main.py (Architecture complète — version corrigée)

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from app_state import AgentState

# Importation de tous nos nœuds métier
from nodes.explorer import explorer_node
from nodes.modeler import modeler_node
from nodes.chat_modifier import chat_modifier_node
from nodes.critic import critic_node
from nodes.etl_generator import etl_generator_node
from nodes.etl_executor import etl_executor_node
from nodes.healer import healer_node


# ─────────────────────────────────────────────
# BUG FIX #1 — human_review_node retournait None
# Un nœud LangGraph DOIT retourner un dict (même vide).
# Retourner None provoque des comportements indéfinis.
# ─────────────────────────────────────────────
def human_review_node(state: AgentState) -> dict:
    """
    Point d'arrêt pour l'interface de chat.
    LangGraph s'arrête ici via interrupt_before=["human_review"].
    Ce nœud est un passthrough pur — le state est inchangé.
    """
    return {}


def route_after_review(state: AgentState) -> str:
    """Route l'utilisateur après la validation du modèle."""
    if state.get("is_validated", False):
        return "etl_generator"   # Validation confirmée → génération ETL
    else:
        return "chat_modifier"   # Modification demandée → boucle de chat


def route_etl_execution(state: AgentState) -> str:
    """
    La logique centrale du Try-Heal-Retry.

    BUG FIX #2 — END doit être retourné via la constante importée,
    pas comme string brute, pour que LangGraph le reconnaisse.

    BUG FIX #4 — retry_count est lu ici mais doit avoir été incrémenté
    dans healer_node (voir nodes/healer.py).
    """
    error = state.get("etl_error", "")
    retry_count = state.get("retry_count", 0)
    MAX_RETRIES = 3  # Limite stricte pour éviter les boucles infinies

    if not error:
        # Script exécuté avec succès
        return END

    elif retry_count < MAX_RETRIES:
        # Erreur présente + tentatives restantes → appel du Healer
        return "healer"

    else:
        # Échec définitif après MAX_RETRIES tentatives
        print(
            f"⚠️  Échec critique : impossible de corriger le script "
            f"après {MAX_RETRIES} tentatives. Dernière erreur : {error[:200]}"
        )
        return END


def create_agent_workflow():
    workflow = StateGraph(AgentState)

    # ── 1. Enregistrement de tous les nœuds ───────────────────────────────
    workflow.add_node("explorer",       explorer_node)
    workflow.add_node("modeler",        modeler_node)
    workflow.add_node("critic",         critic_node)
    workflow.add_node("human_review",   human_review_node)
    workflow.add_node("chat_modifier",  chat_modifier_node)
    workflow.add_node("etl_generator",  etl_generator_node)
    workflow.add_node("etl_executor",   etl_executor_node)
    workflow.add_node("healer",         healer_node)

    # ── 2. Flux principal ─────────────────────────────────────────────────
    workflow.add_edge(START,        "explorer")
    workflow.add_edge("explorer",   "modeler")
    workflow.add_edge("modeler",    "critic")
    workflow.add_edge("critic",     "human_review")

    # ── 3. Boucle 1 : Human-in-the-loop (Conception) ──────────────────────
    workflow.add_conditional_edges("human_review", route_after_review)

    # BUG FIX #5 — chat_modifier doit remettre is_validated=False dans son
    # return dict pour forcer une nouvelle validation humaine après modification.
    # Le rebouclage sur critic garantit que le modèle modifié est re-évalué.
    workflow.add_edge("chat_modifier", "critic")

    # ── 4. Phase de génération ETL ────────────────────────────────────────
    workflow.add_edge("etl_generator", "etl_executor")

    # ── 5. Boucle 2 : Try-Heal-Retry (Auto-guérison) ──────────────────────
    workflow.add_conditional_edges("etl_executor", route_etl_execution)

    # Le Healer corrige le .ktr et renvoie vers l'executor pour nouvelle tentative
    workflow.add_edge("healer", "etl_executor")

    # ── 6. Compilation avec persistance en mémoire (volatile) ─────────────
    # TODO production : remplacer MemorySaver par SqliteSaver ou RedisSaver
    # from langgraph.checkpoint.sqlite import SqliteSaver
    # memory = SqliteSaver.from_conn_string("sessions.db")
    memory = MemorySaver()

    return workflow.compile(
        checkpointer=memory,
        interrupt_before=["human_review"]
    )
