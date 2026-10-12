"""Module Hybrid Retrieval: BM25 + dense (bge-m3) -> RRF -> metadata filter -> reranker."""
import json, re
import numpy as np
from rank_bm25 import BM25Okapi
from . import config as C


def tokenize(text: str):
    text = text.lower()
    try:
        from underthesea import word_tokenize
        toks = word_tokenize(text)
    except Exception:
        toks = text.split()
    return [t for t in toks if re.search(r"\w", t)]


class Retriever:
    def __init__(self):
        self.chunks, self.emb, self.bm25 = [], None, None
        self._embedder = self._reranker = None

    def embedder(self):
        if self._embedder is None:
            from sentence_transformers import SentenceTransformer
            self._embedder = SentenceTransformer(C.EMBED_MODEL)
        return self._embedder

    def reranker(self):
        if self._reranker is None:
            from sentence_transformers import CrossEncoder
            self._reranker = CrossEncoder(C.RERANK_MODEL)
        return self._reranker

    def build(self, chunks):
        self.chunks = chunks
        if not chunks:
            self.emb, self.bm25 = None, None
            for f in (C.INDEX_DIR / 'chunks.json', C.INDEX_DIR / 'emb.npy'):
                f.unlink(missing_ok=True)
            return
        self.emb = self.embedder().encode([c["text"] for c in chunks], normalize_embeddings=True,
                                          batch_size=16, show_progress_bar=True)
        self.bm25 = BM25Okapi([tokenize(c["text"]) for c in chunks])
        C.INDEX_DIR.mkdir(parents=True, exist_ok=True)
        (C.INDEX_DIR / "chunks.json").write_text(json.dumps(chunks, ensure_ascii=False), encoding="utf-8")
        np.save(C.INDEX_DIR / "emb.npy", self.emb)

    def load(self):
        cj, en = C.INDEX_DIR / "chunks.json", C.INDEX_DIR / "emb.npy"
        if not (cj.exists() and en.exists()):
            return False
        self.chunks = json.loads(cj.read_text(encoding="utf-8"))
        self.emb = np.load(en)
        self.bm25 = BM25Okapi([tokenize(c["text"]) for c in self.chunks])
        return True

    def search(self, query, mode="hybrid_rerank", k=C.TOP_K, major=None):
        """mode: dense | bm25 | hybrid | hybrid_rerank  (dùng cho ablation study)."""
        if not self.chunks:
            return []
        allowed = np.array([i for i, c in enumerate(self.chunks)
                            if not major or c["major"] in (major, "chung")])
        if len(allowed) == 0:
            return []
        qv = self.embedder().encode([query], normalize_embeddings=True)[0]
        cos = self.emb @ qv

        def top(scores):
            order = allowed[np.argsort(-scores[allowed])][:C.TOP_N]
            return [int(i) for i in order]

        dense_rank = top(cos)
        bm_scores = np.array(self.bm25.get_scores(tokenize(query)))
        bm_rank = [i for i in top(bm_scores) if bm_scores[i] > 0]

        if mode == "dense":
            ids = dense_rank
        elif mode == "bm25":
            ids = bm_rank
        else:  # Reciprocal Rank Fusion
            fused = {}
            for rank_list in (dense_rank, bm_rank):
                for r, i in enumerate(rank_list):
                    fused[i] = fused.get(i, 0) + 1 / (C.RRF_K + r + 1)
            ids = sorted(fused, key=fused.get, reverse=True)

        ids = ids[:C.TOP_N]
        rr = {}
        if mode == "hybrid_rerank" and C.USE_RERANKER and ids:
            logits = self.reranker().predict([(query, self.chunks[i]["text"]) for i in ids])
            probs = 1 / (1 + np.exp(-np.array(logits)))
            rr = dict(zip(ids, probs))
            ids = sorted(ids, key=lambda i: -rr[i])

        return [{**self.chunks[i], "cos": float(cos[i]),
                 "rerank": float(rr[i]) if i in rr else None} for i in ids[:k]]
