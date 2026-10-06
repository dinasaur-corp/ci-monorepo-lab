import { respond } from "./handler.js";

export default {
  async fetch(request) {
    return Response.json(respond(new URL(request.url).pathname));
  },
};
