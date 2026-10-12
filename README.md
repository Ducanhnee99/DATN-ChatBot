# Chatbot hỗ trợ sinh viên UTC – Modular RAG + Hybrid Retrieval

Yêu cầu: Python 3.10–3.12 (khuyến nghị 3.11), Node.js 18+ (để build giao diện React).

## Chạy trực tiếp
```bash
python3.11 -m venv .venv && source .venv/bin/activate   # Windows: py -3.11 -m venv .venv ; .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env && export GEMINI_API_KEY=AIzaSy...  # không bắt buộc
(cd frontend && npm install && npm run build)
uvicorn app.main:app --reload                            # http://localhost:8000
```
Phát triển giao diện: chạy `uvicorn` ở cổng 8000, sau đó `cd frontend && npm run dev` (http://localhost:5173, tự proxy /api).

## Chạy bằng Docker
```bash
cp .env.example .env && docker compose up --build
```

## Sử dụng
1. **Tài khoản đầu tiên đăng ký sẽ là quản trị viên**, các tài khoản sau là sinh viên (ô "Ngành" dùng để lọc tài liệu).
2. Vào tab **Quản trị**: tải quy chế, CTĐT, đề cương học phần (PDF/DOCX/TXT). Hệ thống tự chunk và dựng chỉ mục.
3. Sửa `data/courses.csv` (ma_hp, ten_hp, so_tc, tien_quyet, hoc_ky) để bật tư vấn tiên quyết/tín chỉ.
4. Đánh giá: điền 100–150 câu vào `eval/questions.jsonl`, chạy `python -m eval.evaluate` để lấy bảng ablation.
5. Tinh chỉnh `MIN_RERANK`, `MIN_COS` trong `app/config.py` dựa trên kết quả đánh giá.

## Cấu trúc
- `app/ingestion.py` đọc tài liệu, chunk theo Điều, gắn metadata
- `app/retrieval.py` BM25 + dense + RRF + lọc ngành + reranker
- `app/router.py` chuẩn hóa viết tắt, phân luồng câu hỏi (chào hỏi / bảng học phần / RAG)
- `app/generator.py` viết lại câu hỏi nối tiếp, sinh câu trả lời có trích dẫn
- `app/main.py`, `app/db.py` API, đăng nhập (PBKDF2 + token), lịch sử chat, quản trị, SQLite
- `frontend/` ReactJS (Vite): đăng nhập, trò chuyện, quản trị tài liệu
- `eval/evaluate.py` Recall@5, MRR cho dense / bm25 / hybrid / hybrid_rerank
