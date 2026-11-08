import { CameraAdapter } from './base_adapter';

export class PanasonicAdapter extends CameraAdapter {
  async connect(): Promise<void> {
    console.log('Panasonic Lumix camera connected via Lumix Sync API');
  }

  async disconnect(): Promise<void> {
    console.log('Panasonic Lumix camera disconnected');
  }

  async capturePhoto(): Promise<string> {
    return 'Panasonic Lumix photo captured';
  }

  async getPreviewStream(): Promise<ReadableStream> {
    return new ReadableStream({
      start(controller) {
        controller.enqueue('Panasonic Lumix preview frame');
        controller.close();
      }
    });
  }
}
