import { env } from "cloudflare:workers";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(file) || !env.BUCKET)
    return new Response("Not found", { status: 404 });
  const image = await env.BUCKET.get(file);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(image.body, {
    headers: {
      "Content-Type":
        image.httpMetadata?.contentType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public,max-age=31536000,immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
