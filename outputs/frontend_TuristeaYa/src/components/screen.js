import { element } from "./dom.js";
import { layer } from "./layer.js";

export function screen(page, controls) {
  const phone = element("main", { className: "phone", attrs: { "aria-label": page.name } });
  const content = element("form", { className: "phone-content" });
  content.addEventListener("submit", (event) => {
    event.preventDefault();
    controls.submit?.();
  });

  // Overlapping Figma layers share a row. Each row participates in document flow.
  const groups = [];
  for (const item of [...page.nodes].sort((a, b) => a.y - b.y || Number(Boolean(a.text)) - Number(Boolean(b.text)))) {
    const previous = groups.at(-1);
    if (previous && previous.end > item.y) {
      previous.items.push(item);
      previous.end = Math.max(previous.end, item.y + item.h);
    } else {
      groups.push({ top: item.y, end: item.y + item.h, items: [item] });
    }
  }
  let previousEnd = 0;
  for (const group of groups) {
    const row = element("div", { className: "screen-row" });
    row.style.marginTop = `${group.top - previousEnd}px`;
    row.style.height = `${group.end - group.top}px`;
    const order = new Map(page.nodes.map((item, index) => [item.id, index]));
    for (const item of group.items.sort((a, b) => order.get(a.id) - order.get(b.id))) {
      row.append(layer(item, group.top, controls));
    }
    content.append(row);
    previousEnd = group.end;
  }
  const status = element("p", { className: "feedback", attrs: { role: "status", hidden: "" } });
  content.append(status);
  phone.append(content);
  return { phone, content, status };
}
