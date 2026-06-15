import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ExpeditionList from '../components/ExpeditionList';
import ExpeditionDetail from '../components/ExpeditionDetail';
import CreateExpedition from '../components/CreateExpedition';
import JoinExpedition from '../components/JoinExpedition';

const ExpeditionRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<ExpeditionList />} />
      <Route path="/:expeditionId" element={<ExpeditionDetail />} />
      <Route path="/create" element={<CreateExpedition />} />
      <Route path="/:expeditionId/join" element={<JoinExpedition />} />
    </Routes>
  );
};

export default ExpeditionRoutes;