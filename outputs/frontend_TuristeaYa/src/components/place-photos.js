import { element } from "./dom.js";
import { publicPhotos } from "../data/place-photos.js";

export function placePhotos(rows, name) {
  const gallery = element("div", { className: "place-photos", attrs: { "aria-label": `Fotos de ${name}` } });
  const ordered = [...rows].filter(({ kind }) => kind === "photo").sort((a, b) => a.position - b.position);
  const urls = new Set();
  const fallbackUrl = new URL("https://www.google.com/search");
  fallbackUrl.search = new URLSearchParams({ tbm: "isch", q: `${name} Bolivia` });
  const fallback = element("a", { text: "Buscar fotos del lugar", attrs: {
    class: "map-link", href: fallbackUrl.href, target: "_blank", rel: "noopener noreferrer",
  } });
  const photo = Object.hasOwn(publicPhotos, name) ? publicPhotos[name] : null;
  if (photo) {
    const figure = element("figure", { className: "place-photo" });
    const source = element("a", { attrs: { href: photo.source, target: "_blank", rel: "noopener noreferrer" } });
    const credit = element("small", { text: `${photo.artist} · ${photo.license} · Wikimedia Commons` });
    const img = element("img", { attrs: { alt: name, loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" } });
    img.addEventListener("error", () => figure.remove(), { once: true });
    img.src = photo.url;
    source.append(img, credit);
    figure.append(source);
    gallery.append(figure);
    urls.add(photo.url);
  }
  for (const row of ordered) {
    let url;
    try { url = new URL(row.storage_path); } catch { continue; }
    if (url.protocol !== "https:" || urls.has(url.href)) continue;
    urls.add(url.href);
    const link = element("a", { attrs: { href: url.href, target: "_blank", rel: "noopener noreferrer" } });
    const img = element("img", { attrs: { alt: `Foto publicada para ${name}`, loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" } });
    img.addEventListener("error", () => link.remove(), { once: true });
    img.src = url.href;
    link.append(img);
    gallery.append(link);
  }
  gallery.append(fallback);
  return gallery;
}
