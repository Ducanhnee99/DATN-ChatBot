"""Module Generator: sinh câu trả lời có trích dẫn từ các đoạn đã truy xuất."""
from . import config as C

SYSTEM = ("Bạn là trợ lý hỗ trợ sinh viên Trường Đại học Giao thông Vận tải tra cứu thông tin học tập. "
          "Chỉ trả lời dựa trên các đoạn tài liệu được cung cấp, bằng tiếng Việt, ngắn gọn, rõ ràng. "
          "Sau mỗi ý, ghi nguồn dạng [1], [2] tương ứng với số thứ tự đoạn. "
          "Nếu tài liệu không đủ thông tin, hãy nói rõ là chưa tìm thấy và không được suy đoán. "
          "Nhắc sinh viên xác nhận lại với nhà trường nếu liên quan quyết định học vụ chính thức.")


def llm(system: str, messages: list, max_tokens=800) -> str:
    from google import genai
    from google.genai import types

    if not C.API_KEY:
        return ""
    client = genai.Client(api_key=C.API_KEY)
    contents = [
        types.Content(
            role="user" if m.get("role") == "user" else "model",
            parts=[types.Part.from_text(text=m.get("content", ""))]
        )
        for m in messages
    ]
    config = types.GenerateContentConfig(
        system_instruction=system if system else None,
        max_output_tokens=max_tokens,
    )
    r = client.models.generate_content(
        model=C.LLM_MODEL,
        contents=contents,
        config=config,
    )
    return r.text.strip() if r.text else ""


def condense(question: str, history: list) -> str:
    """Viết lại câu hỏi nối tiếp thành câu độc lập (Query Rewriting)."""
    if not (C.API_KEY and history):
        return question
    hist = "\n".join(f"{m['role']}: {m['content']}" for m in history[-4:])
    try:
        return llm("Viết lại câu hỏi cuối thành một câu hỏi độc lập, đầy đủ ngữ cảnh, tiếng Việt. "
                   "Chỉ trả về câu đã viết lại.",
                   [{"role": "user", "content": f"Lịch sử:\n{hist}\n\nCâu hỏi: {question}"}], 200).strip()
    except Exception:
        return question


def generate(question: str, hits: list, history: list) -> str:
    ctx = "\n\n".join(f"[{i + 1}] ({h['source']}, trang {h['page']})\n{h['text']}" for i, h in enumerate(hits))
    if not C.API_KEY:
        return f"(Chưa cấu hình GEMINI_API_KEY, hiển thị đoạn liên quan nhất)\n\n{hits[0]['text'][:600]} [1]"
    msgs = [{"role": m["role"], "content": m["content"]} for m in history[-4:]]
    msgs.append({"role": "user", "content": f"Tài liệu:\n{ctx}\n\nCâu hỏi: {question}"})
    return llm(SYSTEM, msgs)
