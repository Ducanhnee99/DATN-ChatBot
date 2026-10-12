"""Query Router + Query Rewriting + nhận diện ngành theo câu hỏi + tra bảng học phần."""
import csv, re, unicodedata
from . import config as C

ABBR = {r"\bctđt\b": "chương trình đào tạo", r"\bhp\b": "học phần", r"\btc\b": "tín chỉ",
        r"\bđkhp\b": "đăng ký học phần", r"\bgpa\b": "điểm trung bình tích lũy"}
CODE = re.compile(r"\b[A-Za-z]{2,4}\d{3,5}\b")
GREET = re.compile(r"^(xin chào|chào|hello|hi|hey|cảm ơn|thanks)\b", re.I)

# Danh mục tên ngành hiển thị tiếng Việt
MAJOR_NAMES = {
    "cntt": "Công nghệ thông tin",
    "cokhi": "Cơ khí",
    "dtqt": "Đào tạo quốc tế",
    "ktxd": "Kiến trúc – Kỹ thuật xây dựng",
    "vtkt": "Vận tải – Kinh tế",
    "qlxd": "Kinh tế – Quản lý xây dựng",
}

# Mỗi ngành ứng với tên thư mục trong data/docs/<ma_nganh>/ (chữ thường, không dấu).
MAJOR_KEYWORDS = {
    "cntt": [
        "công nghệ thông tin", "cntt", "khoa học máy tính", "khmt",
        "an toàn thông tin", "kỹ thuật phần mềm", "mạng máy tính",
        "hệ thống thông tin", "khoa cntt", "ngành it", "khoa it",
    ],
    "cokhi": [
        "cơ khí", "kỹ thuật ô tô", "cơ điện tử", "kỹ thuật nhiệt",
        "ktck", "chế tạo máy", "khoa cơ khí", "động lực", "ngành ô tô",
        "kỹ thuật cơ khí",
    ],
    "dtqt": [
        "đào tạo quốc tế", "dtqt", "chương trình quốc tế", "chương trình tiên tiến",
        "viện đào tạo quốc tế", "khoa đào tạo quốc tế", "liên kết quốc tế",
    ],
    "ktxd": [
        "kiến trúc", "xây dựng dân dụng", "kỹ thuật xây dựng", "ktxd",
        "công trình giao thông", "cầu đường", "khoa xây dựng", "ngành xây dựng",
    ],
    "vtkt": [
        "vận tải kinh tế", "kinh tế vận tải", "khai thác vận tải", "kế toán",
        "vtkt", "quản trị kinh doanh", "logistics", "khoa vận tải kinh tế",
    ],
    "qlxd": [
        "quản lý xây dựng", "qlxd", "kinh tế xây dựng", "khoa quản lý xây dựng",
    ],
}


def _strip_accents(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.replace("đ", "d")


def is_general_majors_inquiry(q: str) -> bool:
    """Kiểm tra câu hỏi hỏi chung về danh sách các ngành của trường UTC (không hỏi sâu vào 1 ngành)."""
    qn = _strip_accents(q)
    patterns = [
        r"truong (co|dao tao) nhung nganh",
        r"cac nganh (dao tao|hoc) cua truong",
        r"danh sach (cac )?nganh",
        r"nhung nganh nao",
        r"tuyen sinh nhung nganh",
        r"cac nganh hoc tai utc",
        r"cac nganh tai truong",
        r"truong utc co nhung nganh",
    ]
    return any(re.search(pat, qn) for pat in patterns)


def general_majors_answer(user=None) -> str:
    lines = [
        "Trường Đại học Giao thông Vận tải (UTC) hiện đang đào tạo đa dạng các khối ngành kỹ thuật, công nghệ và kinh tế hàng đầu, bao gồm:",
        "- **Công nghệ thông tin**: Công nghệ thông tin, Khoa học máy tính, Kỹ thuật phần mềm, An toàn thông tin...",
        "- **Cơ khí**: Kỹ thuật Cơ điện tử, Kỹ thuật Ô tô, Kỹ thuật Cơ khí, Kỹ thuật Nhiệt...",
        "- **Kiến trúc – Kỹ thuật xây dựng**: Kỹ thuật xây dựng công trình giao thông, Cầu đường, Xây dựng dân dụng, Kiến trúc...",
        "- **Vận tải – Kinh tế**: Kinh tế vận tải, Khai thác vận tải, Logistics & Quản lý chuỗi cung ứng, Kế toán...",
        "- **Kinh tế – Quản lý xây dựng**: Quản lý xây dựng, Kinh tế xây dựng...",
        "- **Đào tạo quốc tế**: Các chương trình tiên tiến, chất lượng cao và liên kết quốc tế.",
    ]
    if user is None:
        lines.append(
            "\n💡 **Lưu ý:** Bạn đang ở chế độ **Khách**. "
            "Để tra cứu chi tiết chương trình đào tạo, học phần tiên quyết, số tín chỉ và lộ trình của từng ngành cụ thể, "
            "vui lòng **Đăng ký** hoặc **Đăng nhập** tài khoản nhé!"
        )
    return "\n".join(lines)


def normalize(q: str) -> str:
    q = q.strip()
    for pat, rep in ABBR.items():
        q = re.sub(pat, rep, q, flags=re.I)
    return q


def detect_major(q: str):
    """Chỉ lọc theo ngành khi câu hỏi thực sự nhắc tới ngành đó; không nhắc thì tìm trên toàn bộ kho tài liệu."""
    if is_general_majors_inquiry(q):
        return None
    qn = _strip_accents(q)
    for major, keywords in MAJOR_KEYWORDS.items():
        for kw in keywords:
            if _strip_accents(kw) in qn:
                return major
    return None


def load_courses():
    if not C.COURSES_CSV.exists():
        return []
    with open(C.COURSES_CSV, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def find_course(q: str, courses):
    ql = q.lower()
    for c in courses:
        if c["ma_hp"].lower() in ql or c["ten_hp"].lower() in ql:
            return c
    return None


def route(q: str, courses) -> str:
    if GREET.match(q.lower()) and len(q.split()) <= 5:
        return "chitchat"
    if courses and (CODE.search(q) or any(c["ten_hp"].lower() in q.lower() for c in courses)):
        return "course"
    return "rag"


def course_answer(q: str, courses):
    ql = q.lower()
    found = [c for c in courses if c["ma_hp"].lower() in ql or c["ten_hp"].lower() in ql]
    if not found:
        return None
    lines = []
    for c in found[:3]:
        if re.search(r"tiên quyết|học trước|điều kiện", ql):
            lines.append(f"Học phần {c['ten_hp']} ({c['ma_hp']}) có học phần tiên quyết: {c['tien_quyet'] or 'không có'}.")
        elif "tín chỉ" in ql:
            lines.append(f"Học phần {c['ten_hp']} ({c['ma_hp']}) có {c['so_tc']} tín chỉ.")
        else:
            lines.append(f"{c['ten_hp']} ({c['ma_hp']}): {c['so_tc']} tín chỉ, học kỳ {c['hoc_ky']}, "
                         f"tiên quyết: {c['tien_quyet'] or 'không có'}.")
    return "\n".join(lines)
