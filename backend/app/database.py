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
    """Initialize the database and create tables"""
    db_path = os.path.join(os.path.dirname(__file__), 'eirem.db')
    conn = get_db_connection()
    
    # Read schema file
    with open(os.path.join(os.path.dirname(__file__), 'schema.sql')) as f:
        conn.executescript(f.read())
    
    conn.commit()
    conn.close()
    print("[Database] Initialized database and created tables")

# Call this when starting the application
if __name__ == "__main__":
    init_db()

