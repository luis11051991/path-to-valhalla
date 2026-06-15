import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExpeditions } from '../services/expedition.service';

const ExpeditionList = () => {
  const [expeditions, setExpeditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchExpeditions = async () => {
      try {
        const data = await getExpeditions();
        setExpeditions(data);
      } catch (error) {
        console.error('Error fetching expeditions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExpeditions();
  }, []);

  const handleViewDetails = (expeditionId) => {
    navigate(`/expeditions/${expeditionId}`);
  };

  const handleCreateExpedition = () => {
    navigate('/expeditions/create');
  };

  if (loading) {
    return <div className="loading">Loading expeditions...</div>;
  }

  return (
    <div className="expedition-list">
      <div className="header">
        <h2>Expeditions</h2>
        <button onClick={handleCreateExpedition} className="btn btn-primary">
          Create Expedition
        </button>
      </div>
      
      {expeditions.length === 0 ? (
        <p>No expeditions available.</p>
      ) : (
        <div className="expedition-grid">
          {expeditions.map(expedition => (
            <div key={expedition.id} className="expedition-card" onClick={() => handleViewDetails(expedition.id)}>
              <h3>{expedition.name}</h3>
              <p>{expedition.description}</p>
              <p>Status: {expedition.status}</p>
              <p>Participants: {expedition.participants?.length || 0}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpeditionList;