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

class TableSchema(BaseModel):
    name: str
    type: str  # 'FAIT' ou 'DIMENSION'
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
                references=c.get("references")
            )
            for c in t.get("columns", [])
        ]
        tables.append(TableSchema(name=t["name"], type=t.get("type", "DIMENSION"), columns=cols))
    
    return DimensionalModelOutput(tables=tables, reasoning=raw.get("reasoning", ""))



def modeler_node(state: AgentState) -> dict:
    """Agent IA qui transforme les métadonnées brutes en modèle dimensionnel OLAP."""
    print("--- 🧠 AGENT MODÉLISATEUR : Analyse et Conception ---")
    
    metadata = state.get("source_metadata", {})
    if not metadata:
        print("Erreur : Aucune métadonnée trouvée.")
        return {"sql_ddl": "-- Erreur : Pas de métadonnées"}

    llm = get_llm(temperature=0)

    # Prompt qui force une sortie JSON structurée — compatible Ollama et Gemini
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un expert en Data Warehousing. 
Analyse les métadonnées et conçois un schéma OLAP en étoile (Star Schema).

RÉPONDS UNIQUEMENT avec un objet JSON valide respectant EXACTEMENT cette structure:
{{
  "tables": [
    {{
      "name": "fact_ventes",
      "type": "FAIT",
      "columns": [
        {{"name": "id_vente_sk", "type": "BIGINT", "is_primary_key": true, "is_foreign_key": false, "references": null}},
        {{"name": "dim_produit_sk", "type": "BIGINT", "is_primary_key": false, "is_foreign_key": true, "references": "dim_produit"}},
        {{"name": "montant_total_ttc", "type": "DECIMAL(12,2)", "is_primary_key": false, "is_foreign_key": false, "references": null}}
      ]
    }},
    {{
      "name": "dim_produit",
      "type": "DIMENSION",
      "columns": [
        {{"name": "produit_sk", "type": "BIGINT", "is_primary_key": true, "is_foreign_key": false, "references": null}},
        {{"name": "nom_produit", "type": "VARCHAR(255)", "is_primary_key": false, "is_foreign_key": false, "references": null}}
      ]
    }}
  ],
  "reasoning": "Explication courte du schéma choisi"
}}

Ne mets rien d'autre que le JSON. Pas de texte avant, pas de balises markdown."""),
        ("human", "Voici les métadonnées: {metadata}\n\nGénère le modèle OLAP complet en JSON.")
    ])

    chain = prompt | llm

    print("Envoi des métadonnées au LLM pour modélisation...")
    response = call_with_retry(chain, {"metadata": str(metadata)})
    raw_text = extract_text(response)

    # Nettoyage des balises markdown si présentes
    raw_text = raw_text.replace("```json", "").replace("```", "").strip()

    try:
        logical_model = _parse_model_from_text(raw_text)
    except Exception as e:
        print(f"⚠️ Erreur parsing JSON: {e}. Tentative de réparation par l'Agent IA...")
        try:
            repair_prompt = ChatPromptTemplate.from_messages([
                ("system", "Tu es un expert JSON. Le texte suivant contient un JSON invalide. Corrige les erreurs de syntaxe (par exemple, guillemets non échappés ou caractères illégaux) et renvoie le JSON strictement valide. Ne modifie pas la structure de base. RÉPONDS UNIQUEMENT AVEC LE JSON VALIDE."),
                ("human", "{invalid_json}")
            ])
            repair_resp = call_with_retry(repair_prompt | llm, {"invalid_json": raw_text})
            repaired_text = extract_text(repair_resp).replace("```json", "").replace("```", "").strip()
            logical_model = _parse_model_from_text(repaired_text)
            print("✅ Le JSON a été réparé avec succès par l'Agent IA !")
        except Exception as e2:
            print(f"⚠️ Échec de la réparation JSON: {e2}")
            return {"sql_ddl": f"-- Erreur parsing modèle: {e} | Échec réparation: {e2}\n\n/* JSON original:\n{raw_text[:800]}...\n*/"}

    print(f"✅ Modèle généré: {len(logical_model.tables)} tables.")
    print(f"Raisonnement: {logical_model.reasoning}")

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
                fks.append(f"    FOREIGN KEY ({col.name}) REFERENCES {col.references}({col.references.replace('dim_', '') + '_sk'})")
        
        all_cols = cols_sql + fks
        create_table_sql = f"CREATE TABLE IF NOT EXISTS {table.name} (\n" + ",\n".join(all_cols) + "\n);"
        sql_statements.append(create_table_sql)

    final_ddl = "\n\n".join(sql_statements)

    return {
        "logical_model": logical_model.dict(),
        "sql_ddl": final_ddl
    }
