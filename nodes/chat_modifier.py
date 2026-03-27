import os
import json
import re
from nodes.llm_factory import get_llm, call_with_retry, extract_text
# Fichier : nodes/chat_modifier.py

from langchain_core.prompts import ChatPromptTemplate
from app_state import AgentState
from nodes.modeler import DimensionalModelOutput, _parse_model_from_text

def chat_modifier_node(state: AgentState) -> dict:
    """
    Agent qui prend en compte les retours de l'utilisateur
    pour mettre à jour le modèle OLAP de manière itérative.
    """
    print("\n--- 💬 AGENT CORRECTEUR (CHAT) : Modification du modèle ---")
    
    current_model = state.get("logical_model", {})
    messages = state.get("messages", [])
    
    if not messages:
        return {}

    user_request = messages[-1].content
    llm = get_llm(temperature=0)

    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un expert en Data Warehousing.
Voici le modèle OLAP actuel en JSON:
{current_model}

L'utilisateur demande une modification. Retourne le modèle complet mis à jour en JSON.

Format STRICT (même structure que le modèle actuel):
{{
  "tables": [ ... ],
  "reasoning": "Explication des modifications"
}}

RÉPONDS UNIQUEMENT avec le JSON. Pas de texte ni de balises markdown."""),
        ("human", "Modification demandée: {user_request}")
    ])

    chain = prompt | llm

    print(f"Traitement de la demande: '{user_request}'...")
    response = call_with_retry(chain, {
        "current_model": json.dumps(current_model, ensure_ascii=False, indent=2),
        "user_request": user_request
    })

    raw_text = extract_text(response).replace("```json", "").replace("```", "").strip()

    try:
        updated_model = _parse_model_from_text(raw_text)
    except Exception as e:
        print(f"⚠️ Erreur parsing: {e}")
        return {"critic_review": f"Erreur de modification: {e}"}

    # Re-génération DDL SQL
    sql_statements = []
    for table in updated_model.tables:
        cols_sql = []
        fks = []
        for col in table.columns:
            col_def = f"    {col.name} {col.type}"
            if col.is_primary_key:
                col_def += " PRIMARY KEY"
            cols_sql.append(col_def)
            if col.is_foreign_key and col.references:
                fks.append(f"    FOREIGN KEY ({col.name}) REFERENCES {col.references}({col.references.replace('dim_','') + '_sk'})")
        
        all_cols = cols_sql + fks
        sql_statements.append(f"CREATE TABLE IF NOT EXISTS {table.name} (\n" + ",\n".join(all_cols) + "\n);")

    final_ddl = "\n\n".join(sql_statements)

    return {
        "logical_model": updated_model.dict(),
        "sql_ddl": final_ddl
    }
