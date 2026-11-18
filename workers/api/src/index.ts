import { handleRequest } from "./router.js";
import { Env } from "./types.js";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return await handleRequest(request, env);
  }
};
