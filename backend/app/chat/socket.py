from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from flask import request
import time
from app.database import get_db_connection

connected_users = {}  # Maps user_id to socket session ID

def register_socketio_events(socketio):

    @socketio.on('connect')
    def handle_connect():
        print(f"[Socket] New connection from {request.sid}")
        token = request.args.get("token")
        user_id = request.args.get("userId")
        
        if not token or not user_id:
            print("[Socket] No token or userId provided")
            return False

        try:
            # Just validate the token, don't use its contents
            decode_token(token)
            connected_users[str(user_id)] = request.sid
            join_room(request.sid)
            print(f"[Socket] User {user_id} connected with SID {request.sid}")
            return True
            
        except Exception as e:
            print(f"[Socket] Token validation failed: {e}")
            return False

    @socketio.on('disconnect')
    def handle_disconnect():
        user_id = None
        for uid, sid in connected_users.items():
            if sid == request.sid:
                user_id = uid
                break
        if user_id:
            del connected_users[user_id]
            print(f"[Socket] User {user_id} disconnected")

    @socketio.on('private_message')
    def handle_private_message(data):
        """Handle private messages between users"""
        print(f"[Socket] Received private_message data: {data}")

        try:
            from_user_id = str(data['from'])
            to_user_id = str(data['to'])
            text = data['text']
            timestamp = int(time.time())

            # Store message in database
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO messages (from_user_id, to_user_id, text, timestamp)
                VALUES (?, ?, ?, ?)
            ''', (from_user_id, to_user_id, text, timestamp))
            conn.commit()
            conn.close()

            if to_user_id in connected_users:
                emit("private_message", {
                    "from": from_user_id,
                    "text": text,
                    "timestamp": timestamp
                }, room=connected_users[to_user_id])
                print(f"[Socket] Sent message to user {to_user_id}")
            else:
                print(f"[Socket] User {to_user_id} is offline, message stored")

        except Exception as e:
            print(f"[Socket] Error handling private_message: {e}")
            emit("error", {"message": str(e)})
