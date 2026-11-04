"""RV-1 compact pixel-space conditional diffusion model; all weights random-init."""
import math
import torch
from torch import nn
import torch.nn.functional as F

VOCAB = 128

def tokenize(texts, length=128):
    ids = torch.zeros((len(texts), length), dtype=torch.long)
    mask = torch.zeros((len(texts), length), dtype=torch.bool)
    for row, text in enumerate(texts):
        values = [1] + [min(ord(c.lower()), VOCAB - 1) for c in text[:length - 2]] + [2]
        ids[row, :len(values)] = torch.tensor(values)
        mask[row, :len(values)] = True
    return ids, mask

class TextEncoder(nn.Module):
    def __init__(self, width=256, length=128):
        super().__init__()
        self.token = nn.Embedding(VOCAB, width, padding_idx=0)
        self.pos = nn.Embedding(length, width)
        layer = nn.TransformerEncoderLayer(width, 4, width * 4, batch_first=True, norm_first=True, activation="gelu")
        self.encoder = nn.TransformerEncoder(layer, 4)
        self.norm = nn.LayerNorm(width)
    def forward(self, ids, mask):
        pos = torch.arange(ids.shape[1], device=ids.device)[None, :]
        x = self.norm(self.encoder(self.token(ids) + self.pos(pos), src_key_padding_mask=~mask))
        m = mask.unsqueeze(-1).to(x.dtype)
        return (x * m).sum(1) / m.sum(1).clamp_min(1)

def time_embedding(t, dim):
    half = dim // 2
    freq = torch.exp(torch.arange(half, device=t.device) * (-math.log(10000) / max(half - 1, 1)))
    x = t.float()[:, None] * freq[None, :]
    out = torch.cat([x.sin(), x.cos()], 1)
    return F.pad(out, (0, dim - out.shape[1]))

class Block(nn.Module):
    def __init__(self, ci, co, cond):
        super().__init__()
        self.n1 = nn.GroupNorm(8, ci); self.c1 = nn.Conv2d(ci, co, 3, padding=1)
        self.emb = nn.Linear(cond, co); self.n2 = nn.GroupNorm(8, co); self.c2 = nn.Conv2d(co, co, 3, padding=1)
        self.skip = nn.Conv2d(ci, co, 1) if ci != co else nn.Identity()
    def forward(self, x, e):
        h = self.c1(F.silu(self.n1(x)))
        h = h + self.emb(F.silu(e))[:, :, None, None]
        return self.c2(F.silu(self.n2(h))) + self.skip(x)

class RV1Denoiser(nn.Module):
    def __init__(self, base=64, cond=256):
        super().__init__()
        self.tm = nn.Sequential(nn.Linear(cond, cond*2), nn.SiLU(), nn.Linear(cond*2, cond))
        self.cm = nn.Sequential(nn.Linear(cond, cond), nn.SiLU(), nn.Linear(cond, cond))
        self.input = nn.Conv2d(3, base, 3, padding=1)
        self.b1 = Block(base, base, cond); self.d1 = nn.Conv2d(base, base*2, 4, 2, 1)
        self.b2 = Block(base*2, base*2, cond); self.d2 = nn.Conv2d(base*2, base*4, 4, 2, 1)
        self.mid = Block(base*4, base*4, cond); self.mid2 = Block(base*4, base*4, cond)
        self.u2 = nn.Conv2d(base*4, base*2, 3, padding=1); self.ub2 = Block(base*4, base*2, cond)
        self.u1 = nn.Conv2d(base*2, base, 3, padding=1); self.ub1 = Block(base*2, base, cond)
        self.out = nn.Sequential(nn.GroupNorm(8, base), nn.SiLU(), nn.Conv2d(base, 3, 3, padding=1))
    def forward(self, x, t, text):
        e = self.tm(time_embedding(t, 256)) + self.cm(text)
        s1 = self.b1(self.input(x), e); s2 = self.b2(self.d1(s1), e)
        h = self.mid2(self.mid(self.d2(s2), e), e)
        h = self.u2(F.interpolate(h, size=s2.shape[-2:], mode="nearest"))
        h = self.ub2(torch.cat([h, s2], 1), e)
        h = self.u1(F.interpolate(h, size=s1.shape[-2:], mode="nearest"))
        return self.out(self.ub1(torch.cat([h, s1], 1), e))
