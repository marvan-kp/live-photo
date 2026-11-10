import { NextResponse } from "next/server";
import { getStorageConfig, saveStorageConfig, testStorageConnection, StorageConfig } from "@/lib/cloudStorage";
import { getCloudHealthReport } from "@/lib/cloudDb";

function maskSecret(val?: string, prefix = 6, suffix = 4): string {
  if (!val) return "";
  if (val.length <= prefix + suffix) return "••••••••";
  return `${val.substring(0, prefix)}...${val.slice(-suffix)}`;
}

export async function GET() {
  try {
    const config = getStorageConfig();
    const [testResult, cloudDbHealth] = await Promise.all([
      testStorageConnection(config),
      getCloudHealthReport(),
    ]);

    // Mask secret keys for security in client UI
    const maskedConfig = {
      provider: config.provider,
      blobToken: maskSecret(config.blobToken, 12, 4),
      supabase: config.supabase
        ? {
            url: config.supabase.url,
            bucket: config.supabase.bucket,
            serviceRoleKey: maskSecret(config.supabase.serviceRoleKey, 6, 4),
          }
        : undefined,
      s3: config.s3
        ? {
            endpoint: config.s3.endpoint,
            accessKeyId: maskSecret(config.s3.accessKeyId, 4, 4),
            secretAccessKey: config.s3.secretAccessKey ? "••••••••••••" : "",
            bucketName: config.s3.bucketName,
            region: config.s3.region || "auto",
            publicUrl: config.s3.publicUrl || "",
          }
        : undefined,
      kv: config.kv
        ? {
            url: config.kv.url,
            token: maskSecret(config.kv.token, 6, 4),
          }
        : undefined,
    };

    return NextResponse.json(
      {
        success: true,
        config: maskedConfig,
        testResult,
        cloudDbHealth,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, supabase, s3, blobToken, kv, action } = body;

    const currentConfig = getStorageConfig();

    const resolveSecret = (incoming?: string, existing?: string) => {
      if (!incoming) return existing || "";
      if (incoming.includes("...") || incoming.includes("•")) return existing || "";
      return incoming.trim();
    };

    const buildMergedConfig = (): StorageConfig => {
      const next: StorageConfig = {
        ...currentConfig,
        provider: provider || "local",
      };

      if (blobToken !== undefined) {
        next.blobToken = resolveSecret(blobToken, currentConfig.blobToken) || undefined;
      }

      if (supabase) {
        next.supabase = {
          url: supabase.url?.trim() || currentConfig.supabase?.url || "",
          bucket: supabase.bucket?.trim() || currentConfig.supabase?.bucket || "live-photos",
          serviceRoleKey: resolveSecret(supabase.serviceRoleKey, currentConfig.supabase?.serviceRoleKey),
        };
      }

      if (s3) {
        next.s3 = {
          endpoint: s3.endpoint?.trim() || currentConfig.s3?.endpoint || "",
          bucketName: s3.bucketName?.trim() || currentConfig.s3?.bucketName || "live-photos",
          region: s3.region?.trim() || currentConfig.s3?.region || "auto",
          publicUrl: s3.publicUrl?.trim() ?? currentConfig.s3?.publicUrl ?? "",
          accessKeyId: resolveSecret(s3.accessKeyId, currentConfig.s3?.accessKeyId),
          secretAccessKey: resolveSecret(s3.secretAccessKey, currentConfig.s3?.secretAccessKey),
        };
      }

      if (kv) {
        const kvUrl = kv.url?.trim() || "";
        const kvToken = resolveSecret(kv.token, currentConfig.kv?.token);
        if (kvUrl && kvToken) {
          next.kv = { url: kvUrl, token: kvToken };
        }
      }

      return next;
    };

    if (action === "test-only") {
      const tempConfig = buildMergedConfig();
      const testResult = await testStorageConnection(tempConfig);
      return NextResponse.json({ success: testResult.success, testResult });
    }

    const newConfig = buildMergedConfig();
    saveStorageConfig(newConfig);

    const [testResult, cloudDbHealth] = await Promise.all([
      testStorageConnection(newConfig),
      getCloudHealthReport(),
    ]);

    return NextResponse.json({
      success: true,
      message: "Storage configuration updated successfully!",
      config: {
        ...newConfig,
        blobToken: maskSecret(newConfig.blobToken, 12, 4),
        supabase: newConfig.supabase
          ? { ...newConfig.supabase, serviceRoleKey: maskSecret(newConfig.supabase.serviceRoleKey, 6, 4) }
          : undefined,
        s3: newConfig.s3
          ? {
              ...newConfig.s3,
              accessKeyId: maskSecret(newConfig.s3.accessKeyId, 4, 4),
              secretAccessKey: newConfig.s3.secretAccessKey ? "••••••••••••" : "",
            }
          : undefined,
        kv: newConfig.kv
          ? { url: newConfig.kv.url, token: maskSecret(newConfig.kv.token, 6, 4) }
          : undefined,
      },
      testResult,
      cloudDbHealth,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

