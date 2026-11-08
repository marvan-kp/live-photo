import QRCode from 'qrcode';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

export async function generateQRCodeDataUrl(
  text: string,
  options?: QRCodeOptions
): Promise<string> {
  return QRCode.toDataURL(text, {
    width: options?.width || 400,
    margin: options?.margin ?? 2,
    color: {
      dark: options?.color?.dark || '#000000',
      light: options?.color?.light || '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });
}

export async function generateQRCodeSvg(
  text: string,
  options?: QRCodeOptions
): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    width: options?.width || 400,
    margin: options?.margin ?? 2,
    color: {
      dark: options?.color?.dark || '#000000',
      light: options?.color?.light || '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });
}

