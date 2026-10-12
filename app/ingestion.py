"""Module Ingestion: đọc tài liệu -> chunk theo Điều/Khoản -> gắn metadata."""
import re
from pathlib import Path
from pypdf import PdfReader
from . import config as C

ARTICLE = re.compile(r"^(Điều\s+\d+[\.:]?.*)$")
MAX_LEN, OVERLAP = 900, 120


def read_pages(path: Path):
    s = path.suffix.lower()
    if s == ".pdf":
        return [(i + 1, p.extract_text() or "") for i, p in enumerate(PdfReader(str(path)).pages)]
    if s == ".docx":
        from docx import Document
        return [(1, "\n".join(p.text for p in Document(str(path)).paragraphs))]
    return [(1, path.read_text(encoding="utf-8", errors="ignore"))]


def chunk_file(path: Path, major: str):
    chunks, buf, state = [], [], {"title": "", "page": 1}

    def flush():
        text = " ".join(buf).strip()
        buf.clear()
        if len(text) < 30:
            return
        header = f"{path.stem} - {state['title']}".strip(" -")
        step = MAX_LEN - OVERLAP
        for s in range(0, len(text), step):
            part = text[s:s + MAX_LEN]
            chunks.append({"text": f"{header}\n{part}", "source": path.name,
                           "page": state["page"], "section": state["title"], "major": major})
            if s + MAX_LEN >= len(text):
                break

    for page, txt in read_pages(path):
        for line in txt.splitlines():
            line = line.strip()
            if not line:
                continue
            if ARTICLE.match(line):
                flush()
                state["title"] = line[:120]
            if not buf:
                state["page"] = page
            buf.append(line)
    flush()
    return chunks


def ingest_all():
    chunks = []
    for f in sorted(C.DOCS_DIR.rglob("*")):
        if f.suffix.lower() in {".pdf", ".docx", ".txt", ".md"}:
            rel = f.relative_to(C.DOCS_DIR).parts
            major = rel[0].lower() if len(rel) > 1 else "chung"
            chunks += chunk_file(f, major)
    return chunks
