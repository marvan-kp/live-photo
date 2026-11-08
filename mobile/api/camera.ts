import { NextRequest, NextResponse } from 'next/server';
import {
  SonyAdapter,
  CanonAdapter,
  NikonAdapter,
  LeicaAdapter,
  OMSystemAdapter,
  PanasonicAdapter
} from '@/camera/adapters';
import { AuthManager } from '@/camera/auth_manager';

export async function POST(req: NextRequest) {
  const authManager = AuthManager.getInstance();
  if (!authManager.isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { cameraModel, action } = await req.json();
  let adapter: CameraAdapter;

  switch (cameraModel.toLowerCase()) {
    case 'sony':
      adapter = new SonyAdapter();
      break;
    case 'canon':
      adapter = new CanonAdapter();
      break;
    case 'nikon':
      adapter = new NikonAdapter();
      break;
    case 'leica':
      adapter = new LeicaAdapter();
      break;
    case 'om-system':
      adapter = new OMSystemAdapter();
      break;
    case 'panasonic':
      adapter = new PanasonicAdapter();
      break;
    default:
      return NextResponse.json({ error: 'Unsupported camera' }, { status: 400 });
  }

  switch (action) {
    case 'connect':
      await adapter.connect();
      return NextResponse.json({ status: 'connected' });
    case 'disconnect':
      await adapter.disconnect();
      return NextResponse.json({ status: 'disconnected' });
    case 'capture':
      const photo = await adapter.capturePhoto();
      return NextResponse.json({ photo });
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
