import page0 from "./bienvenida.js";
import { extraPages } from "./extra.js";
import { catalogPages } from "./catalog-pages.js";
import page1 from "./iniciar-sesion.js";
import page2 from "./crear-cuenta.js";
import page3 from "./inicio.js";
import page4 from "./ubicacion.js";
import page5 from "./crear-ruta.js";
import page6 from "./resultados.js";
import page7 from "./filtros.js";
import page8 from "./paseo-centro.js";
import page9 from "./tarde-cultural.js";
import page10 from "./editar-paradas.js";
import page11 from "./cafe-patio.js";

export const pages = {
  ...extraPages,
  ...catalogPages,
  "bienvenida": page0,
  "iniciar-sesion": page1,
  "crear-cuenta": page2,
  "inicio": page3,
  "ubicacion": page4,
  "crear-ruta": page5,
  "resultados": page6,
  "filtros": page7,
  "paseo-centro": page8,
  "tarde-cultural": page9,
  "editar-paradas": page10,
  "cafe-patio": page11,
};
