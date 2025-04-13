import os
from twilio.rest import Client
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VideoGrant

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Get Twilio credentials from environment variables
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_API_KEY_SID = os.getenv('TWILIO_API_KEY_SID')
TWILIO_API_KEY_SECRET = os.getenv('TWILIO_API_KEY_SECRET')
TWILIO_VIDEO_ROOM_SID = os.getenv('TWILIO_VIDEO_ROOM_SID')  # If you have a specific room SID

# Initialize the Twilio client
client = Client(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_ACCOUNT_SID)

def create_video_token(identity, room_name):
    """
    Create a Twilio Video token that can be used to join a video room.

    Args:
        identity (str): The identity of the user joining the room.
        room_name (str): The name of the video room to join.

    Returns:
        str: The generated access token.
    """
    # Create an Access Token with the identity
    token = AccessToken(
        TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, identity=identity
    )

    # Create a Video grant for the token
    video_grant = VideoGrant(room=room_name)
    token.add_grant(video_grant)

    # Return the generated token
    return token.to_jwt()

def create_video_room(room_name):
    """
    Create a new Twilio Video Room.
    
    Args:
        room_name (str): The name of the room to create.

    Returns:
        Room: The Twilio room object.
    """
    try:
        room = client.video.rooms.create(
            unique_name=room_name,
            type='peer-to-peer',  # You can change this to 'group' or 'go' depending on your use case
        )
        return room
    except Exception as e:
        print(f"Error creating video room: {e}")
        return None

def get_room_status(room_sid):
    """
    Get the status of a specific Twilio Video Room by SID.

    Args:
        room_sid (str): The SID of the room to check.

    Returns:
        dict: The status of the room.
    """
    try:
        room = client.video.rooms(room_sid).fetch()
        return {
            'sid': room.sid,
            'status': room.status,
            'participants': room.participants
        }
    except Exception as e:
        print(f"Error fetching room status: {e}")
        return None

