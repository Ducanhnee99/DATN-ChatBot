import sqlite3
from . import config as C

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, salt TEXT, pw TEXT, role TEXT, major TEXT);
CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY, user_id INTEGER, ts REAL);
CREATE TABLE IF NOT EXISTS conversations(id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT, ts REAL);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, conv_id INTEGER, role TEXT, content TEXT, sources TEXT, route TEXT, ts REAL);
"""


def conn():
    c = sqlite3.connect(C.DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init():
    C.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with conn() as c:
        c.executescript(SCHEMA)


def run(sql, args=()):
    with conn() as c:
        return c.execute(sql, args).lastrowid


def rows(sql, args=()):
    c = conn()
    try:
        return [dict(r) for r in c.execute(sql, args)]
    finally:
        c.close()


def one(sql, args=()):
    r = rows(sql, args)
    return r[0] if r else None
