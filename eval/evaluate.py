"""Ablation study. Chạy: python -m eval.evaluate
eval/questions.jsonl, mỗi dòng: {"question": "...", "gold": ["từ khóa bắt buộc có trong đoạn đúng"]}
Một đoạn được coi là đúng nếu chứa tất cả từ khóa trong "gold"."""
import json
from pathlib import Path
from app.retrieval import Retriever

K = 5
MODES = ["dense", "bm25", "hybrid", "hybrid_rerank"]


def main():
    R = Retriever()
    assert R.load(), "Chưa có index. Hãy chạy server một lần để tạo index."
    qs = [json.loads(l) for l in Path("eval/questions.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    print(f"{'mode':<15}{'Recall@' + str(K):>10}{'MRR':>8}")
    for mode in MODES:
        hit, rr = 0, 0.0
        for q in qs:
            for rank, h in enumerate(R.search(q["question"], mode, K), 1):
                if all(g.lower() in h["text"].lower() for g in q["gold"]):
                    hit += 1
                    rr += 1 / rank
                    break
        print(f"{mode:<15}{hit / len(qs):>10.3f}{rr / len(qs):>8.3f}")


if __name__ == "__main__":
    main()
