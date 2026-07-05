#!/usr/bin/env python3
import os
import urllib.request
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("initialize_weights")

CHECKPOINT_DIR = "./checkpoints"
CHECKPOINT_NAME = "sam2_hiera_large.pt"
CHECKPOINT_PATH = os.path.join(CHECKPOINT_DIR, CHECKPOINT_NAME)

# Official Meta SAM 2 Checkpoint URL
SAM2_LARGE_URL = "https://dl.fbaipublicfiles.com/segment_anything_2/072824/sam2_hiera_large.pt"

def download_weights():
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    
    if os.path.exists(CHECKPOINT_PATH):
        logger.info(f"Model checkpoint already exists at {CHECKPOINT_PATH}. Skipping download.")
        return
        
    logger.info(f"Model checkpoint not found. Commencing automatic download of Segment Anything 2 (SAM2 Large)...")
    logger.info(f"Source URL: {SAM2_LARGE_URL}")
    logger.info(f"Destination: {CHECKPOINT_PATH}")
    
    try:
        # Simple download progress monitor
        def progress_callback(count, block_size, total_size):
            if total_size > 0:
                percent = int(count * block_size * 100 / total_size)
                # Print progress every 10% to prevent spamming logs
                if percent % 10 == 0 and percent <= 100:
                    logger.info(f"Downloading checkpoint... {percent}% complete")

        urllib.request.urlretrieve(SAM2_LARGE_URL, CHECKPOINT_PATH, reporthook=progress_callback)
        logger.info("SAM 2 Model weight files downloaded and initialized successfully.")
    except Exception as e:
        logger.error(f"Error occurred while downloading SAM 2 checkpoints: {e}")
        logger.error("Please download the weights manually or check your internet connection.")

if __name__ == "__main__":
    download_weights()
