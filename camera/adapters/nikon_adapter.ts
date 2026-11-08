import { CameraAdapter } from './base_adapter';

export class NikonAdapter extends CameraAdapter {
  async connect(): Promise<void> {
    console.log('Nikon camera connected');
  }

  async disconnect(): Promise<void> {
    console.log('Nikon camera disconnected');
  }

  async capturePhoto(): Promise<string> {
    return 'Nikon photo captured';
  }

  async getPreviewStream(): Promise<ReadableStream> {
    return new ReadableStream({
      start(controller) {
        controller.enqueue('Nikon preview frame');
        controller.close();
      }
    });
  }
}
