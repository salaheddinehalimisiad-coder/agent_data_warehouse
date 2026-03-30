# Fichier : nodes/healer.py — version corrigée
#
# BUGS CORRIGÉS :
#   BUG FIX #4 — retry_count n'était jamais incrémenté → boucle potentiellement infinie
#   BUG FIX #3 — validation XML du .ktr avant de renvoyer vers l'executor
#   AMÉLIORATION — log structuré de chaque tentative de correction

import xml.etree.ElementTree as ET
from app_state import AgentState
from nodes.llm_factory import get_llm

# Prompt système pour la correction du fichier .ktr Pentaho
HEALER_SYSTEM_PROMPT = """
Tu es un expert Pentaho Data Integration (PDI/Kettle).
On t'a fourni un fichier .ktr (XML Pentaho) qui a provoqué une erreur lors de son exécution.
Ton rôle est de corriger UNIQUEMENT le problème identifié dans le message d'erreur.
Réponds UNIQUEMENT avec le contenu XML corrigé, sans commentaire, sans balises markdown.
Le XML doit commencer par <?xml ou <transformation>.
"""


def healer_node(state: AgentState) -> dict:
    """
    Agent de réparation automatique du script ETL (.ktr Pentaho).

    Corrections appliquées vs version originale :
    - Incrémente retry_count dans le state retourné (BUG FIX #4)
    - Valide que le XML corrigé est bien formé avant de le retourner (BUG FIX #3)
    - Retourne un dict complet et explicite
    """
    etl_error = state.get("etl_error", "")
    etl_code = state.get("etl_code", "")
    current_retry = state.get("retry_count", 0)
    new_retry_count = current_retry + 1  # ← BUG FIX #4

    print(f"🔧 Healer — tentative {new_retry_count}/3 | erreur : {etl_error[:150]}")

    # ── Appel LLM pour correction ─────────────────────────────────────────
    llm = get_llm()

    prompt = f"""
Fichier .ktr actuel :
```xml
{etl_code}
```

Erreur d'exécution :
```
{etl_error}
```

Corrige le fichier .ktr pour résoudre cette erreur.
Réponds UNIQUEMENT avec le XML corrigé.
"""

    try:
        response = llm.invoke([
            {"role": "system", "content": HEALER_SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ])
        corrected_ktr = response.content.strip()

        # Nettoyer les éventuelles balises markdown que le LLM ajouterait
        if corrected_ktr.startswith("```"):
            lines = corrected_ktr.split("\n")
            corrected_ktr = "\n".join(
                line for line in lines
                if not line.strip().startswith("```")
            ).strip()

        # ── BUG FIX #3 : Validation XML avant d'envoyer à l'executor ──────
        try:
            ET.fromstring(corrected_ktr)
        except ET.ParseError as xml_err:
            explanation = (
                f"Tentative {new_retry_count} : le LLM a retourné un XML "
                f"mal formé ({xml_err}). Le script original est conservé."
            )
            print(f"⚠️  Healer XML invalide : {xml_err}")
            # On retourne le code original — l'executor va rééchouer,
            # mais retry_count est quand même incrémenté pour éviter la boucle
            return {
                "etl_code": etl_code,            # code original conservé
                "etl_error": etl_error,          # erreur conservée pour reroutage
                "retry_count": new_retry_count,  # ← incrémenté même en cas d'échec
                "healer_explanation": explanation,
            }

        explanation = (
            f"Tentative {new_retry_count} : correction appliquée. "
            f"Erreur originale : {etl_error[:200]}"
        )

        return {
            "etl_code": corrected_ktr,
            # etl_error est intentionnellement conservé ici —
            # c'est etl_executor qui le remettra à "" si l'exécution réussit
            "etl_error": etl_error,
            "retry_count": new_retry_count,   # ← BUG FIX #4
            "healer_explanation": explanation,
        }

    except Exception as e:
        explanation = f"Tentative {new_retry_count} : erreur LLM — {e}"
        print(f"❌ Healer LLM error : {e}")
        return {
            "etl_code": etl_code,
            "etl_error": etl_error,
            "retry_count": new_retry_count,   # ← incrémenté même en cas d'échec LLM
            "healer_explanation": explanation,
        }
