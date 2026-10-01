import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Finanças do casal",
    short_name: "Finanças",
    description: "Contas, cartões e comprovantes do casal em um só lugar.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f4f1",
    theme_color: "#2a78d6",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Enviar comprovante", url: "/comprovantes", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "Novo lançamento", url: "/lancamentos/novo", icons: [{ src: "/icons/192", sizes: "192x192" }] },
    ],
    // Android: o app aparece no menu "Compartilhar" para receber comprovantes.
    // O iOS não suporta share_target; lá o envio é pelo botão dentro do app.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        files: [{ name: "receipt", accept: ["image/*", "application/pdf"] }],
      },
    },
  };
}
