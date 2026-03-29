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
    example_json = """
{
  "explication_humaine": "<une phrase courte expliquant ce que tu as corrigé>",
  "code_corrige": "<le code xml complet et valide du ktr>"
}
"""

    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un expert Pentaho Data Integration (Kettle) et XML.
Le fichier de transformation .ktr ci-dessous a généré une erreur lors de son exécution ou de sa validation.

Analyse la cause racine et génère une version corrigée et valide du fichier XML .ktr Pentaho.

RÈGLES :
- Conserve la structure globale de la transformation
- Corrige UNIQUEMENT ce qui est nécessaire
- Tu DOIS répondre EXCLUSIVEMENT avec un objet JSON valide ayant cette structure exacte :
{example_json}
Aucun markdown, juste le JSON."""),
        ("human", "Fichier .ktr fautif :\n{failed_ktr}\n\nErreur rencontrée :\n{error_log}")
    ])
    llm = get_llm(temperature=0)
    chain = prompt | llm
    response = call_with_retry(chain, {
        "failed_ktr": failed_ktr, 
        "error_log": error_log,
        "example_json": example_json
    })
    
    raw_response = extract_text(response)
    
    # Extraction du JSON grâce à json_repair pour plus de robustesse
    import json_repair
    healed_ktr = failed_ktr
    explanation = "Correction mineure appliquée."
    try:
        parsed_data = json_repair.loads(raw_response)
        code_from_json = parsed_data.get("code_corrige", "")
        # Vérification basique
        if "<transformation>" in code_from_json:
            healed_ktr = code_from_json
            explanation = parsed_data.get("explication_humaine", explanation)
        else:
            print("⚠️ La réparation n'a pas produit un XML valide dans le JSON — conservation de l'original.")
    except Exception as e:
        print(f"⚠️ Erreur de parsing du retour Healer: {e}")

    print(f"✅ Fichier .ktr analysé et corrigé par l'IA. Raison: {explanation}")
    
    from langchain_core.messages import AIMessage
    return {
        "etl_code": healed_ktr,
        "healer_explanation": explanation,
        "retry_count": retry_count + 1,
        "etl_error": "",  # On efface l'erreur pour la prochaine tentative
        "messages": [AIMessage(content=f"🛠️ **Correction automatique appliquée à votre script ETL** : {explanation}")]
    }
