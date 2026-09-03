import test from "node:test";
import assert from "node:assert/strict";
import { mapNoticeFromApi } from "./notice.service.js";

test("mapNoticeFromApi normaliza DTO administrativo de snake_case a camelCase", () => {
  const payload = mapNoticeFromApi({
    id_aviso: 14,
    titulo: "Aviso",
    resumen: "Resumen",
    descripcion: "<p>Contenido</p>",
    estado: "PUBLICADO",
    fecha_publicacion: "2026-06-22",
    publico: true,
    cover_asset: {
      file_asset_id: 3,
      public_id: "123e4567-e89b-42d3-a456-426614174000",
      original_name: "portada.jpg",
      context: "NOTICE_COVER",
    },
    content_images: [
      {
        file_asset_id: 4,
        public_id: "123e4567-e89b-42d3-a456-426614174001",
        original_name: "contenido.jpg",
        context: "NOTICE_CONTENT_IMAGE",
      },
    ],
    user: {
      id_usuario: 9,
      nombre: "Ana",
      apellido: "Gomez",
      full_name: "Ana Gomez",
    },
  });

  assert.equal(payload.id, 14);
  assert.equal(payload.title, "Aviso");
  assert.equal(payload.publishedAt, "2026-06-22");
  assert.equal(payload.coverAsset.publicId, "123e4567-e89b-42d3-a456-426614174000");
  assert.equal(payload.contentImages[0].publicId, "123e4567-e89b-42d3-a456-426614174001");
  assert.equal(payload.user.fullName, "Ana Gomez");
});
