# Rapsometeddy Vision 1 (RV-1)

RV-1 is the from-scratch image-generation research engine added to Anime Studio without replacing the existing episode workflow.

## Model policy
- Model weights are initialized randomly.
- No pretrained diffusion, VAE, CLIP, tokenizer or image encoder weights.
- No remote image-generation APIs.
- Data must be original, public-domain with verified status, or explicitly licensed for this use.
- The first model is a small 64x64 pixel-space conditional DDPM. It is a research baseline, not a production-quality foundation model.

## Setup
Use Python 3.10/3.11 in a free notebook GPU runtime when available:
```bash
pip install -r rv1/requirements.txt
```

Create `rv1/data/captions.jsonl`, one JSON line per image:
```json
{"file":"images/your-image.png","caption":"original anime-inspired scene of a floating city at dusk"}
```
Image paths are relative to the JSONL manifest's directory. Keep source and license records in `rv1/data/SOURCES.md`.

Train:
```bash
python -m rv1.train --manifest rv1/data/captions.jsonl --steps 1000 --batch-size 4 --out rv1/checkpoints/rv1-alpha.pt
```

A tiny run validates code only. Meaningful image quality requires a substantial curated dataset, training time and suitable compute. Free notebook availability and quotas are not guaranteed.

## Web interface
The new studio page is `/image-studio`. It calls only an explicitly configured RV-1 engine URL. It has no third-party generation fallback.

Set `NEXT_PUBLIC_RV1_ENGINE_URL` only when you have an RV-1 inference server you control. Do not expose private credentials in this variable.

## Current status
Architecture and starter training pipeline are committed; no trained checkpoint is included. No model-training result is claimed.
