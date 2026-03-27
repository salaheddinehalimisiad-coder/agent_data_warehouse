import os
from nodes.llm_factory import get_llm, call_with_retry, extract_text
# Fichier : nodes/etl_generator.py

from langchain_core.prompts import ChatPromptTemplate
from app_state import AgentState


def _build_ktr_template(metadata: dict, logical_model: dict, dw_config: dict) -> str:
    """
    Génère un XML Pentaho Kettle Transformation (.ktr) de base
    à partir du modèle logique et des métadonnées source.
    Ce template est ensuite enrichi par le LLM.
    """
    dw_host = dw_config.get("host", "127.0.0.1")
    dw_port = dw_config.get("port", 3306)
    dw_user = dw_config.get("user", "root")
    dw_pass = dw_config.get("password", "")
    dw_db   = dw_config.get("database", "data_warehouse")

    tables = logical_model.get("tables", [])
    source_keys = list(metadata.keys())
    source_table = source_keys[0] if source_keys else "source"

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info>
    <name>ETL_{dw_db}</name>
    <description>Pipeline ETL généré automatiquement par Agent Data Warehouse IA</description>
    <extended_description/>
    <trans_version>1.0</trans_version>
    <trans_type>Normal</trans_type>
  </info>

  <!-- ═══ CONNEXION MYSQL TARGET ═══ -->
  <connection>
    <name>MySQL_DataWarehouse</name>
    <server>{dw_host}</server>
    <type>MYSQL</type>
    <access>Native</access>
    <database>{dw_db}</database>
    <port>{dw_port}</port>
    <username>{dw_user}</username>
    <password>{dw_pass}</password>
  </connection>

  <!-- ═══ STEPS ═══ -->

  <!-- STEP 1 : Chargement de la source -->
  <step>
    <name>Source_Input</name>
    <type>CsvInput</type>
    <description>Lecture de la source de données</description>
    <filename>${{FILE_PATH}}</filename>
    <headerPresent>Y</headerPresent>
    <separator>,</separator>
    <enclosure>&quot;</enclosure>
    <encoding>UTF-8</encoding>
    <lazy_conversion>N</lazy_conversion>
    <fields>
FIELDS_PLACEHOLDER
    </fields>
    <GUI>
      <xloc>80</xloc>
      <yloc>160</yloc>
      <draw>Y</draw>
    </GUI>
  </step>

  <!-- STEP 2 : Sélection et mapping des colonnes -->
  <step>
    <name>Select_Values</name>
    <type>SelectValues</type>
    <description>Sélection et renommage des colonnes pour le DW</description>
    <fields>
      <select_unspecified>N</select_unspecified>
    </fields>
    <GUI>
      <xloc>320</xloc>
      <yloc>160</yloc>
      <draw>Y</draw>
    </GUI>
  </step>

TABLES_STEPS_PLACEHOLDER

  <!-- ═══ HOPS ═══ -->
  <order>
    <hop>
      <from>Source_Input</from>
      <to>Select_Values</to>
      <enabled>Y</enabled>
    </hop>
HOPS_PLACEHOLDER
  </order>

</transformation>"""


def etl_generator_node(state: AgentState) -> dict:
    """Agent qui génère un fichier Pentaho Kettle Transformation (.ktr) pour le pipeline ETL."""
    print("\n--- ⚙️ AGENT ETL : Génération de la Transformation Pentaho (.ktr) ---")

    metadata      = state.get("source_metadata", {})
    logical_model = state.get("logical_model", {})
    dw_config     = state.get("dw_connection_config", {})

    llm = get_llm(temperature=0)

    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un expert Pentaho Data Integration (Kettle).
Ton rôle est de générer un fichier XML Transformation Pentaho (.ktr) COMPLET et VALIDE.

RÈGLES STRICTES :
1. Le fichier doit commencer par <?xml version="1.0" encoding="UTF-8"?> et contenir une balise <transformation>.
2. Inclure impérativement : une balise <connection> pour MySQL, des <step> pour chaque étape ETL, et des <order><hop> pour les connexions.
3. Les steps obligatoires :
   - "CsvInput" (ou "TableInput" si source SQL) pour lire la source
   - "SelectValues" pour mapper/renommer les colonnes
   - Un "TableOutput" PAR TABLE cible du Data Warehouse (fact + dimensions)
4. Chaque <step> doit avoir une section <GUI> avec des coordonnées <xloc>/<yloc> pour que Spoon affiche correctement le diagramme.
5. Les noms des tables cibles doivent correspondre EXACTEMENT au modèle logique fourni.
6. La connexion MySQL doit utiliser le nom "MySQL_DataWarehouse".
7. RÉPONDS UNIQUEMENT avec le XML complet. Aucune explication, aucun markdown.

Voici un exemple de step TableOutput valide :
<step>
  <name>Load_fact_ventes</name>
  <type>TableOutput</type>
  <connection>MySQL_DataWarehouse</connection>
  <schema/>
  <table>fact_ventes</table>
  <truncate>Y</truncate>
  <ignore_errors>N</ignore_errors>
  <use_batch>Y</use_batch>
  <commitSize>1000</commitSize>
  <GUI><xloc>560</xloc><yloc>160</yloc><draw>Y</draw></GUI>
</step>"""),
        ("human", """Métadonnées de la source : {metadata}

Modèle logique OLAP cible : {logical_model}

Connexion MySQL DW : {dw_config}

Génère la transformation Pentaho .ktr complète.""")
    ])

    chain = prompt | llm
    print("Envoi du modèle au LLM pour génération du .ktr Pentaho...")
    response = call_with_retry(chain, {
        "metadata": str(metadata),
        "logical_model": str(logical_model),
        "dw_config": str({k: v for k, v in dw_config.items() if k != "password"})  # Ne pas envoyer MDP
    })

    content = extract_text(response)
    # Nettoyage des balises markdown éventuelles
    ktr_xml = content.replace("```xml", "").replace("```", "").strip()

    # Fallback : si le LLM n'a pas généré de XML valide, utiliser le template de base
    if "<transformation>" not in ktr_xml:
        print("⚠️ LLM n'a pas généré du XML valide — utilisation du template de base.")
        ktr_xml = _build_ktr_template(metadata, logical_model, dw_config)

    print("✅ Transformation Pentaho .ktr générée avec succès.")
    return {
        "etl_code": ktr_xml,
        "retry_count": 0,
        "etl_error": ""
    }
