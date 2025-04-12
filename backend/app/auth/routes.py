from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash 
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.database import get_db_connection
from datetime import timedelta


auth_bp = Blueprint('auth', __name__,url_prefix='/api/auth') 

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user.
    """
    data = request.json
    print(f"[Auth] Registering user :{data}")
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email and password required."}), 400 
    hashed_password = generate_password_hash(password)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            (name, email, hashed_password)
        )
        conn.commit()
        conn.close() 

        print("[Auth] User registered successfully")
        return jsonify({"success": True, "message": "User registered successfully."}), 201 
    except Exception as e:
        print("[Auth] Error registering user:", e)
        return jsonify({"success": False, "message": "Error registering user."}), 400 

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    print(f"[Auth] Logging in user :{data}")
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"success": False, "message": "Email and password required."}), 400 

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        if user and check_password_hash(user['password'], password):
            # Create token with just email as identity
            access_token = create_access_token(
                identity=user["email"],
                expires_delta=timedelta(hours=24)
            )

            print("[Auth] User logged in successfully")
            return jsonify({
                "success": True,
                "token": access_token,
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "name": user["name"]
                }
            }), 200 
        else:
            print("[Auth] Invalid credentials")
            return jsonify({"success": False, "message": "Invalid credentials."}), 401
    except Exception as e:
        print("[Auth] Error logging in user:", e)
        return jsonify({"success": False, "message": "Error logging in user."}), 500 



@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout the user.
    """
    print("[Auth] Logging out user")
    user = get_jwt_identity()
    print(f"[Auth] User {user} logged out")
    return jsonify({"success": True, "message": "User logged out successfully."}), 200 


@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def get_all_users():
    """
    Get all users except the current one, and include friendship status.
    """
    print("[Auth] Getting all users")
    try:
        current_email = get_jwt_identity()

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE email = ?", (current_email,))
        current_user = cursor.fetchone()
        if not current_user:
            return jsonify({"success": False, "message": "User not found"}), 404

        current_user_id = current_user["id"]

        cursor.execute('''
            SELECT u.id
            FROM friend_requests fr
            JOIN users u ON 
                (fr.from_user_id = u.id AND fr.to_user_id = ?)
                OR (fr.to_user_id = u.id AND fr.from_user_id = ?)
            WHERE fr.status = 'accepted'
        ''', (current_user_id, current_user_id))
        friend_rows = cursor.fetchall()
        friend_ids = {row['id'] for row in friend_rows}

        # Get all users excluding self
        cursor.execute("SELECT id, name, email FROM users WHERE id != ?", (current_user_id,))
        users = cursor.fetchall()
        conn.close()

        user_list = []
        for user in users:
            user_list.append({
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'isFriend': user['id'] in friend_ids
            })

        return jsonify({'success': True, 'users': user_list})

    except Exception as e:
        print("[Auth] Error getting users:", e)
        return jsonify({"success": False, "message": "Error getting users."}), 500



@auth_bp.route('/friend-request', methods=['POST'])
def send_friend_request():
    data = request.get_json()
    from_user = data.get('from_user_id')
    to_user = data.get('to_user_id')

    if not from_user or not to_user:
        return jsonify({"success": False, "message": "Missing user IDs"}), 400

    if from_user == to_user:
        return jsonify({"success": False, "message": "Cannot send request to yourself"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if request already exists
    cursor.execute('''
        SELECT * FROM friend_requests
        WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'
    ''', (from_user, to_user))
    existing = cursor.fetchone()

    if existing:
        conn.close()
        return jsonify({"success": False, "message": "Friend request already sent"}), 400

    # Insert new request
    cursor.execute('''
        INSERT INTO friend_requests (from_user_id, to_user_id)
        VALUES (?, ?)
    ''', (from_user, to_user))

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Friend request sent"})

@auth_bp.route('/friend-request/respond', methods=['POST'])
def respond_to_friend_request():
    data = request.get_json()
    request_id = data.get('request_id')
    action = data.get('action')  # "accept" or "reject"

    if not request_id or action not in ['accept', 'reject']:
        return jsonify({"success": False, "message": "Missing or invalid request data"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM friend_requests WHERE id = ? AND status = 'pending'", (request_id,))
    fr = cursor.fetchone()

    if not fr:
        conn.close()
        return jsonify({"success": False, "message": "Friend request not found"}), 404

    if action == 'accept':
        cursor.execute("UPDATE friend_requests SET status = 'accepted' WHERE id = ?", (request_id,))
    elif action == 'reject':
        cursor.execute("UPDATE friend_requests SET status = 'rejected' WHERE id = ?", (request_id,))

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"Friend request {action}ed successfully"})

@auth_bp.route('/friend-requests/pending', methods=['GET'])
@jwt_required()
def get_pending_friend_requests():
    """
    Get all incoming pending friend requests for the logged-in user.
    """
    try:
        current_email = get_jwt_identity()
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get current user's ID
        cursor.execute("SELECT id FROM users WHERE email = ?", (current_email,))
        current_user = cursor.fetchone()
        if not current_user:
            return jsonify({"success": False, "message": "User not found"}), 404

        current_user_id = current_user["id"]

        # Fetch all friend requests sent TO this user that are pending
        cursor.execute('''
            SELECT fr.id as request_id, u.id as from_user_id, u.name, u.email
            FROM friend_requests fr
            JOIN users u ON fr.from_user_id = u.id
            WHERE fr.to_user_id = ? AND fr.status = 'pending'
        ''', (current_user_id,))
        requests = cursor.fetchall()
        conn.close()

        results = [
            {"request_id": r["request_id"], "from_user_id": r["from_user_id"], "name": r["name"], "email": r["email"]}
            for r in requests
        ]
        return jsonify({"success": True, "requests": results}), 200

    except Exception as e:
        print("[Auth] Error getting pending requests:", e)
        return jsonify({"success": False, "message": "Error getting pending requests"}), 500

@auth_bp.route('/friends', methods=['GET'])
@jwt_required()
def get_friends():
    """
    Get a list of friends (accepted requests where current user is either sender or receiver).
    """
    try:
        current_email = get_jwt_identity()
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get current user ID
        cursor.execute("SELECT id FROM users WHERE email = ?", (current_email,))
        current_user = cursor.fetchone()
        if not current_user:
            return jsonify({"success": False, "message": "User not found"}), 404

        current_user_id = current_user["id"]

        cursor.execute('''
            SELECT u.id, u.name, u.email
            FROM friend_requests fr
            JOIN users u ON
                (fr.from_user_id = u.id AND fr.to_user_id = ?)
                OR (fr.to_user_id = u.id AND fr.from_user_id = ?)
            WHERE fr.status = 'accepted'
        ''', (current_user_id, current_user_id))

        friends = cursor.fetchall()
        conn.close()

        friend_list = [{"id": f["id"], "name": f["name"], "email": f["email"]} for f in friends]
        return jsonify({"success": True, "friends": friend_list}), 200

    except Exception as e:
        print("[Auth] Error fetching friends:", e)
        return jsonify({"success": False, "message": "Error fetching friends"}), 500

@auth_bp.route('/messages/<user_id>', methods=['GET'])
@jwt_required()
def get_chat_history(user_id):
    """Get chat history between current user and specified user"""
    try:
        current_email = get_jwt_identity()
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get current user's ID
        cursor.execute("SELECT id FROM users WHERE email = ?", (current_email,))
        current_user = cursor.fetchone()
        if not current_user:
            return jsonify({"success": False, "message": "User not found"}), 404

        current_user_id = current_user["id"]

        # Get messages in both directions
        cursor.execute('''
            SELECT * FROM messages 
            WHERE (from_user_id = ? AND to_user_id = ?)
            OR (from_user_id = ? AND to_user_id = ?)
            ORDER BY timestamp ASC
        ''', (current_user_id, user_id, user_id, current_user_id))
        
        messages = cursor.fetchall()
        conn.close()

        formatted_messages = [{
            'from': 'me' if str(msg['from_user_id']) == str(current_user_id) else 'them',
            'text': msg['text'],
            'timestamp': msg['timestamp']
        } for msg in messages]

        return jsonify({"success": True, "messages": formatted_messages})

    except Exception as e:
        print("[Auth] Error fetching messages:", e)
        return jsonify({"success": False, "message": "Error fetching messages"}), 500
