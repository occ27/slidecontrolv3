import sys
import logging
import asyncio
import uvicorn
from api.main import app as desktop_api

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend")

def main():
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    port = 8767
    logger.info(f"SlideControl V3 (Modo Electron) - Porta {port}")
    config = uvicorn.Config(desktop_api, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    server.run()

if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()
    main()
