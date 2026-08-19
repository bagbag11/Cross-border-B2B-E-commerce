import React from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import LogisticsInquiryPage from './pages/LogisticsInquiry/LogisticsInquiryPage';
import LogisticsRoutesPage from './pages/LogisticsRoutes/LogisticsRoutesPage';
import UserInputHistoryPage from './pages/UserInputHistory';
import BatchTestPage from './pages/BatchTest/BatchTestPage';

const RoutesComponent = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LogisticsInquiryPage />} />
        <Route path="logistics-routes" element={<LogisticsRoutesPage />} />
        <Route path="user-input-history" element={<UserInputHistoryPage />} />
        <Route path="batch-test" element={<BatchTestPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
