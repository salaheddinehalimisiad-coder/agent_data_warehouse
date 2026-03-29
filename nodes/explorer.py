# Fichier : nodes/explorer.py

from typing import Dict, Any
# Importation de l'état global (le "Cerveau")
from app_state import AgentState
import time
# Importation de notre couche de connectivité (Common Connectivity Layer)
from utils.connectors import CSVConnector

def explorer_node(state: AgentState) -> dict:
    """
    Nœud LangGraph représentant l'Agent Explorateur.
    Il utilise le connecteur CSV pour extraire les métadonnées.
    """
    print("--- 🔍 AGENT EXPLORATEUR : Démarrage de l'extraction ---")
    
    # Récupération de la configuration de connexion :
    config = state.get("connection_config", {})
    source_type = config.get("type", "csv")
    
    if source_type != "csv":
        # On force le CSV comme demandé par l'utilisateur
        source_type = "csv"
    
    file_path = config.get("file_path", "ventes.csv")
    import os
    table_name = os.path.splitext(os.path.basename(file_path))[0]
    connector = CSVConnector(file_path=file_path, table_name=table_name)

    # Exécution de la tâche : Connexion et Extraction
    metadata = {}
    if connector.connect():
        print(f"Connexion réussie à la source : {source_type}.")
        metadata = connector.extract_metadata()
        if not metadata:
            raise ValueError(f"Le fichier '{file_path}' semble vide ou n'a pas pu être lu correctement.")
        print(f"Métadonnées extraites avec succès ({len(metadata)} entités trouvées).")
    else:
        raise ValueError(f"Impossible d'établir la connexion avec la source '{file_path}'. Assurez-vous que le fichier a bien été uploadé.")
        
    return {"source_metadata": metadata}
