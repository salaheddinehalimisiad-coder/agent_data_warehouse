import os
from nodes.llm_factory import get_llm, call_with_retry, extract_text
# Fichier : nodes/modeler.py

import json
import re
from typing import List, Optional
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from app_state import AgentState


class ColumnSchema(BaseModel):
    name: str = Field(description="Nom de la colonne")
    type: str = Field(description="Type SQL (ex: VARCHAR(255), BIGINT, DATE)")
    is_primary_key: bool = Field(default=False)
    is_foreign_key: bool = Field(default=False)
    references: Optional[str] = Field(default=None)
    description: str = Field(default="", description="Documentation métier de la colonne")
    source_column: str = Field(default="", description="Nom de la colonne source d'origine pour le Lineage")

class TableSchema(BaseModel):
    name: str
    type: str  # 'FAIT' ou 'DIMENSION'
    description: str = Field(default="", description="Description métier de la table")
    columns: List[ColumnSchema]

class DimensionalModelOutput(BaseModel):
    tables: List[TableSchema]
    reasoning: str = Field(default="")


def _parse_model_from_text(text: str) -> DimensionalModelOutput:
    """Parse le JSON retourné par le LLM (compatible Ollama et Gemini) via json-repair."""
    import json_repair
    import re
    
    # Extraire la zone où pourrait se trouver du JSON
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        json_str = json_match.group(0)
    else:
        json_str = text
    
    raw = json_repair.loads(json_str)
    if not isinstance(raw, dict):
        raise ValueError(f"Le contenu réparé n'est pas un JSON valide :\n{raw}")
        
    tables = []
    for t in raw.get("tables", []):
        cols = [
            ColumnSchema(
                name=c.get("name", "col"),
                type=c.get("type", "VARCHAR(255)"),
                is_primary_key=c.get("is_primary_key", False),
                is_foreign_key=c.get("is_foreign_key", False),
                references=c.get("references"),
                description=c.get("description", ""),
                source_column=c.get("source_column", "")
            )
            for c in t.get("columns", [])
        ]
        tables.append(TableSchema(
            name=t.get("name", "unknown_table"), 
            type=t.get("type", "DIMENSION"), 
            description=t.get("description", ""),
            columns=cols
        ))
    
    return DimensionalModelOutput(tables=tables, reasoning=raw.get("reasoning", ""))



def modeler_node(state: AgentState) -> dict:
    """Agent IA qui transforme les métadonnées brutes en modèle dimensionnel OLAP."""
    print("--- 🧠 AGENT MODÉLISATEUR : Analyse et Conception ---")
    
    metadata = state.get("source_metadata", {})
    if not metadata:
        raise ValueError("Aucune métadonnée trouvée par l'agent. Assurez-vous d'avoir téléchargé un fichier source.")

    llm = get_llm(temperature=0)

    user_prefix = state.get("user_prefix", "")

    example_json = """
{
  "tables": [
    {
      "name": "u1_fact_exemple",
      "type": "FAIT",
      "description": "Table des faits centralisant les événements de vente.",
      "columns": [
        {"name": "id_fait_sk", "type": "BIGINT", "is_primary_key": true, "is_foreign_key": false, "references": null, "description": "Clé technique", "source_column": "N/A"},
        {"name": "dim_entite_sk", "type": "BIGINT", "is_primary_key": false, "is_foreign_key": true, "references": "u1_dim_entite", "description": "Lien FK", "source_column": "ID"}
      ]
    }
  ]
}
"""

    # Prompt qui force une sortie JSON structurée — compatible Ollama et Gemini
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un expert en Data Warehousing. 
Analyse les métadonnées et conçois un schéma OLAP en étoile (Star Schema).

IMPORTANT : Pour des raisons de multi-tenancy, tous les noms de tables DOIVENT commencer par le préfixe suivant : {user_prefix}
Exemple : Si le préfixe est 'u1_', alors 'fact_ventes' devient 'u1_fact_ventes'.

RÉPONDS UNIQUEMENT avec un objet JSON valide.
ATTENTION : Tous les noms de tables doivent être préfixés exactement par '{user_prefix}'.

Exemple de structure attendue (avec un préfixe fictif 'u1_') :
{example_json}
"""),
        ("human", "Voici les métadonnées: {metadata}\n\nGénère le modèle OLAP complet en JSON.")
    ])

    chain = prompt | llm

    print("Envoi des métadonnées au LLM pour modélisation...")
    response = call_with_retry(chain, {
        "metadata": str(metadata), 
        "user_prefix": user_prefix,
        "example_json": example_json
    })
    raw_text = extract_text(response)

    # Nettoyage des balises markdown si présentes
    raw_text = raw_text.replace("```json", "").replace("```", "").strip()

    try:
        logical_model = _parse_model_from_text(raw_text)
    except Exception as e:
        print(f"⚠️ Erreur parsing JSON: {e}. Tentative de réparation par l'Agent IA...")
        repair_prompt = ChatPromptTemplate.from_messages([
            ("system", "Tu es un expert JSON. Corrige ce JSON et renvoie uniquement le résultat valide."),
            ("human", "{invalid_json}")
        ])
        repair_resp = call_with_retry(repair_prompt | llm, {"invalid_json": raw_text})
        repaired_text = extract_text(repair_resp).replace("```json", "").replace("```", "").strip()
        logical_model = _parse_model_from_text(repaired_text)
    # Génération DDL SQL
    sql_statements = []
    for table in logical_model.tables:
        cols_sql = []
        fks = []
        for col in table.columns:
            col_def = f"    {col.name} {col.type}"
            if col.is_primary_key:
                col_def += " PRIMARY KEY"
            cols_sql.append(col_def)
            if col.is_foreign_key and col.references:
                # On s'assure que la référence inclut aussi le préfixe si ce n'est pas déjà le cas
                ref_name = col.references
                if user_prefix and not ref_name.startswith(user_prefix):
                    ref_name = user_prefix + ref_name
                
                target_pk = ""
                for t in logical_model.tables:
                    if t.name == ref_name:
                        for target_col in t.columns:
                            if target_col.is_primary_key:
                                target_pk = target_col.name
                                break
                        break

                if not target_pk:
                    target_pk = "id_sk" # fallback
                
                fks.append(f"    FOREIGN KEY ({col.name}) REFERENCES {ref_name}({target_pk})")
        
        all_cols = cols_sql + fks
        create_table_sql = f"CREATE TABLE IF NOT EXISTS {table.name} (\n" + ",\n".join(all_cols) + "\n);"
        sql_statements.append(create_table_sql)

    final_ddl = "\n\n".join(sql_statements)

    return {
        "logical_model": logical_model.dict(),
        "sql_ddl": final_ddl
    }
