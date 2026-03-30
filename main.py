# Fichier : main.py (Architecture complète)

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

def human_review_node(state: AgentState) -> dict:
    """Point d'arrêt pour l'interface de chat."""
    # Bug fix #8: LangGraph nodes MUST return a dict, even empty.
    # Returning None (via `pass`) causes undefined behavior in LangGraph.
    return {}

def route_after_review(state: AgentState) -> str:
    """Route l'utilisateur après la validation du modèle."""
    if state.get("is_validated", False):
        return "etl_generator"  # On passe à la génération du script ETL
    else:
        return "chat_modifier"

def route_etl_execution(state: AgentState) -> str:
    """La logique centrale du Try-Heal-Retry."""
    error = state.get("etl_error", "")
    retry_count = state.get("retry_count", 0)
    MAX_RETRIES = 3 # Limite stricte pour éviter les boucles infinies
    
    if not error:
        # Si la chaîne d'erreur est vide, le script a fonctionné
        return END
    elif retry_count < MAX_RETRIES:
        # S'il y a une erreur et qu'on a encore des essais, on appelle le médecin (Healer)
        return "healer"
    else:
        # SQA : Toujours prévoir un filet de sécurité pour éviter de consommer trop de tokens
        print(f"⚠️ Échec critique : Impossible de corriger le script après {MAX_RETRIES} tentatives.")
        return END

def create_agent_workflow():
    workflow = StateGraph(AgentState)

    # 1. Ajout de tous les nœuds de l'architecture
    workflow.add_node("explorer", explorer_node)
    workflow.add_node("modeler", modeler_node)
    workflow.add_node("critic", critic_node)
    workflow.add_node("human_review", human_review_node)
    workflow.add_node("chat_modifier", chat_modifier_node)
    
    # Nouveaux nœuds ETL
    workflow.add_node("etl_generator", etl_generator_node)
    workflow.add_node("etl_executor", etl_executor_node)
    workflow.add_node("healer", healer_node)

    # 2. Définition du flux logique de base
    workflow.add_edge(START, "explorer")
    workflow.add_edge("explorer", "modeler")
    workflow.add_edge("modeler", "critic")
    workflow.add_edge("critic", "human_review")

    # 3. Boucle 1 : Human-in-the-loop (Conception)
    workflow.add_conditional_edges("human_review", route_after_review)
    workflow.add_edge("chat_modifier", "critic") # le modèle modifié doit être recritiqué

    # 4. Phase de génération ETL
    workflow.add_edge("etl_generator", "etl_executor")

    # 5. Boucle 2 : Try-Heal-Retry (Auto-guérison)
    workflow.add_conditional_edges("etl_executor", route_etl_execution)
    # L'agent correcteur réécrit le code et le renvoie à l'exécuteur pour une nouvelle tentative
    workflow.add_edge("healer", "etl_executor")

    # Compilation avec persistance en mémoire (Volatile)
    memory = MemorySaver()
    return workflow.compile(checkpointer=memory, interrupt_before=["human_review"])
