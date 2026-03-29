# Fichier : utils/connectors.py

from abc import ABC, abstractmethod
from typing import Dict, Any, List
import pandas as pd

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

# 2. L'adaptateur pour les fichiers CSV
class CSVConnector(BaseConnector):
    def __init__(self, file_path: str, table_name: str = "csv_upload"):
        self.file_path = file_path
        self.table_name = table_name
        self._successful_sep = ','
        self._successful_enc = 'utf-8'

    def connect(self) -> bool:
        from io import open
        import os
        if not os.path.exists(self.file_path):
            print(f"Erreur : Le fichier n'existe pas physiquement à {self.file_path}")
            return False

        separators = [',', ';', '\t', '|']
        encodings = ['utf-8', 'ISO-8859-1', 'cp1252', 'latin1']
        
        for enc in encodings:
            for sep in separators:
                try:
                    df = pd.read_csv(self.file_path, sep=sep, encoding=enc, encoding_errors='replace', nrows=100, on_bad_lines='skip')
                    if not df.empty and len(df.columns) > 1 or len(separators) == 1:
                        self._successful_sep = sep
                        self._successful_enc = enc
                        return True
                except Exception:
                    continue
                    
        # Fallback de test ultime
        try:
            pd.read_csv(self.file_path, nrows=50, encoding_errors='replace', on_bad_lines='skip')
            return True
        except Exception as e:
            print(f"Erreur fatale de lecture CSV '{self.file_path}': {str(e)}")
            return False

    def extract_metadata(self) -> Dict[str, Any]:
        try:
            df = pd.read_csv(self.file_path, sep=self._successful_sep, encoding=self._successful_enc, encoding_errors='replace', nrows=200, on_bad_lines='skip')
        except Exception as e:
            print(f"Erreur lors de l'extraction des métadonnées avec {self._successful_enc}: {str(e)}")
            df = pd.read_csv(self.file_path, encoding='utf-8', encoding_errors='replace', nrows=200, on_bad_lines='skip')
            
        columns = []
        for col_name, dtype in df.dtypes.items():
            columns.append({
                "name": str(col_name).strip(),
                "type": str(dtype),
                "primary_key": False
            })
            
        return {self.table_name: {"columns": columns}}