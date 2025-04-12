import sqlite3
import os 


DB_NAME = "eirem.db" 


def get_db_connection():
    """Get a connection to the SQLite database."""
    print("[Database] Connecting to database")
    conn = sqlite3.connect(DB_NAME,check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn 

def init_db():
    """ Initialize the database and create the necessary tables.""" 

    conn = get_db_connection()
    cursor = conn.cursor() 

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS friend_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        status TEXT CHECK(status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id),
        FOREIGN KEY (to_user_id) REFERENCES users(id)
    )
    ''')


    conn.commit()
    conn.close()
    print("[Database] Database initialized")

