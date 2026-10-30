import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { recognize } from "@/lib/recognize";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File)) return NextResponse.json({ error: "No image" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = process.env.UPLOAD_DIR || "./uploads";
  await mkdir(dir, { recursive: true });
  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const photoPath = path.join(dir, `${randomUUID()}.${ext}`);
  await writeFile(photoPath, buf);

  const mediaType = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) ? file.type : "image/jpeg";
  const recognition = await recognize(buf.toString("base64"), mediaType);
  return NextResponse.json({ photoPath, ...recognition });
}
