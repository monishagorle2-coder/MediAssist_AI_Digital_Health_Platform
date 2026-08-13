import sqlite3
import os

db_path = os.path.expandvars(r"%APPDATA%\pgadmin\pgadmin4.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Dump keys table
try:
    cursor.execute("SELECT * FROM keys;")
    print("Keys table:", cursor.fetchall())
except Exception as e:
    print("Keys error:", e)

# Dump server details
try:
    cursor.execute("SELECT id, name, host, port, username, password FROM server;")
    print("Server details:", cursor.fetchall())
except Exception as e:
    print("Server error:", e)

# Dump user table
try:
    cursor.execute("SELECT * FROM user;")
    print("User table:", cursor.fetchall())
except Exception as e:
    print("User error:", e)

conn.close()
