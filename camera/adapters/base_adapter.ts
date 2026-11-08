export abstract class CameraAdapter {
  public abstract connect(): Promise<void>;
  public abstract disconnect(): Promise<void>;
  public abstract capturePhoto(): Promise<string>;
  public abstract getPreviewStream(): Promise<ReadableStream>;
}
