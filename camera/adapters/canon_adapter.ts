import { CameraAdapter } from './base_adapter';

export class CanonAdapter extends CameraAdapter {
  async connect(): Promise<void> {
    console.log('Canon camera connected');
  }

  async disconnect(): Promise<void> {
    console.log('Canon camera disconnected');
  }

  async capturePhoto(): Promise<string> {
    return 'Canon photo captured';
  }

  async getPreviewStream(): Promise<ReadableStream> {
    return new ReadableStream({
      start(controller) {
        controller.enqueue('Canon preview frame');
        controller.close();
      }
    });
  }
}
