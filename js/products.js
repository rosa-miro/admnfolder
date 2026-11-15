

"use strict";

const STORE_CONFIG = {
  brandName: "ADM FOLDER",
  telegramUsername: "ADM_FOLDER021",
  currency: "USD",

  offerEndsAt: (() => {
    const key = "adm_folder_offer_end";
    let end = Number(localStorage.getItem(key));

    if (!Number.isFinite(end) || end <= 0) {
      end = Date.now() + 48 * 60 * 60 * 1000;
      localStorage.setItem(key, String(end));
    }

    return new Date(end).toISOString();
  })()
};


// LER DADOS GUARDADOS
function readSaved(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

const CUSTOM = readSaved("adm_folder_collections_v1");
const OLD_PRICES = readSaved("adm_folder_prices_v1");

// GERAR AS 41 COLEÇÕES
const PRODUCTS = Array.from(
  { length: 41 },
  (_, index) => {
    const number = index + 1;
    const custom = CUSTOM[number] || {};
    const old = OLD_PRICES[number] || {};

    const name = custom.name ??
      (number === 1
        ? "Ocean Collection"
        : `Collection ${number}`);

    const description = custom.description ??
      `Explore digital collection ${number}. ` +
      "Watch the preview before ordering.";

    return {
      id: String(number),

      name: name,
      coverText: name,
      description: description,

      price: custom.price ?? old.price ?? 40,
      oldPrice: custom.oldPrice ?? old.oldPrice ?? 60,

      published: true,
      popular: number <= 10,
      isNew: number >= 32,

      purchases: 0,
      left: 0,

      // ETIQUETAS EDITÁVEIS
      files: custom.files ?? "Digital Collection",
      size: custom.size ?? "Video Preview",

      theme: "purple",

      // FOTOGRAFIAS
      coverImage: number === 4
        ? "./images/cp4.jpg"
        : `./images/cp${number}.jpeg`,

      // VÍDEOS
      previewVideo: number === 1
        ? "./videos/ocean-8.mp4"
        : `./videos/video${number}.mp4`
    };
  }
);

window.STORE_CONFIG = STORE_CONFIG;
window.PRODUCTS = PRODUCTS;
