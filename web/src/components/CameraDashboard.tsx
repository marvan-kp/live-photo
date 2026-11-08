import React, { useState } from 'react';

export const CameraDashboard = () => {
  const [status, setStatus] = useState('Disconnected');

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h2 className="text-xl font-bold">Camera Dashboard</h2>
      <p>Status: {status}</p>
      <button
        className="px-4 py-2 mt-2 text-white bg-blue-500 rounded"
        onClick={() => setStatus('Connected')}
      >
        Connect Camera
      </button>
    </div>
  );
};
