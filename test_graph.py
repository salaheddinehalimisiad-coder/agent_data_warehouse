import os
from dotenv import load_dotenv

load_dotenv()

from api.server import agent_app
config = {"configurable": {"thread_id": "test_123"}}
state = {
    "connection_config": {
        "type": "csv",
        "file_path": "ventes.csv"
    }
}
try:
    for event in agent_app.stream(state, config=config):
        print("Event:", event)
except Exception as e:
    import traceback
    traceback.print_exc()
