# Fichier : nodes/healer.py

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from app_state import AgentState

def healer_node(state: AgentState) -> dict:
    """Agent qui analyse la trace d'erreur (Stack Trace) et corrige le code ETL."""
    retry_count = state.get("retry_count", 0)
    
    print(f"\n--- 🚑 AGENT CORRECTEUR (SELF-HEALING) : Tentative de réparation {retry_count + 1}/3 ---")
    
    failed_code = state.get("etl_code")
    error_log = state.get("etl_error")
    
    llm = ChatGoogleGenerativeAI(model="gemini-flash-latest", temperature=0)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un ingénieur de fiabilité (SRE) expert en PySpark.
        Le script ETL ci-dessous a échoué avec l'erreur fournie.
        Analyse la cause racine (ex: type mismatch, dérive de schéma, colonne manquante).
        Rédige une version corrigée et robuste du script PySpark.
        Ne renvoie QUE le code Python pur."""),
        ("human", "Code fautif :\n{failed_code}\n\nErreur (Stack Trace) :\n{error_log}")
    ])
    
    chain = prompt | llm
    response = chain.invoke({"failed_code": failed_code, "error_log": error_log})
    
    content = response.content
    if isinstance(content, list):
        content = "".join([c.get("text", "") if isinstance(c, dict) else str(c) for c in content])
        
    healed_code = content.replace("```python", "").replace("```", "").strip()
    
    print("Code ETL analysé et corrigé par l'IA.")
    
    return {
        "etl_code": healed_code,
        "retry_count": retry_count + 1,
        "etl_error": "" # On efface l'erreur pour la prochaine tentative
    }