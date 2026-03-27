"""
LLM Factory — Ollama Cloud (glm-5:cloud) en priorité.
Architecture :
  1. Ollama Cloud  : glm-5:cloud (via clé API, rapide)
  2. Ollama Local  : qwen2.5-coder:7b / mistral (fallback sans cloud)
  3. Gemini API    : dernier recours
"""
import os
import time
import logging
import requests

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL   = os.getenv("OLLAMA_BASE_URL",   "http://localhost:11434")
OLLAMA_API_KEY    = os.getenv("OLLAMA_API_KEY",    "")
OLLAMA_CLOUD_MODEL = os.getenv("OLLAMA_CLOUD_MODEL", "glm-5:cloud")

OLLAMA_LOCAL_MODELS = ["qwen2.5-coder:7b", "mistral:latest", "codellama:latest"]
GEMINI_MODELS       = ["gemini-1.5-flash", "gemini-1.5-flash-8b"]


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if OLLAMA_API_KEY:
        h["Authorization"] = f"Bearer {OLLAMA_API_KEY}"
    return h


def _ollama_is_running() -> bool:
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", headers=_headers(), timeout=4)
        return r.status_code == 200
    except Exception:
        return False


def _available_models() -> list:
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", headers=_headers(), timeout=4)
        return [m["name"] for m in r.json().get("models", [])]
    except Exception:
        return []


def _make_ollama(model: str, temperature: float, num_predict: int = 4096):
    """Crée un ChatOllama avec authentification cloud si clé disponible."""
    from langchain_ollama import ChatOllama

    kwargs = dict(
        model=model,
        base_url=OLLAMA_BASE_URL,
        temperature=temperature,
        num_predict=num_predict,
        timeout=120,
    )
    # Passer la clé API dans les headers HTTP (nécessaire pour modèles cloud)
    if OLLAMA_API_KEY:
        kwargs["client_kwargs"] = {
            "headers": {"Authorization": f"Bearer {OLLAMA_API_KEY}"}
        }
    return ChatOllama(**kwargs)


def get_llm(temperature: float = 0):
    """
    Sélection automatique du LLM le plus rapide disponible.
    Ordre : Modèles Cloud configurés dans Ollama → Ollama local (ex: qwen) → Gemini API en secours.
    Toute l'interaction se fait via l'URL Ollama locale (11434).
    """
    
    if _ollama_is_running():
        available = _available_models()
        print(f"→ Ollama actif | Modèles détectés: {available}", flush=True)

        # ── 1. Modèle Cloud prioritaire pointant vers Ollama Local (ex: glm-5:cloud) ─────────────
        cloud_match = next((m for m in available if OLLAMA_CLOUD_MODEL.split(":")[0] in m), None)
        if cloud_match:
            try:
                llm = _make_ollama(cloud_match, temperature)
                print(f"☁️  LLM Cloud Ollama sélectionné: {cloud_match} — connecté en local (11434)", flush=True)
                return llm
            except Exception as e:
                logger.warning(f"Échec cloud interne {cloud_match}: {e}")

        # ── 2. Autres modèles cloud détectés dans l'Ollama local ────────────────────
        cloud_models = [m for m in available if "cloud" in m.lower() and "120b" not in m.lower()]
        for model in cloud_models:
            try:
                llm = _make_ollama(model, temperature)
                print(f"☁️  LLM Cloud Ollama: {model}", flush=True)
                return llm
            except Exception as e:
                logger.warning(f"Échec cloud interne {model}: {e}")

        # ── 3. Fallback sur les vrais modèles purement locaux (qwen, mistral) ─────────────
        for model_name in OLLAMA_LOCAL_MODELS:
            matched = next((m for m in available if model_name.split(":")[0] in m), None)
            if matched:
                try:
                    llm = _make_ollama(matched, temperature)
                    print(f"🤖 LLM Local: {matched}", flush=True)
                    return llm
                except Exception as e:
                    logger.warning(f"Échec local interne {matched}: {e}")

    else:
        print("⚠️ Ollama inaccessible — fallback Gemini...", flush=True)

    # ── 4. Gemini dernier recours ────────────────────────────────
    api_key = os.getenv("GOOGLE_API_KEY", "")
    if api_key:
        for model in GEMINI_MODELS:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                llm = ChatGoogleGenerativeAI(model=model, temperature=temperature)
                print(f"🌐 LLM Fallback Gemini: {model}", flush=True)
                return llm
            except Exception as e:
                logger.warning(f"Gemini {model}: {e}")

    raise RuntimeError(
        "Aucun LLM disponible.\n"
        "→ Vérifiez qu'Ollama tourne (`ollama serve`)\n"
        "→ Vérifiez OLLAMA_API_KEY dans votre .env"
    )


def call_with_retry(chain_or_llm, inputs: dict, max_retries: int = 3, base_delay: float = 5.0):
    """Appelle un chain/LLM avec retry automatique."""
    for attempt in range(max_retries):
        try:
            return chain_or_llm.invoke(inputs)
        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                import re
                delay = base_delay * (2 ** attempt)
                m = re.search(r"retry in (\d+)", err)
                if m:
                    delay = max(delay, int(m.group(1)) + 5)
                if attempt < max_retries - 1:
                    print(f"⏳ Quota atteint — attente {int(delay)}s (tentative {attempt+2}/{max_retries})...")
                    time.sleep(delay)
                else:
                    raise RuntimeError(f"Quota épuisé après {max_retries} tentatives.") from e
            elif "timeout" in err.lower() or "connection" in err.lower():
                if attempt < max_retries - 1:
                    wait = 5 * (attempt + 1)
                    print(f"⏳ Timeout — retry {attempt+2}/{max_retries} dans {wait}s...")
                    time.sleep(wait)
                else:
                    raise
            else:
                raise


def extract_text(response) -> str:
    """Extrait le texte d'une réponse LLM (Ollama ou Gemini)."""
    content = getattr(response, "content", str(response))
    if isinstance(content, list):
        return "".join(
            p["text"] if isinstance(p, dict) and "text" in p else str(p)
            for p in content
        )
    return str(content)
