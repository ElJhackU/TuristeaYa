import { request } from "../api/client.js";
import { endpoints } from "../api/endpoints.js";

export const actions = {
  reserve: (id, { people, requestKey }, token) => request(endpoints.reserve(id), {
    method: "POST", token, body: { people, request_key: requestKey },
  }),
  redeem: (id, { purchaseAmount, requestKey }, token) => request(endpoints.redeem(id), {
    method: "POST", token, body: { purchase_amount: purchaseAmount, request_key: requestKey },
  }),
};
