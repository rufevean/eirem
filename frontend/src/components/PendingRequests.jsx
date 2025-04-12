import { useEffect, useState } from "react";
import { getPendingRequests, respondToFriendRequest } from "../services/api";

const PendingRequests = () => {
  const [requests, setRequests] = useState([]);

  const fetchRequests = async () => {
    try {
      const res = await getPendingRequests();
      if (res.success) {
        setRequests(res.requests);
      }
    } catch (err) {
      console.error("Error fetching requests", err);
    }
  };

  const handleRespond = async (id, action) => {
    try {
      await respondToFriendRequest(id, action);
      setRequests((prev) => prev.filter((r) => r.request_id !== id));
    } catch (err) {
      console.error("Error responding to request", err);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  if (requests.length === 0) return null;

  return (
    <div className="p-2 bg-white rounded shadow mt-4">
      <h3 className="font-bold text-lg mb-2">Pending Friend Requests</h3>
      <ul className="space-y-2">
        {requests.map((req) => (
          <li key={req.request_id} className="flex items-center justify-between">
            <span>{req.name} ({req.email})</span>
            <div className="space-x-2">
              <button
                onClick={() => handleRespond(req.request_id, "accept")}
                className="px-2 py-1 bg-green-500 text-white rounded"
              >
                Accept
              </button>
              <button
                onClick={() => handleRespond(req.request_id, "reject")}
                className="px-2 py-1 bg-red-500 text-white rounded"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PendingRequests;
