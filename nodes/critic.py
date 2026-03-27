import os
from nodes.llm_factory import get_llm, call_with_retry, extract_text
from app_state import AgentState
from langchain_core.prompts import ChatPromptTemplate
import time

def critic_node(state: AgentState) -> dict:
    print("--- 🛡️ AGENT CRITIQUE : Vérification de la qualité du modèle ---")
    llm = get_llm(temperature=0)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Vous êtes un Expert Architecte Data Senior. 
Votre rôle est de vérifier rigoureusement le code SQL DDL suivant généré pour un Data Warehouse de type Star Schema.
Analysez si:
1. Les tables de Dimensions et de Faits respectent les bonnes pratiques (Clés primaires, Clés étrangères, Types de données appropriés).
2. L'absence de contraintes bloquantes éventuelles (cascade formées).

Faites un résumé concis et professionnel de vos critiques. S'il est valide à vue d'œil, dites-le et expliquez en 2 lignes pourquoi."""),
        ("human", "Voici le code SQL à valider : \n{sql_ddl}")
    ])
    
    chain = prompt | llm
    sql_ddl = state.get("sql_ddl", "")
    
    if not sql_ddl:
        return {"critic_review": "Aucun code SQL à analyser."}
    
    response = call_with_retry(chain, {"sql_ddl": sql_ddl})
    
    print("[Agent Critique] Rapport de validation emis.")
    return {"critic_review": extract_text(response)}
