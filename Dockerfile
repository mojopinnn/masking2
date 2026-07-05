# Production-ready Dockerfile for Segment Anything (SAM 2/3) Video Predictor on NVIDIA L4 GPUs
FROM pytorch/pytorch:2.2.2-cuda12.1-cudnn8-devel

# Set system environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=3000

# Install system libraries needed by OpenCV and Git compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    build-essential \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy python packages requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Clone official Meta Segment Anything 2 repo and install with CUDA compilation
RUN git clone https://github.com/facebookresearch/segment-anything-2.git /app/sam2_source && \
    cd /app/sam2_source && \
    pip install -e . && \
    cp -r /app/sam2_source/sam2 /app/sam2 && \
    cp -r /app/sam2_source/checkpoints /app/checkpoints || true

# Copy application source code
COPY main.py .
COPY initialize_weights.py .

# Pre-download and cache model weights inside the container during build time
# This saves precious Cloud Run boot-up latency and prevents timeouts
RUN python initialize_weights.py

# Expose standard port 3000 required for Google AI Studio and Cloud Run ingress
EXPOSE 3000

# Start FastAPI server using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]
