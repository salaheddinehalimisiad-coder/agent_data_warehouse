import os
from nodes.llm_factory import get_llm, call_with_retry, extract_text
# Fichier : nodes/healer.py

from langchain_core.prompts import ChatPromptTemplate
from app_state import AgentState

def healer_node(state: AgentState) -> dict:
    """Agent qui analyse la trace d'erreur et corrige le fichier .ktr Pentaho."""
    retry_count = state.get("retry_count", 0)
    
    print(f"\n--- 🚑 AGENT CORRECTEUR (SELF-HEALING) : Tentative de réparation {retry_count + 1}/3 ---")
    
    failed_ktr = state.get("etl_code", "")
    error_log  = state.get("etl_error", "")

    print("Analyse de l'erreur Pentaho par l'Intelligence Artificielle...")
    llm = get_llm(temperature=0)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un expert Pentaho Data Integration (Kettle) et XML.
Le fichier de transformation .ktr ci-dessous a généré une erreur lors de son exécution ou de sa validation.

Analyse la cause racine (ex: balises XML malformées, nom de colonne incorrect, connexion mal configurée, step manquant).
Génère une version corrigée et valide du fichier XML .ktr Pentaho.

RÈGLES :
- Conserve la structure globale de la transformation
- Corrige UNIQUEMENT ce qui est nécessaire
- Réponds UNIQUEMENT avec le XML .ktr complet et valide, sans markdown ni explication."""),
        ("human", "Fichier .ktr fautif :\n{failed_ktr}\n\nErreur rencontrée :\n{error_log}")
    ])
    
    chain = prompt | llm
    response = call_with_retry(chain, {"failed_ktr": failed_ktr, "error_log": error_log})
    
    healed_ktr = extract_text(response).replace("```xml", "").replace("```", "").strip()

    # Vérification basique : si le LLM a renvoyé autre chose qu'un XML, on conserve l'original
    if "<transformation>" not in healed_ktr and "<transformation>" in failed_ktr:
        print("⚠️ La réparation n'a pas produit un XML valide — conservation de l'original.")
        healed_ktr = failed_ktr
    
    print("✅ Fichier .ktr analysé et corrigé par l'IA.")
    
    return {
        "etl_code": healed_ktr,
        "retry_count": retry_count + 1,
        "etl_error": ""  # On efface l'erreur pour la prochaine tentative
    }
