import { request } from "../api/client.js";
import { endpoints } from "../api/endpoints.js";

export const auth = {
  login: (email, password) => request(endpoints.login, { method: "POST", body: { email, password } }),
  register: ({ email, password, fullName, acceptTerms }) => request(endpoints.register, {
    method: "POST", body: { email, password, full_name: fullName, accept_terms: acceptTerms === true },
  }),
  refresh: (refreshToken) => request(endpoints.refresh, {
    method: "POST", body: { refresh_token: refreshToken },
  }),
  logout: (token) => request(endpoints.logout, { method: "POST", token }),
  profile: (token, signal) => request(endpoints.profile, { token, signal }),
};
