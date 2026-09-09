import { NextRequest, NextResponse } from "next/server";
import { getLinkMetadata } from "@/lib/metadata";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { url } = await request.json();
  try {
    const metadata = await getLinkMetadata(String(url));
    return NextResponse.json({ metadata });
  } catch {
    return NextResponse.json({ metadata: { title: "Saved link", image: "", description: "We saved the link, but couldn’t find its details.", price: null, currency: null, store: "", url: String(url) }, warning: "Metadata could not be retrieved. You can still edit everything yourself." });
  }
}
