# Fichier : nodes/chat_modifier.py

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from app_state import AgentState
from nodes.modeler import DimensionalModelOutput # On réutilise notre schéma strict

def chat_modifier_node(state: AgentState) -> dict:
    """
    Agent qui prend en compte les retours de l'utilisateur (messages)
    pour mettre à jour le modèle OLAP de manière itérative.
    """
    print("\n--- 💬 AGENT CORRECTEUR (CHAT) : Modification du modèle ---")
    
    current_model = state.get("logical_model", {})
    messages = state.get("messages", [])
    
    if not messages:
        return {}

    # Le dernier message correspond à la demande de l'utilisateur (ex: "Ajoute une dimension temps")
    user_request = messages[-1].content

    llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0)
    structured_llm = llm.with_structured_output(DimensionalModelOutput)

    # Le prompt d'ingénierie inclut le contexte actuel ET la demande
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un expert en Data Warehousing. 
        Voici le modèle logique OLAP actuel au format JSON : {current_model}
        
        L'utilisateur va te demander une modification.
        Mets à jour le modèle en intégrant cette demande tout en gardant la cohérence globale.
        Assure-toi de renvoyer l'intégralité du modèle mis à jour."""),
        ("human", "Demande de modification : {user_request}")
    ])

    chain = prompt | structured_llm
    
    print(f"Traitement de la demande utilisateur : '{user_request}'...")
    updated_model: DimensionalModelOutput = chain.invoke({
        "current_model": str(current_model),
        "user_request": user_request
    })
    
    # --- RE-GÉNÉRATION DU DDL SQL ---
    sql_statements = []
    for table in updated_model.tables:
        cols_sql = []
        for col in table.columns:
            col_def = f"{col.name} {col.type}"
            if col.is_primary_key: col_def += " PRIMARY KEY"
            if col.is_foreign_key and col.references: col_def += f" REFERENCES {col.references}"
            cols_sql.append(col_def)
        create_table_sql = f"CREATE TABLE {table.name} (\n    " + ",\n    ".join(cols_sql) + "\n);"
        sql_statements.append(create_table_sql)

    final_ddl = "\n\n".join(sql_statements)

    # On met à jour l'état avec le nouveau modèle et le nouveau SQL
    return {
        "logical_model": updated_model.dict(),
        "sql_ddl": final_ddl
    }
