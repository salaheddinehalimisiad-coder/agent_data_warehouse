# Fichier : nodes/chat_modifier.py — extrait correctif (BUG FIX #5)
#
# PROBLÈME ORIGINAL :
#   Après une première validation (is_validated=True), si l'utilisateur
#   demande une modification via le chat, chat_modifier reboucle sur critic
#   puis human_review. Mais is_validated étant toujours True dans le state,
#   route_after_review repart directement vers etl_generator SANS demander
#   une nouvelle validation humaine — l'utilisateur ne peut plus contrôler.
#
# CORRECTION :
#   chat_modifier_node doit remettre is_validated=False dans son dict de retour.

# ─── Pattern de retour CORRECT pour chat_modifier_node ───────────────────────

# À la fin de votre chat_modifier_node existant, assurez-vous que le dict
# retourné contient TOUJOURS :
RETURN_PATTERN_EXAMPLE = {
    "sql_ddl":       "... DDL modifié par le LLM ...",
    "logical_model": {},   # modèle mis à jour
    "is_validated":  False,   # ← BUG FIX #5 — OBLIGATOIRE
    "messages":      [],   # messages ajoutés à l'historique
}


# ─── Squelette complet de chat_modifier_node ─────────────────────────────────

from app_state import AgentState
from nodes.llm_factory import get_llm

CHAT_MODIFIER_SYSTEM_PROMPT = """
Tu es un expert Data Warehouse et modélisation OLAP.
L'utilisateur te demande de modifier le schéma Star Schema ou le DDL SQL.
Applique les modifications demandées et retourne :
1. Le DDL SQL complet mis à jour
2. Le logical_model mis à jour (JSON)
Réponds en JSON avec les clés "sql_ddl" et "logical_model".
"""


def chat_modifier_node(state: AgentState) -> dict:
    """
    Applique les modifications demandées par l'utilisateur sur le modèle OLAP.

    BUG FIX #5 : remet is_validated=False pour forcer une re-validation
    humaine après chaque modification.
    """
    messages   = state.get("messages", [])
    sql_ddl    = state.get("sql_ddl", "")
    logical_model = state.get("logical_model", {})

    # Récupération du dernier message utilisateur
    last_user_msg = ""
    for msg in reversed(messages):
        role = msg.get("role") if isinstance(msg, dict) else getattr(msg, "type", "")
        content = msg.get("content") if isinstance(msg, dict) else getattr(msg, "content", "")
        if role in ("human", "user"):
            last_user_msg = content
            break

    if not last_user_msg:
        return {
            "is_validated": False,   # ← BUG FIX #5
        }

    llm = get_llm()

    prompt = f"""
Schéma actuel (DDL) :
```sql
{sql_ddl}
```

Modèle logique actuel :
```json
{logical_model}
```

Demande de modification :
{last_user_msg}

Retourne un JSON avec les clés "sql_ddl" (string) et "logical_model" (dict).
"""
    try:
        import json, re
        response = llm.invoke([
            {"role": "system", "content": CHAT_MODIFIER_SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ])
        raw = response.content.strip()

        # Nettoyage des balises markdown
        raw = re.sub(r"```json|```", "", raw).strip()
        data = json.loads(raw)

        return {
            "sql_ddl":       data.get("sql_ddl", sql_ddl),
            "logical_model": data.get("logical_model", logical_model),
            "is_validated":  False,   # ← BUG FIX #5 — toujours remettre à False
        }

    except Exception as e:
        print(f"❌ chat_modifier erreur : {e}")
        return {
            "sql_ddl":      sql_ddl,
            "logical_model": logical_model,
            "is_validated":  False,   # ← BUG FIX #5 — même en cas d'erreur
        }
