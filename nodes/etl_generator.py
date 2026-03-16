# Fichier : nodes/etl_generator.py

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from app_state import AgentState

def etl_generator_node(state: AgentState) -> dict:
    """Agent qui rédige le script PySpark pour transférer et transformer les données."""
    print("\n--- ⚙️ AGENT ETL : Génération du pipeline d'intégration ---")
    
    metadata = state.get("source_metadata")
    logical_model = state.get("logical_model")
    
    llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un Lead Data Engineer expert en Big Data.
        Ton rôle est d'écrire un script PySpark (en Python pur, sans markdown) de qualité production.
        RÈGLES STRICTES À RESPECTER :
        1. Schéma d'entrée explicite : Jamais de `inferSchema=True`. Utilise `StructType` et vérifie bien que l'ordre des champs correspond *exactement* à la source.
        2. Clés uniques (Surrogate Keys) IDEMPOTENTES : Utilise **uniquement `F.xxhash64(F.col("A"), F.col("B"))`** natif dans Spark (retourne un LongType sans risque d'overflow) au lieu de MD5 ou `monotonically_increasing_id`.
        3. Optimisation des Jointures (Performances) : Chaque jointure vers une table de dimension doit se faire via `F.broadcast(dim_nom.alias("alias_dim"))`. Ajoute IMPÉRATIVEMENT des alias explicites (ex: `df_faits.alias("src")`) sur les dataframes avant de faire tes conditions de jointure.
        4. Partitionnement optimisé : Lors de la sauvegarde finale, si tu partitionnes la table de faits par année/mois, NE FAIS PAS de re-jointure finale avec la dimension temps. Garde simplement les colonnes d'année/mois lors de la *première* jointure avec la table temps, et fais les voyager jusqu'à la fin via tes .select() successifs.
        5. Chaînage des Jointures (Prévention de Bug) : Ne fais JAMAIS de `.select()` intermédiaire entre tes jointures pour la table de faits pour ne pas perdre l'alias "src". Tu dois enchaîner TOUTES tes jointures d'un coup, puis faire un UNIQUE `.select()` final. Assigne l'alias `.alias("src")` *après* toutes tes opérations `.withColumn()` de préparation.
        6. Prévention de l'Overflow sur les clés : Un hash généré par `F.xxhash64()` est gigantesque. Lorsque tu fais ton `.select()` final (pour les dims ou les faits), **assure-toi que TOUS les champs de clés (`_sk`, `_key`) sont castés en `.cast(LongType())`** et absolument jamais en `IntegerType()` sous peine d'effondrement par débordement silencieux.
        
        Ne renvoie QUE le code Python complet et fonctionnel, sans balises GFM Markdown."""),
        ("human", "Métadonnées sources : {metadata}\nModèle cible : {logical_model}")
    ])
    
    chain = prompt | llm
    response = chain.invoke({"metadata": metadata, "logical_model": logical_model})
    
    content = response.content
    if isinstance(content, list):
        # Extraire le texte si c'est une liste de dicts
        content = "".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
        
    # Nettoyage de la réponse si l'IA ajoute des balises ```python
    clean_code = content.replace("```python", "").replace("```", "").strip()
    
    print("Script PySpark généré avec succès.")
    return {
        "etl_code": clean_code,
        "retry_count": 0, # On initialise le compteur de tentatives
        "etl_error": ""
    }
