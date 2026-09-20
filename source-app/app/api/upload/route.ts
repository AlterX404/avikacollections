import { env } from "cloudflare:workers";
import { identity, rate, audit, db } from "../../../lib/server";
import { check } from "../../../lib/commerce.mjs";
export async function POST(request: Request) {
  try {
    check(
      request.headers.get("origin") === new URL(request.url).origin,
      "Request origin rejected.",
      403,
    );
    const who = await identity();
    check(who.admin, "Owner access required.", 403);
    await rate("upload:" + who.owner, 40);
    check(env.BUCKET, "Image storage is unavailable.", 503);
    const limit = 5 * 1024 * 1024;
    check(
      Number(request.headers.get("content-length") ?? 0) <= limit,
      "Image must be smaller than 5 MB.",
      413,
    );
    const reader = request.body?.getReader();
    check(reader, "Choose an image.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const r = await reader!.read();
      if (r.done) break;
      size += r.value.length;
      if (size > limit) {
        await reader!.cancel();
        check(false, "Image must be smaller than 5 MB.", 413);
      }
      chunks.push(r.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const ascii = (a: number, b: number) =>
      String.fromCharCode(...bytes.slice(a, b));
    let type = "",
      ext = "";
    if (
      size > 24 &&
      bytes[0] === 137 &&
      ascii(1, 4) === "PNG" &&
      bytes[4] === 13 &&
      bytes[5] === 10 &&
      bytes[6] === 26 &&
      bytes[7] === 10
    ) {
      type = "image/png";
      ext = "png";
    } else if (
      size > 4 &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255
    ) {
      type = "image/jpeg";
      ext = "jpg";
    } else if (size > 16 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
      type = "image/webp";
      ext = "webp";
    }
    check(
      type,
      "Choose a PNG, JPEG or WebP image. SVG and other files are not accepted.",
    );
    const key = crypto.randomUUID() + "." + ext;
    await env.BUCKET!.put(key, bytes, {
      httpMetadata: {
        contentType: type,
        cacheControl: "public,max-age=31536000,immutable",
      },
    });
    await db().batch([
      await audit(who.owner, "image_upload", key, { bytes: size, type }),
    ]);
    return Response.json(
      { url: "/media/" + key },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return Response.json(
      {
        error: err.status
          ? err.message
          : "Image upload failed. Please try again.",
      },
      { status: err.status ?? 500 },
    );
  }
}
