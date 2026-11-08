import { useState, useEffect } from 'react';

export function useCameraConnection() {
  const [selectedCamera, setSelectedCamera] = useState<{ brand: string } | null>({ brand: 'Sony' });
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [previewStream, setPreviewStream] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const initializeConnection = async () => {
    if (!isInitialized) {
      const response = await fetch('/api/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraModel: selectedCamera?.brand, action: 'connect' })
      });
      if (response.ok) {
        setConnectionStatus('connected');
        setPreviewStream('mock-stream-url');
      }
      setIsInitialized(true);
    }
  };

  useEffect(() => {
    initializeConnection();
    return () => {
      setConnectionStatus('disconnected');
      setPreviewStream(null);
    };
  }, []);

  const connect = async () => {
    setConnectionStatus('connecting');
    try {
      const response = await fetch('/api/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraModel: selectedCamera?.brand, action: 'connect' })
      });
      if (response.ok) {
        setConnectionStatus('connected');
        setPreviewStream('mock-stream-url');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (error) {
      console.error(error);
      setConnectionStatus('disconnected');
    }
  };

  const disconnect = async () => {
    try {
      await fetch('/api/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraModel: selectedCamera?.brand, action: 'disconnect' })
      });
    } catch (error) {
      console.error(error);
    } finally {
      setConnectionStatus('disconnected');
      setPreviewStream(null);
    }
  };

  const capturePhoto = async () => {
    try {
      const response = await fetch('/api/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraModel: selectedCamera?.brand, action: 'capture' })
      });
      const data = await response.json();
      console.log('Captured photo:', data.photo);
      return data.photo;
    } catch (error) {
      console.error('Capture failed:', error);
    }
  };

  return {
    selectedCamera,
    setSelectedCamera,
    connectionStatus,
    previewStream,
    connect,
    disconnect,
    capturePhoto
  };
}
