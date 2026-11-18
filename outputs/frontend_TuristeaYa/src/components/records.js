import { element } from "./dom.js";

export function control(label, handler) {
  const button = element("button", { text: label, attrs: { type: "button" } });
  button.addEventListener("click", handler);
  return button;
}

export function card(title, detail, controls = []) {
  const article = element("article", { className: "record-card" });
  article.append(element("strong", { text: title }));
  if (detail) article.append(element("p", { text: detail }));
  if (controls.length) {
    const actions = element("div", { className: "record-actions" });
    actions.append(...controls);
    article.append(actions);
  }
  return article;
}

export function recordPanel(view, title) {
  const group = element("section", { className: "record-panel", attrs: { "aria-label": title } });
  const footer = [...view.content.querySelectorAll(".screen-row")].find((row) => row.querySelector('.layer[style*="height: 58px"]'));
  if (footer) footer.style.marginTop = "12px";
  view.content.insertBefore(group, footer ?? view.status);
  return group;
}
