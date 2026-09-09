import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { UPLOAD_DIR } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ name: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { name } = await context.params;
  if (!/^[a-f0-9]{48}(?:\.[a-zA-Z0-9]+)?$/.test(name)) return new NextResponse("Not found", { status: 404 });
  try {
    const file = await fs.readFile(path.join(UPLOAD_DIR, name));
    const ext = path.extname(name).toLowerCase();
    const types: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
    };
    return new NextResponse(file, {
      headers: {
        "Content-Type": types[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
