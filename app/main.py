import hashlib, json, secrets, shutil, time
from pathlib import Path
from fastapi import FastAPI, UploadFile, Form, File, Depends, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from . import config as C, db, ingestion, router, generator
from .retrieval import Retriever

app = FastAPI(title="UTC Student Chatbot - Modular RAG")
R = Retriever()
COURSES = router.load_courses()


@app.on_event("startup")
def startup():
    db.init()
    if not R.load():
        chunks = ingestion.ingest_all()
        if chunks:
            R.build(chunks)


# ---------------- xác thực ----------------
def hash_pw(pw, salt):
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), 120_000).hex()


def issue_token(uid):
    t = secrets.token_hex(24)
    db.run("INSERT INTO tokens VALUES (?,?,?)", (t, uid, time.time()))
    return t


def current_user(authorization: str = Header(default="")):
    tok = authorization.removeprefix("Bearer ").strip()
    u = db.one("SELECT u.* FROM tokens t JOIN users u ON u.id=t.user_id WHERE t.token=?", (tok,))
    if not u:
        raise HTTPException(401, "Chưa đăng nhập")
    return u


def optional_user(authorization: str = Header(default="")):
    tok = authorization.removeprefix("Bearer ").strip()
    if not tok:
        return None
    return db.one("SELECT u.* FROM tokens t JOIN users u ON u.id=t.user_id WHERE t.token=?", (tok,))


def admin_user(u=Depends(current_user)):
    if u["role"] != "admin":
        raise HTTPException(403, "Chỉ quản trị viên được thực hiện thao tác này")
    return u


class AuthIn(BaseModel):
    username: str
    password: str
    major: str = ""


@app.post("/api/auth/register")
def register(b: AuthIn):
    name = b.username.strip().lower()
    if len(name) < 3 or len(b.password) < 6:
        raise HTTPException(400, "Tên đăng nhập tối thiểu 3 ký tự, mật khẩu tối thiểu 6 ký tự")
    if db.one("SELECT id FROM users WHERE username=?", (name,)):
        raise HTTPException(400, "Tên đăng nhập đã tồn tại")
    first = db.one("SELECT id FROM users LIMIT 1") is None   # tài khoản đầu tiên là admin
    salt = secrets.token_hex(16)
    uid = db.run("INSERT INTO users(username,salt,pw,role,major) VALUES (?,?,?,?,?)",
                 (name, salt, hash_pw(b.password, salt), "admin" if first else "student", b.major.strip().lower()))
    return {"token": issue_token(uid)}


@app.post("/api/auth/login")
def login(b: AuthIn):
    u = db.one("SELECT * FROM users WHERE username=?", (b.username.strip().lower(),))
    if not u or not secrets.compare_digest(u["pw"], hash_pw(b.password, u["salt"])):
        raise HTTPException(400, "Sai tên đăng nhập hoặc mật khẩu")
    return {"token": issue_token(u["id"])}


@app.get("/api/me")
def me(u=Depends(current_user)):
    return {"id": u["id"], "username": u["username"], "role": u["role"], "major": u["major"]}


# ---------------- chat ----------------
def answer(question, history, user=None):
    q = generator.condense(router.normalize(question), history)
    intent = router.route(q, COURSES)

    # 1. Chitchat
    if intent == "chitchat":
        if user is None:
            ans = ("Xin chào bạn! Mình là Trợ lý học vụ UTC. Bạn đang ở chế độ **Khách** "
                   "(hỗ trợ giải đáp quy chế, quy định và thông tin chung toàn trường).\n\n"
                   "Để tra cứu chi tiết chương trình đào tạo của từng ngành cụ thể, "
                   "bạn có thể đăng ký tài khoản miễn phí nhé!")
        else:
            ans = "Xin chào! Mình có thể giúp bạn tra cứu quy chế, chương trình đào tạo và thông tin học phần."
        return ans, [], "chitchat", False, None

    # 2. Câu hỏi hỏi chung về danh sách các ngành của trường UTC
    if router.is_general_majors_inquiry(q):
        ans = router.general_majors_answer(user=user)
        return ans, [{"source": "Sổ tay sinh viên.pdf", "page": "-", "section": "Các ngành đào tạo"}], "rag", False, None

    # 3. Tra cứu học phần chuyên ngành (mã HP, tên môn học)
    if intent == "course":
        c_info = router.find_course(q, COURSES)
        if user is None:
            c_name = f"{c_info['ten_hp']} ({c_info['ma_hp']})" if c_info else "học phần chuyên ngành"
            ans = (f"🔒 **Tra cứu học phần chuyên ngành yêu cầu đăng nhập tài khoản**\n\n"
                   f"Thông tin về **{c_name}** thuộc chương trình đào tạo chuyên ngành.\n\n"
                   f"Ở chế độ **Khách**, bạn chỉ có thể tra cứu thông tin và quy chế chung toàn trường UTC. "
                   f"Để xem số tín chỉ, học phần tiên quyết, học kỳ và lộ trình môn học, "
                   f"bạn vui lòng **Đăng ký** hoặc **Đăng nhập** tài khoản nhé!")
            return ans, [], "auth_required", True, None
        else:
            ans = router.course_answer(q, COURSES)
            if ans:
                return ans, [{"source": "courses.csv", "page": "-", "section": "Bảng học phần"}], "course", False, None

    # 4. Kiểm tra câu hỏi có nhắc tới ngành cụ thể không
    major = router.detect_major(q)
    if major is not None:
        if user is None:
            m_name = router.MAJOR_NAMES.get(major, "chuyên ngành")
            ans = (f"🔒 **Thông tin về ngành {m_name} yêu cầu đăng nhập tài khoản**\n\n"
                   f"Bạn đang sử dụng hệ thống ở chế độ **Khách** (chỉ tra cứu thông tin và quy chế chung toàn trường UTC).\n\n"
                   f"Để tra cứu chi tiết về:\n"
                   f"- Chương trình đào tạo và lộ trình học ngành **{m_name}**\n"
                   f"- Danh sách học phần, môn tiên quyết, số tín chỉ tích lũy\n"
                   f"- Chuẩn đầu ra và quy định riêng của ngành\n\n"
                   f"👉 Vui lòng **Đăng ký** hoặc **Đăng nhập** tài khoản UTC để mở khóa tra cứu đầy đủ nhé!")
            return ans, [], "auth_required", True, major
        else:
            # Người dùng đã đăng nhập: tra cứu RAG theo ngành được hỏi
            hits = R.search(q, "hybrid_rerank", C.TOP_K, major)
            ok = False
            if hits and hits[0]["rerank"] is not None:
                ok = hits[0]["rerank"] >= C.MIN_RERANK
            else:
                ok = bool(hits) and hits[0]["cos"] >= C.MIN_COS
            if ok:
                ans = generator.generate(q, hits, history)
                sources = [{"source": h["source"], "page": h["page"], "section": h["section"]} for h in hits]
                return ans, sources, "rag", False, None
            else:
                return C.REFUSAL, [], "refused", False, None

    # 5. Câu hỏi chung về trường (không nhắc tới ngành cụ thể)
    if user is None:
        # Khách: CHỈ tìm kiếm trong tài liệu "chung" toàn trường
        hits = R.search(q, "hybrid_rerank", C.TOP_K, major="chung")
        ok = False
        if hits and hits[0]["rerank"] is not None:
            ok = hits[0]["rerank"] >= C.MIN_RERANK
        else:
            ok = bool(hits) and hits[0]["cos"] >= C.MIN_COS
        if ok:
            ans = generator.generate(q, hits, history)
            sources = [{"source": h["source"], "page": h["page"], "section": h["section"]} for h in hits]
            return ans, sources, "rag", False, None
        else:
            # Kiểm tra nếu câu hỏi thực chất trùng với tài liệu chuyên ngành
            all_hits = R.search(q, "hybrid_rerank", C.TOP_K, major=None)
            if all_hits:
                has_hit = (all_hits[0]["rerank"] >= C.MIN_RERANK) if all_hits[0]["rerank"] is not None else (all_hits[0]["cos"] >= C.MIN_COS)
                if has_hit and all_hits[0].get("major") and all_hits[0]["major"] != "chung":
                    top_m = all_hits[0]["major"]
                    m_name = router.MAJOR_NAMES.get(top_m, "chuyên ngành")
                    ans = (f"🔒 **Nội dung này thuộc tài liệu của ngành {m_name}**\n\n"
                           f"Tài liệu giải đáp câu hỏi của bạn nằm trong chương trình đào tạo của ngành **{m_name}**. "
                           f"Vui lòng **Đăng ký** hoặc **Đăng nhập** tài khoản UTC để tra cứu tài liệu chuyên ngành nhé!")
                    return ans, [], "auth_required", True, top_m
            return C.REFUSAL, [], "refused", False, None
    else:
        # Người dùng đã đăng nhập: tìm theo ngành của user nếu có, hoặc tất cả
        user_major = user.get("major") or None
        hits = R.search(q, "hybrid_rerank", C.TOP_K, major=user_major)
        ok = False
        if hits and hits[0]["rerank"] is not None:
            ok = hits[0]["rerank"] >= C.MIN_RERANK
        else:
            ok = bool(hits) and hits[0]["cos"] >= C.MIN_COS
        if ok:
            ans = generator.generate(q, hits, history)
            sources = [{"source": h["source"], "page": h["page"], "section": h["section"]} for h in hits]
            return ans, sources, "rag", False, None
        else:
            return C.REFUSAL, [], "refused", False, None


def own(cid, u):
    c = db.one("SELECT * FROM conversations WHERE id=? AND user_id=?", (cid, u["id"]))
    if not c:
        raise HTTPException(404, "Không tìm thấy cuộc trò chuyện")
    return c


class ChatIn(BaseModel):
    question: str
    conversation_id: int | None = None
    history: list[dict] | None = None


@app.post("/api/chat")
def chat(b: ChatIn, u=Depends(optional_user)):
    cid = b.conversation_id
    if u is not None:
        if cid:
            own(cid, u)
        else:
            cid = db.run("INSERT INTO conversations(user_id,title,ts) VALUES (?,?,?)",
                         (u["id"], b.question[:60], time.time()))
        hist = [{"role": m["role"], "content": m["content"]} for m in
                db.rows("SELECT role,content FROM messages WHERE conv_id=? ORDER BY id", (cid,))][-6:]
        ans, sources, route, req_auth, target_major = answer(b.question, hist, user=u)
        now = time.time()
        db.run("INSERT INTO messages(conv_id,role,content,sources,route,ts) VALUES (?,?,?,?,?,?)",
               (cid, "user", b.question, "[]", "", now))
        db.run("INSERT INTO messages(conv_id,role,content,sources,route,ts) VALUES (?,?,?,?,?,?)",
               (cid, "assistant", ans, json.dumps(sources, ensure_ascii=False), route, now))
        db.run("UPDATE conversations SET ts=? WHERE id=?", (now, cid))
        return {"conversation_id": cid, "answer": ans, "sources": sources, "route": route,
                "requires_auth": req_auth, "target_major": target_major}
    else:
        # Chế độ Khách (Guest)
        hist = [m for m in (b.history or []) if isinstance(m, dict) and m.get("role") in ("user", "assistant")][-6:]
        ans, sources, route, req_auth, target_major = answer(b.question, hist, user=None)
        return {"conversation_id": None, "answer": ans, "sources": sources, "route": route,
                "requires_auth": req_auth, "target_major": target_major}


@app.get("/api/conversations")
def conversations(u=Depends(current_user)):
    return db.rows("SELECT id,title,ts FROM conversations WHERE user_id=? ORDER BY ts DESC", (u["id"],))


@app.get("/api/conversations/{cid}")
def conversation(cid: int, u=Depends(current_user)):
    own(cid, u)
    ms = db.rows("SELECT role,content,sources FROM messages WHERE conv_id=? ORDER BY id", (cid,))
    return [{**m, "sources": json.loads(m["sources"] or "[]")} for m in ms]


@app.delete("/api/conversations/{cid}")
def delete_conversation(cid: int, u=Depends(current_user)):
    own(cid, u)
    db.run("DELETE FROM messages WHERE conv_id=?", (cid,))
    db.run("DELETE FROM conversations WHERE id=?", (cid,))
    return {"ok": True}


# ---------------- quản trị ----------------
@app.get("/api/admin/docs")
def admin_docs(_=Depends(admin_user)):
    return [{"name": f.name, "major": f.parent.name, "kb": round(f.stat().st_size / 1024, 1)}
            for f in sorted(C.DOCS_DIR.rglob("*")) if f.is_file()]


@app.post("/api/admin/upload")
def admin_upload(file: UploadFile = File(...), major: str = Form("chung"), _=Depends(admin_user)):
    major = "".join(ch for ch in major.strip().lower() if ch.isalnum() or ch in "-_") or "chung"
    name = Path(file.filename).name
    if Path(name).suffix.lower() not in {".pdf", ".docx", ".txt", ".md"}:
        raise HTTPException(400, "Chỉ hỗ trợ PDF, DOCX, TXT, MD")
    (C.DOCS_DIR / major).mkdir(parents=True, exist_ok=True)
    with open(C.DOCS_DIR / major / name, "wb") as f:
        shutil.copyfileobj(file.file, f)
    R.build(ingestion.ingest_all())
    return {"chunks": len(R.chunks)}


@app.delete("/api/admin/docs/{major}/{name}")
def admin_delete(major: str, name: str, _=Depends(admin_user)):
    p = (C.DOCS_DIR / major / name).resolve()
    if C.DOCS_DIR.resolve() not in p.parents or not p.is_file():
        raise HTTPException(404, "Không tìm thấy tài liệu")
    p.unlink()
    R.build(ingestion.ingest_all())
    return {"chunks": len(R.chunks)}


@app.post("/api/admin/reindex")
def admin_reindex(_=Depends(admin_user)):
    R.build(ingestion.ingest_all())
    return {"chunks": len(R.chunks)}


@app.get("/api/admin/stats")
def admin_stats(_=Depends(admin_user)):
    n = lambda sql: db.one(sql)["n"]
    return {"users": n("SELECT COUNT(*) n FROM users"),
            "conversations": n("SELECT COUNT(*) n FROM conversations"),
            "questions": n("SELECT COUNT(*) n FROM messages WHERE role='user'"),
            "refused": n("SELECT COUNT(*) n FROM messages WHERE route='refused'"),
            "chunks": len(R.chunks)}


# ---------------- quản lý người dùng ----------------
ROLES = {"admin", "student"}


def clean_major(m):
    return "".join(ch for ch in (m or "").strip().lower() if ch.isalnum() or ch in "-_")


def get_user(uid):
    u = db.one("SELECT * FROM users WHERE id=?", (uid,))
    if not u:
        raise HTTPException(404, "Không tìm thấy người dùng")
    return u


@app.get("/api/admin/users")
def admin_users(_=Depends(admin_user)):
    us = db.rows("""
        SELECT u.id, u.username, u.role, u.major,
          (SELECT COUNT(*) FROM conversations c WHERE c.user_id=u.id) AS conversations,
          (SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id=m.conv_id
             WHERE c.user_id=u.id AND m.role='user') AS questions,
          (SELECT MAX(c.ts) FROM conversations c WHERE c.user_id=u.id) AS last_chat,
          (SELECT MAX(t.ts) FROM tokens t WHERE t.user_id=u.id) AS last_login
        FROM users u ORDER BY u.id""")
    for u in us:
        u["last_active"] = max(u.pop("last_chat") or 0, u.pop("last_login") or 0) or None
    return us


class UserPatch(BaseModel):
    role: str | None = None
    major: str | None = None


@app.patch("/api/admin/users/{uid}")
def admin_update_user(uid: int, b: UserPatch, me=Depends(admin_user)):
    u = get_user(uid)
    if b.role is not None and b.role != u["role"]:
        if b.role not in ROLES:
            raise HTTPException(400, "Vai trò không hợp lệ")
        if uid == me["id"]:
            raise HTTPException(400, "Bạn không thể tự thay đổi quyền của chính mình")
        db.run("UPDATE users SET role=? WHERE id=?", (b.role, uid))
    if b.major is not None:
        db.run("UPDATE users SET major=? WHERE id=?", (clean_major(b.major), uid))
    return {"ok": True}


class PasswordIn(BaseModel):
    password: str


@app.post("/api/admin/users/{uid}/password")
def admin_reset_password(uid: int, b: PasswordIn, me=Depends(admin_user)):
    get_user(uid)
    if len(b.password) < 6:
        raise HTTPException(400, "Mật khẩu tối thiểu 6 ký tự")
    salt = secrets.token_hex(16)
    db.run("UPDATE users SET salt=?, pw=? WHERE id=?", (salt, hash_pw(b.password, salt), uid))
    if uid != me["id"]:   # đăng xuất người dùng khỏi mọi thiết bị
        db.run("DELETE FROM tokens WHERE user_id=?", (uid,))
    return {"ok": True}


@app.delete("/api/admin/users/{uid}")
def admin_delete_user(uid: int, me=Depends(admin_user)):
    get_user(uid)
    if uid == me["id"]:
        raise HTTPException(400, "Bạn không thể tự xóa tài khoản của chính mình")
    db.run("DELETE FROM messages WHERE conv_id IN (SELECT id FROM conversations WHERE user_id=?)", (uid,))
    db.run("DELETE FROM conversations WHERE user_id=?", (uid,))
    db.run("DELETE FROM tokens WHERE user_id=?", (uid,))
    db.run("DELETE FROM users WHERE id=?", (uid,))
    return {"ok": True}


DIST = C.BASE / "frontend" / "dist"
if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="web")
else:
    @app.get("/")
    def no_frontend():
        return {"message": "Chưa build giao diện. Chạy: cd frontend && npm install && npm run build"}
