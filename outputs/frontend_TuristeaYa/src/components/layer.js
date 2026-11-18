import { element } from "./dom.js";

export function layer(item, origin, controls) {
  const { id, x, y, w, h, text, fill, stroke, radius, font, line, color, bold, asset } = item;
  const field = controls.fields[id];
  const action = controls.actions[id];
  const tag = field ? "input" : action ? "button" : asset ? "img" : text ? "span" : "div";
  const node = element(tag, { className: "layer", text: field || asset ? undefined : text, attrs: { "data-figma-node": id } });
  Object.assign(node.style, {
    left: `${x / 390 * 100}%`, top: `${y - origin}px`, width: `${w / 390 * 100}%`,
    height: `${h}px`, backgroundColor: fill, borderColor: stroke, borderRadius: radius ? `${radius}px` : "",
    fontSize: font ? `${font}px` : "", color, lineHeight: line ? `${line}px` : "",
    fontWeight: bold ? "700" : "",
  });
  if (stroke) node.classList.add("outlined");
  if (item.decoration) node.classList.add(`decoration-${item.decoration}`);
  if (asset) {
    node.src = new URL(`../../assets/${asset}`, import.meta.url).href;
    node.alt = "";
    node.setAttribute("aria-hidden", "true");
  }
  if (action) {
    node.type = "button";
    node.classList.add("action");
    node.setAttribute("aria-label", typeof action === "function" ? text : action.label);
    node.addEventListener("click", typeof action === "function" ? action : action.run);
    if (item.pressed !== undefined) {
      node.setAttribute("aria-pressed", String(item.pressed));
      node.classList.toggle("selected", item.pressed);
    }
  }
  if (field) {
    Object.assign(node, field);
    node.classList.add("field");
  }
  return node;
}
