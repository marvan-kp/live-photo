import { NextResponse } from "next/server";
import { getStorageConfig, saveStorageConfig, testStorageConnection, StorageConfig } from "@/lib/cloudStorage";

export async function GET() {
  try {
    const config = getStorageConfig();
    const testResult = await testStorageConnection(config);

    // Mask secret keys for security in client UI
    const maskedConfig = {
      provider: config.provider,
      supabase: config.supabase
        ? {
            url: config.supabase.url,
            bucket: config.supabase.bucket,
            serviceRoleKey: config.supabase.serviceRoleKey
              ? `${config.supabase.serviceRoleKey.substring(0, 6)}...${config.supabase.serviceRoleKey.slice(-4)}`
              : "",
          }
        : undefined,
      s3: config.s3
        ? {
            endpoint: config.s3.endpoint,
            accessKeyId: config.s3.accessKeyId
              ? `${config.s3.accessKeyId.substring(0, 4)}...${config.s3.accessKeyId.slice(-4)}`
              : "",
            secretAccessKey: config.s3.secretAccessKey ? "••••••••••••" : "",
            bucketName: config.s3.bucketName,
            region: config.s3.region || "auto",
          }
        : undefined,
    };

    return NextResponse.json({
      success: true,
      config: maskedConfig,
      testResult,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, supabase, s3, action } = body;

    const currentConfig = getStorageConfig();

    if (action === "test-only") {
      // Test without saving
      const tempConfig: StorageConfig = {
        provider: provider || "local",
        supabase: supabase?.url ? {
          url: supabase.url,
          bucket: supabase.bucket || "live-photos",
          serviceRoleKey: supabase.serviceRoleKey || currentConfig.supabase?.serviceRoleKey || "",
        } : undefined,
        s3: s3?.endpoint ? {
          endpoint: s3.endpoint,
          accessKeyId: s3.accessKeyId || currentConfig.s3?.accessKeyId || "",
          secretAccessKey: s3.secretAccessKey || currentConfig.s3?.secretAccessKey || "",
          bucketName: s3.bucketName || "live-photos",
          region: s3.region || "auto"
        } : undefined
      };

      const testResult = await testStorageConnection(tempConfig);
      return NextResponse.json({ success: testResult.success, testResult });
    }

    // Save configuration
    const newConfig: StorageConfig = {
      provider: provider || "local",
    };

    if (provider === "supabase" && supabase) {
      newConfig.supabase = {
        url: supabase.url?.trim() || "",
        bucket: supabase.bucket?.trim() || "live-photos",
        // Keep existing secret if user didn't change masked string
        serviceRoleKey:
          supabase.serviceRoleKey && !supabase.serviceRoleKey.includes("...")
            ? supabase.serviceRoleKey.trim()
            : currentConfig.supabase?.serviceRoleKey || "",
      };
    } else if (provider === "s3_r2" && s3) {
      newConfig.s3 = {
        endpoint: s3.endpoint?.trim() || "",
        bucketName: s3.bucketName?.trim() || "live-photos",
        region: s3.region?.trim() || "auto",
        accessKeyId:
          s3.accessKeyId && !s3.accessKeyId.includes("...")
            ? s3.accessKeyId.trim()
            : currentConfig.s3?.accessKeyId || "",
        secretAccessKey:
          s3.secretAccessKey && !s3.secretAccessKey.includes("•")
            ? s3.secretAccessKey.trim()
            : currentConfig.s3?.secretAccessKey || "",
      };
    }

    saveStorageConfig(newConfig);
    const testResult = await testStorageConnection(newConfig);

    return NextResponse.json({
      success: true,
      message: "Storage configuration updated successfully!",
      config: newConfig,
      testResult,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

