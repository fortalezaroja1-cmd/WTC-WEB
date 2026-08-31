const ALLOWED_IMAGE_HOST = "klfomayggscumxevsfgp.supabase.co";
const ALLOWED_IMAGE_PREFIX = "/storage/v1/object/public/products/";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return new Response("Falta la URL de la imagen", { status: 400 });
  }

  let remoteUrl: URL;
  try {
    remoteUrl = new URL(rawUrl);
  } catch {
    return new Response("URL de imagen inválida", { status: 400 });
  }

  if (
    remoteUrl.protocol !== "https:" ||
    remoteUrl.hostname !== ALLOWED_IMAGE_HOST ||
    !remoteUrl.pathname.startsWith(ALLOWED_IMAGE_PREFIX)
  ) {
    return new Response("Origen de imagen no permitido", { status: 403 });
  }

  try {
    const imageResponse = await fetch(remoteUrl.toString(), {
      cache: "no-store",
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
    });

    if (!imageResponse.ok) {
      return new Response("No se pudo obtener la imagen", { status: 502 });
    }

    const contentType = imageResponse.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return new Response("El recurso no es una imagen", { status: 415 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
      return new Response("Imagen demasiado grande", { status: 413 });
    }

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Error cargando imagen para catálogo:", error);
    return new Response("Error cargando la imagen", { status: 500 });
  }
}
