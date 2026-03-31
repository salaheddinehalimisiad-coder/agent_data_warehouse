import os
from nodes.llm_factory import get_llm, call_with_retry, extract_text
# Fichier : nodes/etl_generator.py

from langchain_core.prompts import ChatPromptTemplate
from app_state import AgentState


def _build_ktr_template(metadata: dict, logical_model: dict, dw_config: dict) -> str:
    """
    Génère un XML Pentaho Kettle Transformation (.ktr) séquentiel
    pour garantir l'intégrité référentielle (Dimensions -> Faits).
    """
    dw_host = dw_config.get("host", "127.0.0.1")
    dw_port = dw_config.get("port", 3306)
    dw_user = dw_config.get("user", "root")
    dw_pass = dw_config.get("password", "")
    dw_db   = dw_config.get("database", "data_warehouse")

    tables = logical_model.get("tables", []) or []
    dimensions = [t for t in tables if "dim_" in (t.get("name") or "")]
    facts      = [t for t in tables if "fact_" in (t.get("name") or "")]

    from xml.sax.saxutils import escape as xml_escape

    source_table = next(iter(metadata.keys()), "source") if isinstance(metadata, dict) else "source"
    source_columns = []
    try:
        source_columns = metadata.get(source_table, {}).get("columns", [])
    except Exception:
        source_columns = []

    def _map_csv_dtype_to_kettle_type(dtype: str) -> str:
        d = str(dtype or "").lower()
        if "int" in d or "uint" in d:
            return "Integer"
        if any(x in d for x in ["float", "double", "decimal", "number"]):
            return "Number"
        if any(x in d for x in ["date", "time"]):
            return "Date"
        return "String"

    fields_xml = "\n".join(
        [
            (
                "<field>"
                f"<name>{xml_escape(str(col.get('name','')))}</name>"
                f"<type>{xml_escape(_map_csv_dtype_to_kettle_type(col.get('type')))}</type>"
                "<length>-1</length>"
                "<precision>-1</precision>"
                "</field>"
            )
            for col in source_columns
            if col.get("name")
        ]
    )

    steps_xml = []
    hops_xml = []
    
    current_step = "Source_Input"
    x_pos = 80
    y_pos = 160

    # 1. Lookups pour chaque Dimension
    for idx, d in enumerate(dimensions):
        d_name = d.get("name", f"dim_{idx}")
        step_name = f"Lookup_{d_name}"
        x_pos += 180
        
        # On devine la clé de recherche par défaut (colonne sans _sk)
        columns = d.get("columns", [])
        search_key = columns[0].get("name", "id") if columns else "id"
        sk_field = f"{d_name}_sk"

        steps_xml.append(f"""<step>
    <name>{xml_escape(step_name)}</name>
    <type>CombinationLookup</type>
    <connection>MySQL_DataWarehouse</connection>
    <schema/>
    <table>{xml_escape(d_name)}</table>
    <commit>1</commit>
    <cache_size>9999</cache_size>
    <replace>N</replace>
    <preloadCache>N</preloadCache>
    <crc>N</crc>
    <crcfield>hashcode</crcfield>
    <fields>
        <key>
            <name>{xml_escape(search_key)}</name>
            <lookup>{xml_escape(search_key)}</lookup>
        </key>
        <return>
            <name>{xml_escape(sk_field)}</name>
            <creation_method>autoinc</creation_method>
            <use_autoinc>Y</use_autoinc>
        </return>
    </fields>
    <GUI><xloc>{x_pos}</xloc><yloc>{y_pos}</yloc><draw>Y</draw></GUI>
</step>""")
        
        hops_xml.append(f"""<hop><from>{xml_escape(current_step)}</from><to>{xml_escape(step_name)}</to><enabled>Y</enabled></hop>""")
        current_step = step_name

    # 2. Select Values pour nettoyer avant les Faits
    x_pos += 180
    
    # Conserver uniquement les colonnes du flux qui existent dans la table de faits
    select_fields = []
    if facts:
        # Exclure la PK de la table de faits (elle sera auto-incrémentée par MySQL)
        fact_cols = [c.get("name") for c in facts[0].get("columns", []) if not c.get("is_primary_key", False)]
        for col_name in fact_cols:
            select_fields.append(f"      <field><name>{xml_escape(col_name)}</name></field>")
            
    fields_xml_str = "\n".join(select_fields)
    
    steps_xml.append(f"""<step>
    <name>Select_Values</name>
    <type>SelectValues</type>
    <fields>
{fields_xml_str}
      <select_unspecified>N</select_unspecified>
    </fields>
    <GUI><xloc>{x_pos}</xloc><yloc>{y_pos}</yloc><draw>Y</draw></GUI>
</step>""")
    hops_xml.append(f"""<hop><from>{xml_escape(current_step)}</from><to>Select_Values</to><enabled>Y</enabled></hop>""")
    current_step = "Select_Values"

    # 3. Insertion dans la Table de Faits
    for idx, f in enumerate(facts):
        f_name = f.get("name", f"fact_{idx}")
        step_name = f"Load_{f_name}"
        x_pos += 180
        
        # Forcer le Mapping explicite dans le TableOutput (fallback minimaliste)
        fact_cols = [c.get("name") for c in f.get("columns", []) if not c.get("is_primary_key", False)]
        mapping_xml_list = []
        for col in fact_cols:
            stream_name = col
            if col.endswith("_bk") and not any(c.get("name") == col for c in source_columns):
                base_name = col[:-3]
                if any(c.get("name") == base_name for c in source_columns):
                    stream_name = base_name
            mapping_xml_list.append(f"      <field><column_name>{xml_escape(col)}</column_name><stream_name>{xml_escape(stream_name)}</stream_name></field>")
        mapping_xml = "\n".join(mapping_xml_list)
        
        steps_xml.append(f"""<step>
    <name>{xml_escape(step_name)}</name>
    <type>TableOutput</type>
    <connection>MySQL_DataWarehouse</connection>
    <table>{xml_escape(f_name)}</table>
    <truncate>Y</truncate>
    <commitSize>1000</commitSize>
    <specify_fields>Y</specify_fields>
    <fields>
{mapping_xml}
    </fields>
    <GUI><xloc>{x_pos}</xloc><yloc>{y_pos}</yloc><draw>Y</draw></GUI>
</step>""")
        hops_xml.append(f"""<hop><from>{xml_escape(current_step)}</from><to>{xml_escape(step_name)}</to><enabled>Y</enabled></hop>""")
        # Pour plusieurs tables de faits, on repartirait de Select_Values ou en série. Ici série.
        current_step = step_name

    table_steps_joined = "\n".join(steps_xml)
    hops_joined = "\n".join(hops_xml)

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<transformation>
  <info><name>ETL_{dw_db}</name><trans_version>1.0</trans_version><trans_type>Normal</trans_type></info>
  <connection>
    <name>MySQL_DataWarehouse</name>
    <server>{dw_host}</server><type>MYSQL</type><access>Native</access>
    <database>{dw_db}</database><port>{dw_port}</port>
    <username>{dw_user}</username><password>{dw_pass}</password>
  </connection>
  <step>
    <name>Source_Input</name>
    <type>CsvInput</type>
    <filename>${{FILE_PATH}}</filename>
    <headerPresent>Y</headerPresent>
    <fields>{fields_xml}</fields>
    <GUI><xloc>80</xloc><yloc>160</yloc><draw>Y</draw></GUI>
  </step>
{table_steps_joined}
  <order>
{hops_joined}
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
Ton rôle est de générer un fichier XML (.ktr) SÉQUENTIEL pour un schéma en étoile.

MISSION : RÉSOLUTION DE L'ERREUR INCORRECT INTEGER VALUE
Tu dois refactoriser l'algorithme de génération du XML pour appliquer ces deux règles obligatoires :

1. GÉNÉRER UNE CHAÎNE DE COMPOSANTS CombinationLookup :
Entre l'étape CsvInput et TableOutput, ton code DOIT générer séquentiellement les étapes de recherche pour CHAQUE dimension. 
Voici le modèle XML exact que ton code doit produire pour l'étape de Lookup (à adapter dynamiquement pour le Temps, le Produit, la Géographie, etc. selon les dimensions de {logical_model}) :

<step>
  <name>Lookup_Client</name>
  <type>CombinationLookup</type>
  <connection>MySQL_DataWarehouse</connection>
  <schema/>
  <table>u1_dim_client</table>
  <commit>1</commit>
  <cache_size>9999</cache_size>
  <replace>N</replace>
  <preloadCache>N</preloadCache>
  <crc>N</crc>
  <crcfield>hashcode</crcfield>
  <fields>
    <key>
      <name>client_id</name>
      <lookup>client_id</lookup>
    </key>
    <return>
      <name>dim_client_sk</name>
      <creation_method>autoinc</creation_method>
      <use_autoinc>Y</use_autoinc>
    </return>
  </fields>
</step>

2. FORCER LE MAPPING EXPLICITE DANS LE TableOutput :
L'étape d'insertion dans la table de faits ne doit plus se faire à l'aveugle. Ton code doit OBLIGATOIREMENT injecter la balise <specify_fields>Y</specify_fields> et mapper les Surrogate Keys générées par les Lookups vers les colonnes physiques de la base.
Ton code doit générer ce bloc exact (adapté aux colonnes de ta table de faits) dans le <step> du TableOutput :

<specify_fields>Y</specify_fields>
<fields>
  <field><column_name>dim_temps_sk</column_name><stream_name>dim_temps_sk</stream_name></field>
  <field><column_name>dim_client_sk</column_name><stream_name>dim_client_sk</stream_name></field>
  <field><column_name>dim_produit_sk</column_name><stream_name>dim_produit_sk</stream_name></field>
  <field><column_name>dim_geographie_sk</column_name><stream_name>dim_geographie_sk</stream_name></field>
  <field><column_name>dim_canal_sk</column_name><stream_name>dim_canal_sk</stream_name></field>
  <field><column_name>quantite</column_name><stream_name>quantite</stream_name></field>
  <field><column_name>prix_unitaire</column_name><stream_name>prix_unitaire</stream_name></field>
  <field><column_name>remise_pct</column_name><stream_name>remise_pct</stream_name></field>
  <field><column_name>montant_total</column_name><stream_name>montant_total</stream_name></field>
  <field><column_name>id_vente_bk</column_name><stream_name>id_vente</stream_name></field>
</fields>

3. METTRE À JOUR LES HOPS (<order>) :
Le flux généré doit relier les étapes de manière strictement linéaire : 
CsvInput -> Lookup_Temps -> Lookup_Client -> Lookup_Produit -> Lookup_Geographie -> Lookup_Canal -> SelectValues -> TableOutput_Fact.

N'oublie pas l'étape SelectValues juste avant le TableOutput avec le filtre approprié !
"""),
        ("human", """Métadonnées source : {metadata}
Modèle logique cible (Star Schema) : {logical_model}
Connexion MySQL DW : {dw_config}

Génère la transformation Pentaho .ktr séquentielle complète avec ces corrections de mapping.""")
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

    import xml.etree.ElementTree as ET
    placeholder_tokens = ("FIELDS_PLACEHOLDER", "TABLES_STEPS_PLACEHOLDER", "HOPS_PLACEHOLDER")

    def _validate_ktr(xml_str: str) -> tuple[bool, str]:
        if not xml_str or "<transformation" not in xml_str.lower():
            return False, "missing <transformation> tag"
        for t in placeholder_tokens:
            if t in xml_str:
                return False, f"contains placeholder token {t}"
        try:
            ET.fromstring(xml_str)
        except ET.ParseError as e:
            return False, f"XML parse error: {e}"
        return True, ""

    ok, reason = _validate_ktr(ktr_xml)
    if not ok:
        print(f"⚠️ KTR invalide ({reason}) — fallback template minimaliste.")
        ktr_xml = _build_ktr_template(metadata, logical_model, dw_config)
        ok2, reason2 = _validate_ktr(ktr_xml)
        if not ok2:
            raise ValueError(f"Impossible de construire un KTR XML valide : {reason2}")

    print("✅ Transformation Pentaho .ktr générée avec succès.")
    return {
        "etl_code": ktr_xml,
        "retry_count": 0,
        "etl_error": ""
    }
