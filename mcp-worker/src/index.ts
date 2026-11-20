import type { ExecutionContext } from "@cloudflare/workers-types";
import { method } from "@poppanator/http-constants";

import { Env, GitHubContentItem, JsonRpcRequest } from "./type/type";
import { initialize as notificationInitialized } from "./notifications/notifications";
import { initialize } from "./initialize/initialize";
import {
  list as resourceList,
  read as resourceRead,
} from "./resources/resources";
import { list as toolsList, call as toolsCall } from "./tools/tools";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    switch (request.method) {
      case method.Options:
        return new Response(null, { headers: corsHeaders });

      case method.Get:
        return new Response(
          JSON.stringify({
            status: "ok",
            message: "Blog Hybrid MCP Worker (TS) is running",
          }),
          { headers: corsHeaders },
        );

      case method.Post:
        let requestId: string | number | null = null;

        try {
          const body: JsonRpcRequest = await request.json();
          const { method, id, params = {} } = body;
          requestId = id ?? null;

          const {
            GITHUB_OWNER,
            GITHUB_REPO,
            BRANCH = "main",
            GITHUB_TOKEN,
          } = env;

          if (!GITHUB_OWNER || !GITHUB_REPO) {
            throw new Error(
              "Missing GITHUB_OWNER or GITHUB_REPO environment variables.",
            );
          }

          let result: any = {};

          switch (method) {
            case "initialize":
              result = initialize();
              break;

            case "notifications/initialized":
              result = notificationInitialized();
              break;

            case "resources/list":
              result = await resourceList(env);
              break;

            case "resources/read":
              result = await resourceRead(params, env);
              break;

            case "tools/list":
              result = toolsList();
              break;

            case "tools/call":
              result = await toolsCall(params, env);
              break;

            default:
              return new Response(
                JSON.stringify({
                  jsonrpc: "2.0",
                  error: {
                    code: -32601,
                    message: `Method not found: ${method}`,
                  },
                  id: requestId,
                }),
                { headers: corsHeaders },
              );
          }

          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              result,
              id: requestId,
            }),
            { headers: corsHeaders },
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32603,
                message: err.message || "Unknown internal error",
              },
              id: requestId,
            }),
            { status: 500, headers: corsHeaders },
          );
        }

      default:
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32601, message: "Method not allowed" },
            id: null,
          }),
          { status: 405, headers: corsHeaders },
        );
    }
  },
};
