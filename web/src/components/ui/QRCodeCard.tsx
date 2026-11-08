"use client";

import { useEffect, useState } from "react";
import { generateQRCodeDataUrl, generateQRCodeSvg } from "@/lib/qrcode";
import { GlassButton } from "./GlassButton";
import { Download, Copy, Check, ExternalLink, Printer } from "lucide-react";

interface QRCodeCardProps {
  url: string;
  title?: string;
  subtitle?: string;
  code?: string;
}

export function QRCodeCard({ url, title, subtitle, code }: QRCodeCardProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) return;
    generateQRCodeDataUrl(url, { width: 400, margin: 2 }).then(setDataUrl);
  }, [url]);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${code || "event"}-qr.png`;
    a.click();
  };

  const handleDownloadSvg = async () => {
    const svgString = await generateQRCodeSvg(url, { width: 600, margin: 2 });
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${code || "event"}-qr.svg`;
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center p-6 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl text-center space-y-4 max-w-sm mx-auto shadow-2xl">
      {title && <h3 className="text-xl font-bold text-white">{title}</h3>}
      {subtitle && <p className="text-xs text-white/60 -mt-2">{subtitle}</p>}

      {/* QR Code Container */}
      <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-accent/30 transition-transform hover:scale-105 duration-300">
        {dataUrl ? (
          <img src={dataUrl} alt="Event QR Code" className="w-56 h-56 object-contain" />
        ) : (
          <div className="w-56 h-56 flex items-center justify-center text-black/50 text-sm">
            Generating QR...
          </div>
        )}
      </div>

      {code && (
        <div className="bg-graphite/80 px-4 py-2 rounded-xl border border-white/10">
          <p className="text-[10px] text-white/50 uppercase tracking-widest">Event Code</p>
          <p className="text-2xl font-mono font-black text-accent tracking-widest">{code}</p>
        </div>
      )}

      <p className="text-xs text-white/50 break-all px-2 font-mono">{url}</p>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 w-full pt-2">
        <GlassButton variant="primary" onClick={handleDownloadPng} className="text-xs py-2">
          <Download className="w-3.5 h-3.5 mr-1.5" /> PNG
        </GlassButton>
        <GlassButton variant="secondary" onClick={handleDownloadSvg} className="text-xs py-2">
          <Download className="w-3.5 h-3.5 mr-1.5" /> SVG
        </GlassButton>
        <GlassButton variant="secondary" onClick={handleCopy} className="text-xs py-2">
          {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
          {copied ? "Copied!" : "Copy Link"}
        </GlassButton>
        <GlassButton variant="secondary" onClick={handlePrint} className="text-xs py-2">
          <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Sign
        </GlassButton>
      </div>
    </div>
  );
}

