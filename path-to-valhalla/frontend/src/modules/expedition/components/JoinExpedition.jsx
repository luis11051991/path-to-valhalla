import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExpedition, joinExpedition } from '../services/expedition.service';

const JoinExpedition = () => {
  const { expeditionId } = useParams();
  const navigate = useNavigate();
  const [expedition, setExpedition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

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

  const handleJoin = async () => {
    setJoining(true);
    setError(null);

    try {
      await joinExpedition(expeditionId);
      navigate(`/expeditions/${expeditionId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
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
    <div className="join-expedition">
      <h2>Join Expedition: {expedition.name}</h2>
      
      {error && <div className="error">{error}</div>}
      
      <div className="expedition-details">
        <p><strong>Description:</strong> {expedition.description}</p>
        <p><strong>Difficulty:</strong> {expedition.difficulty}</p>
        <p><strong>Duration:</strong> {expedition.duration} hours</p>
        <p><strong>Participants:</strong> {expedition.participants?.length || 0} / {expedition.maxParticipants}</p>
      </div>

      <div className="actions">
        <button 
          onClick={handleJoin} 
          disabled={joining}
          className="btn btn-primary"
        >
          {joining ? 'Joining...' : 'Join Expedition'}
        </button>
        <button onClick={handleBackToList} className="btn btn-secondary">
          Back to List
        </button>
      </div>
    </div>
  );
};

export default JoinExpedition;