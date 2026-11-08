import { CameraAdapter } from './base_adapter';

export class LeicaAdapter extends CameraAdapter {
  async connect(): Promise<void> {
    console.log('Leica camera connected via PTP/IP / HTTP API');
  }

  async disconnect(): Promise<void> {
    console.log('Leica camera disconnected');
  }

  async capturePhoto(): Promise<string> {
    return 'Leica photo captured';
  }

  async getPreviewStream(): Promise<ReadableStream> {
    return new ReadableStream({
      start(controller) {
        controller.enqueue('Leica preview frame');
        controller.close();
      }
    });
  }
}
