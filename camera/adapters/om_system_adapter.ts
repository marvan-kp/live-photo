import { CameraAdapter } from './base_adapter';

export class OMSystemAdapter extends CameraAdapter {
  async connect(): Promise<void> {
    console.log('OM System camera connected via Wireless PTP/IP');
  }

  async disconnect(): Promise<void> {
    console.log('OM System camera disconnected');
  }

  async capturePhoto(): Promise<string> {
    return 'OM System photo captured';
  }

  async getPreviewStream(): Promise<ReadableStream> {
    return new ReadableStream({
      start(controller) {
        controller.enqueue('OM System preview frame');
        controller.close();
      }
    });
  }
}
