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
    critic_review = state.get("critic_review", "Aucun retour critique pour le moment.")
    
    if not messages:
        return {}

    user_request = messages[-1].content
    llm = get_llm(temperature=0)

    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un expert en Data Warehousing et Architecture de données.
Voici le modèle OLAP actuel en JSON :
{current_model}

Voici le dernier rapport de l'AGENT CRITIQUE :
{critic_review}

L'utilisateur demande une modification qui peut inclure un rapport de l'AGENT CRITIQUE.
Ton objectif est de mettre à jour le modèle JSON pour qu'il soit PARFAIT et conforme aux meilleures pratiques (Star Schema, Clés primaires BIGINT, Clés étrangères vers les dimensions).

SI UN 'RETOUR CRITIQUE' EST PRÉSENT DANS LA DEMANDE OU DANS LE RAPPORT CI-DESSUS :
1. Analyse chaque point soulevé par la critique.
2. Corrige obligatoirement tous les problèmes mentionnés (types de colonnes, relations manquantes, erreurs de nommage).
3. Ne laisse aucune erreur décelée par la critique dans ta réponse.

Format de sortie : RÉPONDS UNIQUEMENT avec un objet JSON valide.
{{
  "tables": [ ... ],
  "reasoning": "Détails des corrections apportées (sois précis)"
}}"""),
        ("human", "{user_request}")
    ])

    chain = prompt | llm

    print(f"Traitement de la demande: '{user_request}'...")
    response = call_with_retry(chain, {
        "current_model": json.dumps(current_model, ensure_ascii=False, indent=2),
        "critic_review": critic_review,
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
