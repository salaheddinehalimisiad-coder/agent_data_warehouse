# Fichier : nodes/etl_executor.py
# Architecture professionnelle d'entreprise : cible MySQL avec SQLAlchemy.
# Ce nœud "instancie physiquement" le Data Warehouse.
# Stratégie :
#   1. Connexion à MySQL via SQLAlchemy (connexion poolée, réutilisable)
#   2. Création du schéma DDL dans la base MySQL cible
#   3. Chargement des données source (CSV / SQL) via Pandas + to_sql()

import traceback
import os
import re
import pandas as pd
from sqlalchemy import create_engine, text
from app_state import AgentState


def _get_mysql_engine(config: dict):
    """Crée un moteur SQLAlchemy vers le Data Warehouse MySQL cible."""
    from urllib.parse import quote_plus
    host     = config.get("host", "127.0.0.1")
    port     = int(config.get("port", 3306))
    user     = config.get("user", "root")
    password = quote_plus(config.get("password", ""))  # Encode les caractères spéciaux (; : @ ...)
    database = config.get("database", "data_warehouse")

    url = f"mysql+mysqlconnector://{user}:{password}@{host}:{port}/{database}"
    engine = create_engine(url, pool_pre_ping=True, pool_recycle=3600)
    return engine


def _strip_foreign_keys(ddl: str) -> str:
    """
    Supprime les contraintes FOREIGN KEY du DDL.
    Dans un Data Warehouse OLAP, l'intégrité référentielle est gérée par l'ETL,
    pas par la base de données (meilleure performance en chargement).
    """
    # Supprimer les lignes contenant FOREIGN KEY ou REFERENCES
    lines = ddl.split('\n')
    cleaned = []
    for line in lines:
        upper = line.upper().strip()
        if 'FOREIGN KEY' in upper or ('REFERENCES' in upper and 'FOREIGN' not in upper and upper.startswith(',')):
            continue
        cleaned.append(line)
    result = '\n'.join(cleaned)
    # Nettoyer les virgules trailing avant les parenthèses fermantes (,\n)
    result = re.sub(r',(\s*\n\s*)\)', r'\1)', result)
    return result


def _create_warehouse_schema(engine, ddl: str) -> tuple[bool, str]:
    """Crée les tables DDL dans la base MySQL cible (DROP + CREATE pour un Full Load propre)."""
    try:
        # Nettoyage des commentaires et suppression des FK (OLAP best practice)
        ddl_clean = re.sub(r'--[^\n]*', '', ddl)
        ddl_clean = _strip_foreign_keys(ddl_clean)

        # Séparer les statements
        statements = [s.strip() for s in ddl_clean.split(';') if s.strip()]

        # Isoler les CREATE TABLE et les autres (INDEX, ALTER...)
        create_stmts = [s for s in statements if re.search(r'CREATE\s+TABLE', s, re.IGNORECASE)]
        other_stmts  = [s for s in statements if s not in create_stmts and re.search(r'(ALTER|CREATE INDEX)', s, re.IGNORECASE)]

        # Trier: dimensions en premier (sans FOREIGN KEY dans leur DDL), faits en dernier
        dim_stmts  = [s for s in create_stmts if 'FOREIGN KEY' not in s.upper()]
        fact_stmts = [s for s in create_stmts if 'FOREIGN KEY' in s.upper()]
        ordered_stmts = dim_stmts + fact_stmts

        # Extraire les noms de tables pour les DROP
        table_names = []
        for s in ordered_stmts:
            m = re.search(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?', s, re.IGNORECASE)
            if m:
                table_names.append(m.group(1))

        with engine.begin() as conn:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))

            # DROP de toutes les tables existantes (ordre inverse pour les FK)
            for tbl in reversed(table_names):
                conn.execute(text(f"DROP TABLE IF EXISTS `{tbl}`;"))

            # CREATE dans l'ordre (dims → faits)
            for stmt in ordered_stmts:
                stmt_safe = re.sub(
                    r'CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)',
                    'CREATE TABLE IF NOT EXISTS ',
                    stmt, flags=re.IGNORECASE
                )
                try:
                    conn.execute(text(stmt_safe))
                except Exception as e:
                    # On log mais on continue (erreur de FK non bloquante)
                    print(f"   ⚠️ Warning DDL (non bloquant) : {e}")

            # Exécuter les ALTER / INDEX après les tables
            for stmt in other_stmts:
                try:
                    conn.execute(text(stmt))
                except Exception as e:
                    print(f"   ⚠️ Warning ALTER (non bloquant): {e}")

            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))

        return True, f"Schéma MySQL créé : {len(table_names)} table(s) → {', '.join(table_names)}"

    except Exception:
        return False, f"Erreur création du schéma DDL:\n{traceback.format_exc()}"


def _load_data(engine, state: AgentState) -> tuple[bool, str]:
    """Charge les données source (CSV) dans les tables MySQL via Pandas."""
    try:
        conn_config   = state.get("connection_config", {})
        logical_model = state.get("logical_model", {})
        source_path   = conn_config.get("file_path", "")

        if not source_path:
            # Si c'est une base SQL source, on ne charge pas de CSV ici
            return True, "Source SQL : les données sont accessibles directement via les connecteurs."

        if not os.path.exists(source_path):
            return False, f"Fichier source introuvable : '{source_path}'"

        df_source = pd.read_csv(source_path)
        print(f"   📋 Source : {len(df_source)} lignes × {len(df_source.columns)} colonnes")

        rows_total = 0
        dimensions = logical_model.get("dimensions", [])
        fact_table = logical_model.get("fact_table", {})

        # Charger les dimensions (dédoublonnées)
        for dim in dimensions:
            dim_name = dim.get("table_name", "")
            if not dim_name:
                continue
            dim_cols = [c.get("name", "") for c in dim.get("columns", [])]
            src_cols = [c for c in dim_cols if c in df_source.columns]
            if src_cols:
                df_dim = df_source[src_cols].drop_duplicates().reset_index(drop=True)
                df_dim.to_sql(
                    dim_name, engine,
                    if_exists='append',   # Schema déjà créé, on append
                    index=True,
                    index_label="surrogate_key",
                    chunksize=1000,
                    method='multi'
                )
                rows_total += len(df_dim)
                print(f"   ✅ {dim_name} : {len(df_dim)} lignes")

        # Charger les faits (table principale brute)
        if fact_table:
            fact_name = fact_table.get("table_name", "")
            if fact_name:
                df_source.to_sql(
                    fact_name, engine,
                    if_exists='append',
                    index=True,
                    index_label="surrogate_key",
                    chunksize=5000,
                    method='multi'
                )
                rows_total += len(df_source)
                print(f"   ✅ {fact_name} (faits) : {len(df_source)} lignes")

        return True, f"Chargement réussi : {rows_total} lignes insérées dans MySQL"

    except Exception:
        return False, f"Erreur chargement ETL:\n{traceback.format_exc()}"


def etl_executor_node(state: AgentState) -> dict:
    """
    Nœud d'exécution ETL professionnel (Étape D du cahier des charges).
    - Connexion MySQL via SQLAlchemy (poolée, sécurisée)
    - Exécution DDL pour instancier physiquement le Data Warehouse
    - Chargement Pandas → MySQL en mode bulk (chunksize)
    """
    print("\n--- 🏭 EXÉCUTEUR ETL : Instanciation physique du Data Warehouse (MySQL) ---")

    sql_ddl    = state.get("sql_ddl", "")
    dw_config  = state.get("dw_connection_config", {})

    if not sql_ddl or sql_ddl.strip().startswith("--"):
        return {"etl_error": "Aucun DDL SQL valide pour instancier le Data Warehouse."}

    if not dw_config:
        return {"etl_error": "Configuration MySQL cible manquante. Veuillez configurer la connexion au Data Warehouse."}

    # --- Étape 1 : Connexion au serveur MySQL cible ---
    try:
        print(f"   🔌 Connexion MySQL → {dw_config.get('host')}:{dw_config.get('port')}/{dw_config.get('database')}")
        engine = _get_mysql_engine(dw_config)
        with engine.connect() as c:
            c.execute(text("SELECT 1"))  # Test de connectivité
        print("   ✅ Connexion MySQL établie")
    except Exception:
        return {"etl_error": f"Impossible de se connecter à MySQL:\n{traceback.format_exc()}"}

    # --- Étape 2 : Création du schéma DDL ---
    schema_ok, schema_msg = _create_warehouse_schema(engine, sql_ddl)
    print(f"   {'✅' if schema_ok else '❌'} {schema_msg}")
    if not schema_ok:
        return {"etl_error": schema_msg}

    # --- Étape 3 : Chargement des données ---
    print("   📥 Chargement des données source → MySQL DW...")
    load_ok, load_msg = _load_data(engine, state)
    print(f"   {'✅' if load_ok else '❌'} {load_msg}")
    if not load_ok:
        return {"etl_error": load_msg}

    print(f"\n🎉 Data Warehouse MySQL opérationnel : {dw_config.get('database')}@{dw_config.get('host')}")
    return {"etl_error": ""}
