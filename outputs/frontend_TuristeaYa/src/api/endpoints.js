import { API_PREFIX } from "../config.js";

const resource = (name) => `${API_PREFIX}/${encodeURIComponent(name)}`;
const record = (name, id) => `${resource(name)}/${encodeURIComponent(id)}`;

export const endpoints = {
  health: "/health",
  login: `${API_PREFIX}/auth/login`,
  register: `${API_PREFIX}/auth/register`,
  refresh: `${API_PREFIX}/auth/refresh`,
  logout: `${API_PREFIX}/auth/logout`,
  profile: `${API_PREFIX}/me`,
  resource,
  record,
  reserve: (id) => `${record("experiences", id)}/reserve`,
  redeem: (id) => `${record("promotions", id)}/redeem`,
};
