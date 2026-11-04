"""Train RV-1 from random initialization; no pretrained weights are loaded."""
import argparse, json
from pathlib import Path
from PIL import Image
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from .models import TextEncoder, RV1Denoiser, tokenize

class Images(Dataset):
    def __init__(self, manifest, size):
        self.manifest = Path(manifest)
        self.rows = [json.loads(x) for x in self.manifest.read_text().splitlines() if x.strip()]
        self.tf = transforms.Compose([transforms.Resize(size), transforms.CenterCrop(size), transforms.ToTensor(), transforms.Normalize([.5]*3, [.5]*3)])
        if not self.rows: raise ValueError("No caption rows found.")
    def __len__(self): return len(self.rows)
    def __getitem__(self, i):
        row = self.rows[i]
        with Image.open(self.manifest.parent / row["file"]) as im: image = self.tf(im.convert("RGB"))
        return image, row["caption"]

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--manifest",default="rv1/data/captions.jsonl")
    p.add_argument("--steps",type=int,default=1000)
    p.add_argument("--batch-size",type=int,default=4)
    p.add_argument("--size",type=int,default=64)
    p.add_argument("--out",default="rv1/checkpoints/rv1-alpha.pt")
    a=p.parse_args()
    device="cuda" if torch.cuda.is_available() else "cpu"
    loader=DataLoader(Images(a.manifest,a.size),batch_size=a.batch_size,shuffle=True)
    text=TextEncoder().to(device); net=RV1Denoiser().to(device)
    opt=torch.optim.AdamW(list(text.parameters())+list(net.parameters()),lr=1e-4)
    betas=torch.linspace(1e-4,.02,1000,device=device); alphas=1-betas; abar=alphas.cumprod(0)
    step=0; text.train(); net.train()
    while step<a.steps:
        for clean,captions in loader:
            clean=clean.to(device); ids,mask=tokenize(list(captions)); ids=ids.to(device); mask=mask.to(device)
            t=torch.randint(0,1000,(clean.size(0),),device=device); noise=torch.randn_like(clean)
            noisy=abar[t,None,None,None].sqrt()*clean+(1-abar[t,None,None,None]).sqrt()*noise
            loss=torch.nn.functional.mse_loss(net(noisy,t,text(ids,mask)),noise)
            opt.zero_grad(set_to_none=True); loss.backward()
            torch.nn.utils.clip_grad_norm_(list(text.parameters())+list(net.parameters()),1.0); opt.step(); step+=1
            if step%10==0: print(f"step={step} loss={loss.item():.5f} device={device}")
            if step%250==0 or step==a.steps:
                out=Path(a.out); out.parent.mkdir(parents=True,exist_ok=True)
                torch.save({"step":step,"size":a.size,"text":text.state_dict(),"denoiser":net.state_dict()},out)
            if step>=a.steps: break

if __name__=="__main__": main()
