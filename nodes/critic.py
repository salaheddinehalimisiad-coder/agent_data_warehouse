from langchain_google_genai import ChatGoogleGenerativeAI
import os
from app_state import AgentState
from langchain_core.prompts import ChatPromptTemplate
import time

def critic_node(state: AgentState) -> dict:
    print("--- 🛡️ AGENT CRITIQUE : Vérification de la qualité du modèle ---")
    llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0)
    
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
    
    response = chain.invoke({"sql_ddl": sql_ddl})
    
    print("🛡️ [Agent Critique] Rapport de validation émis.")
    
    raw_content = response.content
    if isinstance(raw_content, list):
        text_parts = []
        for part in raw_content:
            text_parts.append(part["text"] if isinstance(part, dict) and "text" in part else str(part))
        review_text = "".join(text_parts)
    else:
        review_text = str(raw_content)

    return {"critic_review": review_text}
