# Fichier : utils/connectors.py

from abc import ABC, abstractmethod
from typing import Dict, Any, List
import pandas as pd
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import SQLAlchemyError

# 1. Le contrat de base (L'interface que tous les connecteurs doivent respecter)
class BaseConnector(ABC):
    """
    Classe abstraite définissant la Couche de Connectivité Commune (Common Connectivity Layer).
    """
    
    @abstractmethod
    def connect(self) -> bool:
        """Établit et vérifie la connexion à la source."""
        pass

    @abstractmethod
    def extract_metadata(self) -> Dict[str, Any]:
        """
        Extrait les métadonnées (schémas, tables, colonnes).
        Retourne un dictionnaire standardisé pour l'Agent Explorateur.
        """
        pass

# 2. ---> VOTRE CODE SE PLACE ICI <---
class SQLConnector(BaseConnector):
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.engine = None

    def connect(self) -> bool:
        try:
            # Création du moteur SQLAlchemy sécurisé
            self.engine = create_engine(self.connection_string)
            # Tentative de connexion pour valider les identifiants
            with self.engine.connect() as connection:
                pass 
            return True
        except SQLAlchemyError as e:
            # En environnement professionnel, on loggue l'erreur pour le monitoring
            print(f"Échec de la connexion SQL : {e}")
            return False

    def extract_metadata(self) -> Dict[str, Any]:
        """Extrait la structure de la base en mode lecture seule."""
        if not self.engine:
            raise ConnectionError("Veuillez appeler connect() avant d'extraire les métadonnées.")
        
        inspector = inspect(self.engine)
        metadata = {}
        
        # Parcours logique de toutes les tables
        for table_name in inspector.get_table_names():
            columns = []
            for col in inspector.get_columns(table_name):
                columns.append({
                    "name": col['name'],
                    "type": str(col['type']),  # Ex: VARCHAR, INTEGER
                    "primary_key": col.get('primary_key', False)
                })
            metadata[table_name] = {"columns": columns}
            
        return metadata

# 3. L'adaptateur pour les fichiers CSV (Optionnel pour l'instant, mais recommandé pour l'architecture)
class CSVConnector(BaseConnector):
    def __init__(self, file_path: str, table_name: str = "csv_upload"):
        self.file_path = file_path
        self.table_name = table_name

    def connect(self) -> bool:
        try:
            pd.read_csv(self.file_path, nrows=1)
            return True
        except Exception as e:
            print(f"Erreur de lecture CSV : {e}")
            return False

    def extract_metadata(self) -> Dict[str, Any]:
        df = pd.read_csv(self.file_path, nrows=100)
        
        columns = []
        for col_name, dtype in df.dtypes.items():
            columns.append({
                "name": col_name,
                "type": str(dtype),
                "primary_key": False
            })
            
        return {self.table_name: {"columns": columns}}