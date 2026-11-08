import { CameraAdapter } from './base_adapter';

export class SonyAdapter extends CameraAdapter {
  async connect(): Promise<void> {
    console.log('Sony camera connected');
  }

  async disconnect(): Promise<void> {
    console.log('Sony camera disconnected');
  }

  async capturePhoto(): Promise<string> {
    return 'Sony photo captured';
  }

  async getPreviewStream(): Promise<ReadableStream> {
    return new ReadableStream({
      start(controller) {
        controller.enqueue('Sony preview frame');
        controller.close();
      }
    };
  }
}
