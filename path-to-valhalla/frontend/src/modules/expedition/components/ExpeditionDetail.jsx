import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExpedition, joinExpedition, leaveExpedition } from '../services/expedition.service';

const ExpeditionDetail = () => {
  const { expeditionId } = useParams();
  const navigate = useNavigate();
  const [expedition, setExpedition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchExpedition = async () => {
      try {
        const data = await getExpedition(expeditionId);
        setExpedition(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExpedition();
  }, [expeditionId]);

  const handleJoinExpedition = async () => {
    try {
      await joinExpedition(expeditionId);
      // Refetch expedition data after joining
      const updatedExpedition = await getExpedition(expeditionId);
      setExpedition(updatedExpedition);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLeaveExpedition = async () => {
    try {
      await leaveExpedition(expeditionId);
      // Refetch expedition data after leaving
      const updatedExpedition = await getExpedition(expeditionId);
      setExpedition(updatedExpedition);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBackToList = () => {
    navigate('/expeditions');
  };

  if (loading) {
    return <div className="loading">Loading expedition...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>Error: {error}</p>
        <button onClick={handleBackToList}>Back to List</button>
      </div>
    );
  }

  if (!expedition) {
    return (
      <div className="error">
        <p>Expedition not found.</p>
        <button onClick={handleBackToList}>Back to List</button>
      </div>
    );
  }

  return (
    <div className="expedition-detail">
      <button onClick={handleBackToList} className="btn btn-secondary">
        Back to List
      </button>
      
      <h2>{expedition.name}</h2>
      <p>{expedition.description}</p>
      
      <div className="expedition-info">
        <p><strong>Status:</strong> {expedition.status}</p>
        <p><strong>Creator:</strong> {expedition.creator?.name || 'Unknown'}</p>
        <p><strong>Participants:</strong> {expedition.participants?.length || 0}</p>
        <p><strong>Created:</strong> {new Date(expedition.createdAt).toLocaleDateString()}</p>
      </div>

      <div className="actions">
        {expedition.participants?.includes('current-user-id') ? (
          <button onClick={handleLeaveExpedition} className="btn btn-danger">
            Leave Expedition
          </button>
        ) : (
          <button onClick={handleJoinExpedition} className="btn btn-primary">
            Join Expedition
          </button>
        )}
      </div>
    </div>
  );
};

export default ExpeditionDetail;