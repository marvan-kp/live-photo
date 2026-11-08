Universal Professional Camera Integration System

## Overview
This is a comprehensive camera integration system that provides adapters for major camera brands (Sony, Canon, Nikon, Leica, OM System, and Panasonic), a universal transfer engine for handling photo transfers, authentication mechanisms, and a dashboard UI for monitoring camera operations.

## Architecture

### Adapter Layer
- **BaseAdapter**: Abstract base class defining standard camera interface
- **SonyAdapter**: Sony camera integration adapter
- **CanonAdapter**: Canon camera integration adapter
- **NikonAdapter**: Nikon camera integration adapter
- **LeicaAdapter**: Leica camera integration adapter
- **OMSystemAdapter**: OM System camera integration adapter
- **PanasonicAdapter**: Panasonic Lumix camera integration adapter

### Core Engine
- **CameraTransferEngine**: Universal transfer engine for handling photo transfers

### Authentication System
- **AuthManager**: Authentication system for camera connections

### Dashboard UI
- **CameraDashboard**: React-based dashboard components for camera monitoring

## Key Components

### 1. Adapters
Each adapter implements the standard CameraAdapter interface:
- `connect()`: Connect to camera
- `disconnect()`: Disconnect from camera
- `capturePhoto()`: Capture a photo and return image data
- `getPreviewStream()`: Get live preview stream

### 2. Transfer Engine
The CameraTransferEngine handles photo transfers:
- `transferPhoto()`: Transfer photo from camera to destination
- `cancelTransfer()`: Cancel ongoing transfer
- `transferProgress`: Progress tracking
- `transferStatus`: Current transfer status

### 3. Authentication
The authentication system manages:
- Camera credentials storage
- Token-based authentication
- Connection validation
- Session management

### 4. Dashboard
The dashboard provides:
- Live camera status monitoring
- Photo capture controls
- Transfer progress visualization
- Real-time preview streaming

## Usage Examples

### Adapter Usage
```typescript
import { SonyAdapter, CanonAdapter, NikonAdapter, LeicaAdapter, OMSystemAdapter, PanasonicAdapter } from './adapters';

const sonyCamera = new SonyAdapter();
await sonyCamera.connect();
const photo = await sonyCamera.capturePhoto();
await sonyCamera.disconnect();

const leicaCamera = new LeicaAdapter();
await leicaCamera.connect();
await leicaCamera.disconnect();
```

### Transfer Engine Usage
```typescript
import { CameraTransferEngine } from './transfer_engine';

const engine = new CameraTransferEngine();
await engine.transferPhoto('camera://dcim/photo.jpg', '/local/path/photo.jpg');
```

## API Endpoints
- GET /api/cameras - List available cameras
- POST /api/cameras/connect - Connect to camera
- POST /api/cameras/disconnect - Disconnect from camera
- POST /api/photos/capture - Capture photo
- GET /api/photos/preview - Get preview stream
- GET /api/transfers/{id} - Get transfer status

## Installation
```bash
npm install @livephoto-share/camera-integration
```

## Configuration
```typescript
const config = {
  camera: {
    type: 'sony' | 'canon' | 'nikon' | 'leica' | 'om-system' | 'panasonic',
    host: '192.168.1.100',
    port: 8080,
    auth: {
      username: 'user',
      password: 'pass'
    }
  },
  transfer: {
    destination: '/path/to/destination',
    compression: true,
    format: 'jpg'
  }
};
```

## Testing
```bash
npm test
```

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License
MIT
