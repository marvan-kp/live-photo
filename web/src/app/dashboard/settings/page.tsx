"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  Cloud,
  HardDrive,
  Database,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Lock,
  ExternalLink,
  Cpu,
  Smartphone,
  Sparkles,
  Download
} from "lucide-react";
import Link from "next/link";

interface StorageConfigData {
  provider: "local" | "supabase" | "s3_r2";
  supabase?: {
    url: string;
    bucket: string;
    serviceRoleKey: string;
  };
  s3?: {
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    region?: string;
  };
}

interface TestResult {
  success: boolean;
  message: string;
  publicUrl?: string;
}

export default function DashboardSettingsPage() {
  const [provider, setProvider] = useState<"local" | "supabase" | "s3_r2">("local");

  // Supabase fields
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [supabaseBucket, setSupabaseBucket] = useState("live-photos");

  // S3 / R2 fields
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3Bucket, setS3Bucket] = useState("live-photos");
  const [s3Region, setS3Region] = useState("auto");

  // UI state
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch current settings on load
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setProvider(data.config.provider || "local");
          if (data.config.supabase) {
            setSupabaseUrl(data.config.supabase.url || "");
            setSupabaseKey(data.config.supabase.serviceRoleKey || "");
            setSupabaseBucket(data.config.supabase.bucket || "live-photos");
          }
          if (data.config.s3) {
            setS3Endpoint(data.config.s3.endpoint || "");
            setS3AccessKey(data.config.s3.accessKeyId || "");
            setS3SecretKey(data.config.s3.secretAccessKey || "");
            setS3Bucket(data.config.s3.bucketName || "live-photos");
            setS3Region(data.config.s3.region || "auto");
          }
        }
        if (data.testResult) {
          setTestResult(data.testResult);
        }
      })
      .catch((e) => console.error("Failed to load settings:", e))
      .finally(() => setLoading(false));
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const payload = {
        action: "test-only",
        provider,
        supabase: {
          url: supabaseUrl,
          serviceRoleKey: supabaseKey,
          bucket: supabaseBucket,
        },
        s3: {
          endpoint: s3Endpoint,
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey,
          bucketName: s3Bucket,
          region: s3Region,
        },
      };

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setTestResult(data.testResult || { success: data.success, message: data.message || "Test completed." });
    } catch (err: any) {
      setTestResult({ success: false, message: `Test request failed: ${err.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        provider,
        supabase: {
          url: supabaseUrl,
          serviceRoleKey: supabaseKey,
          bucket: supabaseBucket,
        },
        s3: {
          endpoint: s3Endpoint,
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey,
          bucketName: s3Bucket,
          region: s3Region,
        },
      };

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        if (data.testResult) {
          setTestResult(data.testResult);
        }
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        alert(`Error saving settings: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Cloud className="w-7 h-7 text-accent" />
          Cloud Storage & System Settings
        </h2>
        <p className="text-white/60 text-sm mt-1">
          Configure cloud photo storage, verify AI facial recognition pipelines, and manage system integrations.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>Storage settings saved successfully! All future photo uploads will use the active provider.</span>
        </div>
      )}

      {/* Storage Provider Selection */}
      <GlassCard className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Active Storage Provider</h3>
            <p className="text-sm text-white/50">
              Select where uploaded event photos and videos will be stored and served from.
            </p>
          </div>
          <a
            href="https://supabase.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> 100% Free Cloud Tier (1GB) <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Free Cloud Quick Guide Box */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-black/40 border border-emerald-500/20 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            How to Set Up 100% Free Supabase Cloud Storage (No Credit Card Needed)
          </div>
          <ol className="text-xs text-white/70 space-y-1.5 list-decimal list-inside pl-1">
            <li>
              Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-accent underline">supabase.com</a> and sign in with GitHub or email (free forever).
            </li>
            <li>Click <strong>&quot;New Project&quot;</strong>, enter any project name (e.g. <code>live-photos</code>), and click <strong>Create</strong>.</li>
            <li>In the left sidebar, click <strong>Storage</strong> (bucket icon) → click <strong>&quot;New Bucket&quot;</strong> → name it <code>live-photos</code> → turn <strong>ON &quot;Public Bucket&quot;</strong>.</li>
            <li>In the left sidebar, click <strong>Project Settings (gear icon) → API</strong>:</li>
            <ul className="list-disc list-inside pl-4 text-white/60 space-y-0.5 mt-1">
              <li>Copy <strong>Project URL</strong> → paste below into <em>Supabase Project URL</em></li>
              <li>Copy <strong>service_role (secret)</strong> key → paste below into <em>Supabase Service Role Key</em></li>
            </ul>
            <li>Click <strong>&quot;Test Connection&quot;</strong> below, then click <strong>&quot;Save Storage Settings&quot;</strong>. Done!</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Local Storage */}
          <div
            onClick={() => setProvider("local")}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              provider === "local"
                ? "bg-accent/10 border-accent text-white shadow-lg shadow-accent/10"
                : "bg-white/[0.02] border-white/10 text-white/60 hover:border-white/20 hover:text-white"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <HardDrive className={`w-6 h-6 ${provider === "local" ? "text-accent" : "text-white/50"}`} />
              {provider === "local" && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-accent/20 text-accent font-medium border border-accent/30">
                  Active
                </span>
              )}
            </div>
            <h4 className="font-semibold text-white">Local Storage</h4>
            <p className="text-xs text-white/50 mt-1">
              Zero-config high performance local filesystem storage. Perfect for local servers & development.
            </p>
            <div className="mt-3 text-[11px] text-accent/80 font-mono">100% Free · No API Key</div>
          </div>

          {/* Supabase Storage */}
          <div
            onClick={() => setProvider("supabase")}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              provider === "supabase"
                ? "bg-accent/10 border-accent text-white shadow-lg shadow-accent/10"
                : "bg-white/[0.02] border-white/10 text-white/60 hover:border-white/20 hover:text-white"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <Database className={`w-6 h-6 ${provider === "supabase" ? "text-accent" : "text-white/50"}`} />
              {provider === "supabase" && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-accent/20 text-accent font-medium border border-accent/30">
                  Active
                </span>
              )}
            </div>
            <h4 className="font-semibold text-white">Supabase Cloud</h4>
            <p className="text-xs text-white/50 mt-1">
              Global CDN bucket with direct public URLs and 1GB free tier included on Supabase.
            </p>
            <div className="mt-3 text-[11px] text-accent/80 font-mono">Free 1GB Cloud Storage</div>
          </div>

          {/* Cloudflare R2 / S3 */}
          <div
            onClick={() => setProvider("s3_r2")}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              provider === "s3_r2"
                ? "bg-accent/10 border-accent text-white shadow-lg shadow-accent/10"
                : "bg-white/[0.02] border-white/10 text-white/60 hover:border-white/20 hover:text-white"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <Cloud className={`w-6 h-6 ${provider === "s3_r2" ? "text-accent" : "text-white/50"}`} />
              {provider === "s3_r2" && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-accent/20 text-accent font-medium border border-accent/30">
                  Active
                </span>
              )}
            </div>
            <h4 className="font-semibold text-white">Cloudflare R2 / S3</h4>
            <p className="text-xs text-white/50 mt-1">
              Zero egress fee cloud object storage with S3 compatible API. 10GB free tier.
            </p>
            <div className="mt-3 text-[11px] text-accent/80 font-mono">Free 10GB S3/R2 Tier</div>
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSaveSettings} className="space-y-6 pt-4 border-t border-white/10">
          {provider === "local" && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Local Storage is fully ready to store live guest uploads
              </div>
              <p className="text-xs text-white/50">
                Uploaded files are saved to <code className="text-accent bg-black/40 px-1.5 py-0.5 rounded">public/uploads/</code> and streamed through the high-performance dynamic endpoint <code className="text-accent bg-black/40 px-1.5 py-0.5 rounded">/api/uploads/[filename]</code>.
              </p>
            </div>
          )}

          {provider === "supabase" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  placeholder="https://your-project-id.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-accent text-sm"
                  required={provider === "supabase"}
                />
                <span className="text-xs text-white/40 mt-1 block">
                  Find this in your Supabase Dashboard under Project Settings → API → Project URL.
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Supabase Service Role Key (Secret)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-accent text-sm font-mono"
                    required={provider === "supabase"}
                  />
                  <Lock className="w-4 h-4 text-white/30 absolute right-3.5 top-3.5" />
                </div>
                <span className="text-xs text-white/40 mt-1 block">
                  Found under Project Settings → API → service_role (secret). Required for secure server uploads.
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Storage Bucket Name
                </label>
                <input
                  type="text"
                  placeholder="live-photos"
                  value={supabaseBucket}
                  onChange={(e) => setSupabaseBucket(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-accent text-sm"
                  required={provider === "supabase"}
                />
                <span className="text-xs text-white/40 mt-1 block">
                  Name of the bucket created in Supabase Storage. Ensure &ldquo;Public bucket&rdquo; is toggled ON.
                </span>
              </div>
            </div>
          )}

          {provider === "s3_r2" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">
                    S3 Endpoint / Cloudflare R2 Endpoint
                  </label>
                  <input
                    type="url"
                    placeholder="https://<account-id>.r2.cloudflarestorage.com"
                    value={s3Endpoint}
                    onChange={(e) => setS3Endpoint(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-accent text-sm"
                    required={provider === "s3_r2"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">
                    Bucket Name
                  </label>
                  <input
                    type="text"
                    placeholder="live-photos"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-accent text-sm"
                    required={provider === "s3_r2"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">
                    Access Key ID
                  </label>
                  <input
                    type="text"
                    placeholder="Access Key"
                    value={s3AccessKey}
                    onChange={(e) => setS3AccessKey(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-accent text-sm font-mono"
                    required={provider === "s3_r2"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1.5">
                    Secret Access Key
                  </label>
                  <input
                    type="password"
                    placeholder="Secret Key"
                    value={s3SecretKey}
                    onChange={(e) => setS3SecretKey(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-accent text-sm font-mono"
                    required={provider === "s3_r2"}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Test Status Indicator */}
          {testResult && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm">
                <p className="font-semibold">{testResult.success ? "Connection Verified" : "Connection Error"}</p>
                <p className="text-xs mt-0.5 opacity-90">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleTestConnection}
              disabled={testing || loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? "animate-spin text-accent" : ""}`} />
              {testing ? "Testing Connection..." : "Test Connection"}
            </GlassButton>

            <GlassButton
              type="submit"
              variant="primary"
              disabled={saving || loading}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving Configuration..." : "Save Storage Settings"}
            </GlassButton>
          </div>
        </form>
      </GlassCard>

      {/* AI Face Engine Status Card */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-accent" />
            <div>
              <h3 className="text-lg font-semibold text-white">AI Face Recognition & Vision Engine</h3>
              <p className="text-xs text-white/50">
                Deep neural network face matching pipeline powered by OpenCV YuNet + SFace.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            100% Free · Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-xs text-white/40 mb-1">Face Detection Model</div>
            <div className="text-sm font-semibold text-white">OpenCV YuNet ONNX</div>
            <div className="text-[11px] text-accent mt-1">Multi-angle, occluded & low-light detection</div>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-xs text-white/40 mb-1">Face Recognition Model</div>
            <div className="text-sm font-semibold text-white">SFace (128-d Vector)</div>
            <div className="text-[11px] text-accent mt-1">Deep cosine similarity selfie matching</div>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-xs text-white/40 mb-1">API Cost & Latency</div>
            <div className="text-sm font-semibold text-white">\$0.00 / Zero Cost</div>
            <div className="text-[11px] text-emerald-400 mt-1">Runs locally on CPU in &lt;150ms</div>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between text-xs text-white/50 border-t border-white/5">
          <span>Try guest face search on live event galleries:</span>
          <Link href="/ai-search" className="text-accent hover:underline flex items-center gap-1">
            Open AI Face Search <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </GlassCard>

      {/* Android Native App Card */}
      <GlassCard className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-7 h-7 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Android Mobile App (Release APK)</h3>
            <p className="text-xs text-white/50 mt-0.5">
              Native Jetpack Compose Android app with offline capture, instant live upload, and AI gallery sync.
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className="text-emerald-400 font-medium">✓ Built & Signed APK (8.75 MB)</span>
              <span className="text-white/30">|</span>
              <span className="text-white/60">Android 8.0 to 14+</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/download">
            <GlassButton variant="secondary" className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-accent" />
              Download Page
            </GlassButton>
          </Link>
          <a href="/apk/live-photo-share.apk" download>
            <GlassButton variant="primary" className="flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              Get APK Direct
            </GlassButton>
          </a>
        </div>
      </GlassCard>
    </div>
  );
}
