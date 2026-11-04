"""Local inference server for a trained RV-1 checkpoint. No remote generation provider."""
import os, uuid
from pathlib import Path
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from torchvision.utils import save_image
from .models import TextEncoder, RV1Denoiser, tokenize

app=FastAPI(title="Rapsometeddy RV-1 Local Engine")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["GET","POST"],allow_headers=["*"])
OUT=Path("rv1/outputs"); OUT.mkdir(parents=True,exist_ok=True)
app.mount("/outputs",StaticFiles(directory=str(OUT)),name="outputs")

class GenerateRequest(BaseModel):
    prompt:str=Field(min_length=3,max_length=1000)
    steps:int=Field(default=50,ge=1,le=250)
    seed:int|None=None

@app.get("/health")
def health():
    return {"status":"ok","checkpoint_configured":bool(os.getenv("RV1_CHECKPOINT"))}

@app.post("/generate")
def generate(req:GenerateRequest):
    path=os.getenv("RV1_CHECKPOINT")
    if not path or not Path(path).is_file():
        raise HTTPException(503,"RV-1 checkpoint not configured. Train the model first.")
    device="cuda" if torch.cuda.is_available() else "cpu"
    ckpt=torch.load(path,map_location=device,weights_only=True)
    text=TextEncoder().to(device); net=RV1Denoiser().to(device)
    text.load_state_dict(ckpt["text"]); net.load_state_dict(ckpt["denoiser"])
    text.eval(); net.eval()
    if req.seed is not None: torch.manual_seed(req.seed)
    ids,mask=tokenize([req.prompt]); ids=ids.to(device); mask=mask.to(device); cond=text(ids,mask)
    size=int(ckpt.get("size",64)); x=torch.randn(1,3,size,size,device=device)
    betas=torch.linspace(1e-4,.02,1000,device=device); alphas=1-betas; abar=alphas.cumprod(0)
    indices=torch.linspace(999,0,req.steps,device=device).long()
    with torch.no_grad():
        for i,tv in enumerate(indices):
            t=torch.tensor([int(tv)],device=device); b=betas[t,None,None,None]; a=alphas[t,None,None,None]; ab=abar[t,None,None,None]
            eps=net(x,t,cond); x=(x-b/(1-ab).sqrt()*eps)/a.sqrt()
            if i<len(indices)-1: x=x+b.sqrt()*torch.randn_like(x)
    name=f"{uuid.uuid4().hex}.png"; save_image((x.clamp(-1,1)+1)/2,OUT/name)
    return {"status":"generated","file":f"/outputs/{name}"}

if __name__=="__main__":
    import uvicorn
    uvicorn.run(app,host="0.0.0.0",port=8000)
