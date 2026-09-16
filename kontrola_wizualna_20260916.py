#!/usr/bin/env python3
"""Kontrola wizualna 16.09.2026: (A) pliki 'blank' z WYKRYTO/NIEPEWNE w amfa_probki, (B) 73-5 (negatyw wg raportu, WYKRYTO),
(C) zyski i straty konfiguracji kandydackiej prom=1e-7 + bez filtra krawedzi wzgledem obecnej. Wyjscie: PDF wielostronicowy."""
import os, sys, json, csv, re
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from grid_etykiety import load_algo_with_edge
HERE=os.path.dirname(os.path.abspath(__file__)); P=os.path.join(HERE,".."); W=os.path.join(P,"wyniki_analizy")
AMFA=os.environ.get("AMFA_DIR", os.path.join(P,"amfa_probki")); LAB=os.path.join(P,"07_etykiety_lab_20260916","Pozytywne")
base=load_algo_with_edge(); cand=load_algo_with_edge(); cand.PEAK_PROMINENCE_A=1.0e-7; cand.EDGE_FRAC=0.0; cand.EDGE_MIN_PTS=0
def run(algo,path):
    algo.RESULTS.clear(); r=algo.analyze(os.path.basename(path), open(path,"rb").read())
    E,I,_,_=algo.parse_file(open(path,"rb").read()); E,I,_,_=algo.detect_cycles_and_select(E,I); return r,E,I
def page(pdf,title,path,algos):
    fig,axes=plt.subplots(1,len(algos),figsize=(6*len(algos),4.2))
    if len(algos)==1: axes=[axes]
    for ax,(lab,algo) in zip(axes,algos):
        try: r,E,I=run(algo,path)
        except Exception as e: ax.set_title(f"{lab}: CRASH {e}"); continue
        ax.plot(E,I*1e6,lw=0.8,color="#64748B")
        pts=r.get("points") or {}
        for k,col in (("1","#2563EB"),("2","#2563EB"),("3","#DC2626"),("4","#DC2626")):
            p=pts.get(k)
            if p and p.get("I") is not None: ax.plot(p["E"],p["I"]*1e6,"o",color=col,ms=6); ax.annotate(k,(p["E"],p["I"]*1e6),fontsize=8)
        d=r.get("delta_Es"); ax.set_title(f"{lab}: {r.get('status')}  dE_s={d:.4f}" if d else f"{lab}: {r.get('status')} ({r.get('internal_reason') or ''})",fontsize=9)
        ax.set_xlabel("E raw / V"); ax.set_ylabel("I / uA"); ax.grid(alpha=.3)
    fig.suptitle(title,fontsize=9); fig.tight_layout(); pdf.savefig(fig); plt.close(fig)
rows=list(csv.DictReader(open(os.path.join(W,"amfa_probki_20260916","przebieg_amfa_probki_baseline.csv"))))
blank=[r for r in rows if re.search("blank",r["plik"],re.I) and r["status"] in("detected","uncertain")]
G=os.path.join(W,"grid_20260916")
b={r["plik"]:r for r in json.load(open(G+"/prom1.50e-07_edge0.08_12.json")) if r["klasa"]=="Pozytywne"}
n={r["plik"]:r for r in json.load(open(G+"/prom1.00e-07_edge0_0.json")) if r["klasa"]=="Pozytywne"}
hit=lambda r: r["delta"] is not None and abs(r["delta"]-0.35)*1000<=10+1e-9
gain=[k for k in b if hit(n[k]) and not hit(b[k])]; loss=[k for k in b if hit(b[k]) and not hit(n[k])]
out=os.path.join(W,"kontrola_wizualna_20260916.pdf")
with PdfPages(out) as pdf:
    for r in blank: page(pdf,f"(A) BLANK w nazwie a WYKRYTO/NIEPEWNE: {r['podkatalog']}/{r['plik']}",os.path.join(AMFA,r["podkatalog"],r["plik"]),[("obecna",base)])
    for f in ("Komercja 10.04/73-5_500ul_20ul_TPrA.txt",): page(pdf,f"(B) negatyw wg raportu labu 11.04.2025, WYKRYTO: {f}",os.path.join(AMFA,f),[("obecna",base)])
    for k in gain: page(pdf,f"(C) ZYSK kandydata (prom 1e-7, bez filtra krawedzi): {k}",os.path.join(LAB,k),[("obecna",base),("kandydat",cand)])
    for k in loss: page(pdf,f"(C) STRATA kandydata: {k}",os.path.join(LAB,k),[("obecna",base),("kandydat",cand)])
print("stron:",len(blank)+1+len(gain)+len(loss),"->",out)
