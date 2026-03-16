# Fichier : nodes/explorer.py

from typing import Dict, Any
# Importation de l'état global (le "Cerveau")
from app_state import AgentState
# Importation de notre couche de connectivité (Common Connectivity Layer)
from utils.connectors import SQLConnector, CSVConnector

def explorer_node(state: AgentState) -> dict:
    """
    Nœud LangGraph représentant l'Agent Explorateur.
    Il utilise le connecteur approprié pour extraire les métadonnées.
    """
    print("--- 🔍 AGENT EXPLORATEUR : Démarrage de l'extraction ---")
    
    # Dans la pratique, les informations saisies par l'utilisateur dans la Modale (Étape A) 
    # doivent être passées dans l'état global. 
    # On récupère ces configurations de connexion :
    config = state.get("connection_config", {})
    source_type = config.get("type", "sql") # Par défaut 'sql', mais peut être 'csv'
    
    connector = None
    
    # 1. Instanciation du bon adaptateur (Application du principe Ouvert/Fermé)
    if source_type == "sql":
        # Exemple de chaîne de connexion SQLAlchemy saisie via le frontend
        connection_string = config.get("connection_string", "sqlite:///:memory:")
        connector = SQLConnector(connection_string=connection_string)
        
    elif source_type == "csv":
        file_path = config.get("file_path", "upload/data.csv")
        connector = CSVConnector(file_path=file_path)
        
    else:
        raise ValueError(f"Type de source non supporté : {source_type}")

    # 2. Exécution de la tâche : Connexion et Extraction
    metadata = {}
    if connector.connect():
        print(f"Connexion réussie à la source : {source_type}.")
        # L'agent extrait le dictionnaire standardisé
        metadata = connector.extract_metadata()
        print(f"Métadonnées extraites avec succès ({len(metadata)} entités trouvées).")
    else:
        print("Erreur : Impossible d'établir la connexion avec la source.")
        # En environnement de production, on pourrait ajouter une clé 'error' au state ici
        
    # 3. Mise à jour du graphe
    # Dans LangGraph, renvoyer un dictionnaire met à jour les clés correspondantes dans l'AgentState
    return {"source_metadata": metadata}
