import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { ownerFor } from "@/lib/auth";
import { UPLOAD_DIR } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!ownerFor(request)) return NextResponse.json({ error: "Private device session unavailable." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 422 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "This file is over 15 MB. Try a smaller file." }, { status: 413 });
  const extension = path.extname(file.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "") || ".bin";
  const name = `${crypto.randomBytes(24).toString("hex")}${extension}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/api/files/${name}`, filename: file.name, contentType: file.type || "application/octet-stream" }, { status: 201 });
}
