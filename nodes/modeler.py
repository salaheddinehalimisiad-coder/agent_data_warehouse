from langchain_google_genai import ChatGoogleGenerativeAI
import os
# Fichier : nodes/modeler.py

from typing import List
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from app_state import AgentState

# ---------------------------------------------------------
# 1. DÉFINITION STRICTE DES SORTIES AVEC PYDANTIC (Validation)
# ---------------------------------------------------------
class ColumnSchema(BaseModel):
    name: str = Field(description="Nom de la colonne")
    type: str = Field(description="Type de données SQL (ex: VARCHAR, INT)")
    is_primary_key: bool = Field(default=False)
    is_foreign_key: bool = Field(default=False)
    references: str = Field(default=None, description="Table référencée si c'est une clé étrangère")

class TableSchema(BaseModel):
    name: str = Field(description="Nom de la table (ex: dim_temps, fact_ventes)")
    type: str = Field(description="Doit être 'FAIT' ou 'DIMENSION'")
    columns: List[ColumnSchema]

class DimensionalModelOutput(BaseModel):
    tables: List[TableSchema]
    reasoning: str = Field(description="Courte explication de vos choix de modélisation (Pourquoi ce schéma en étoile/flocon ?)")

# ---------------------------------------------------------
# 2. LOGIQUE DU NŒUD DE L'AGENT MODÉLISATEUR
# ---------------------------------------------------------
def modeler_node(state: AgentState) -> dict:
    """
    Agent IA qui transforme les métadonnées brutes en modèle dimensionnel OLAP
    et génère le code SQL DDL temporaire.
    """
    print("--- 🧠 AGENT MODÉLISATEUR : Analyse et Conception ---")
    
    metadata = state.get("source_metadata", {})
    if not metadata:
        print("Erreur : Aucune métadonnée trouvée. L'exploration a échoué.")
        return {"sql_ddl": "-- Erreur : Pas de métadonnées"}

    # Initialisation du LLM avec Gemini
    llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0)
    
    # On force le LLM à répondre EXACTEMENT selon notre schéma Pydantic
    structured_llm = llm.with_structured_output(DimensionalModelOutput)

    # Création du Prompt métier (Prompt Engineering)
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un ingénieur en Business Intelligence et Data Warehousing expert.
        Ton rôle est de concevoir un schéma en étoile ou en flocon à partir de métadonnées brutes.
        Identifie logiquement les tables de faits et de dimensions.
        Génère les clés primaires (surrogate keys) et clés étrangères nécessaires."""),
        ("human", "Voici les métadonnées extraites de la source : {metadata}\nConçois le modèle OLAP.")
    ])

    # Création de la chaîne et exécution
    chain = prompt | structured_llm
    
    print("Envoi des métadonnées au LLM pour modélisation logique...")
    # L'IA nous renvoie un objet Pydantic propre, pas du texte brut fragile !
    logical_model: DimensionalModelOutput = chain.invoke({"metadata": str(metadata)})
    
    print(f"Modèle généré : {len(logical_model.tables)} tables identifiées.")
    print(f"Raisonnement de l'IA : {logical_model.reasoning}")

    # ---------------------------------------------------------
    # 3. GÉNÉRATION DU DDL SQL TEMPORAIRE
    # ---------------------------------------------------------
    # Le système génère des blocs de code SQL temporaires représentant ce modèle
    sql_statements = []
    for table in logical_model.tables:
        cols_sql = []
        for col in table.columns:
            col_def = f"{col.name} {col.type}"
            if col.is_primary_key:
                col_def += " PRIMARY KEY"
            if col.is_foreign_key and col.references:
                col_def += f" REFERENCES {col.references}"
            cols_sql.append(col_def)
            
        create_table_sql = f"CREATE TABLE {table.name} (\n    " + ",\n    ".join(cols_sql) + "\n);"
        sql_statements.append(create_table_sql)

    final_ddl = "\n\n".join(sql_statements)

    # Mise à jour de l'état global du graphe
    return {
        "logical_model": logical_model.dict(),
        "sql_ddl": final_ddl
    }
