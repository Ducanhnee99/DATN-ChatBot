import os
from pathlib import Path
from dotenv import load_dotenv

BASE = Path(__file__).resolve().parent.parent
load_dotenv(BASE / ".env")

DOCS_DIR = BASE / "data" / "docs"      # data/docs/<ten_nganh>/file.pdf ; thư mục "chung" = dùng cho mọi ngành
INDEX_DIR = BASE / "data" / "index"
COURSES_CSV = BASE / "data" / "courses.csv"
DB_PATH = BASE / "data" / "chat.db"

EMBED_MODEL = os.getenv("EMBED_MODEL", "BAAI/bge-m3")
RERANK_MODEL = os.getenv("RERANK_MODEL", "BAAI/bge-reranker-v2-m3")
USE_RERANKER = os.getenv("USE_RERANKER", "1") == "1"
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-3.5-flash-lite")
API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("ANTHROPIC_API_KEY", ""))

TOP_N = 20        # số ứng viên mỗi nhánh (BM25 / dense) trước khi gộp
TOP_K = 5         # số đoạn đưa vào LLM
RRF_K = 60
MIN_RERANK = 0.05  # ngưỡng guardrail khi có reranker (cần tinh chỉnh bằng tập đánh giá)
MIN_COS = 0.35     # ngưỡng guardrail khi không có reranker
REFUSAL = ("Mình chưa tìm thấy thông tin phù hợp trong tài liệu hiện có. "
           "Bạn vui lòng liên hệ Phòng Đào tạo để được xác nhận chính thức.")
