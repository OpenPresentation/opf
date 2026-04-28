import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PptxClient,
  PptxApiError,
  PptxRateLimitError,
  PptxValidationError,
  type PptxClientOptions,
} from "@pptx/sdk";
import { z } from "zod";

export interface CreatePptxMcpServerOptions {
  /**
   * Bearer token for pptx.dev. Falls back to `PPTX_API_KEY` env var.
   * For remote/HTTP transports, pass a per-request token from the
   * `Authorization` header instead of the process env.
   */
  apiKey?: string;

  /**
   * Override the API base URL. Defaults to `https://api.pptx.dev`.
   */
  baseUrl?: string;

  /**
   * Server name advertised to MCP clients. Defaults to `pptx-mcp`.
   */
  name?: string;

  /**
   * Server version advertised to MCP clients. Defaults to the package version.
   */
  version?: string;

  /**
   * Custom fetch implementation. Defaults to global fetch.
   */
  fetch?: typeof fetch;
}

const SERVER_NAME = "pptx-mcp";
const SERVER_VERSION = "0.1.0";

const RENDER_FORMATS = ["web", "svg", "png"] as const;
type RenderTargetFormat = (typeof RENDER_FORMATS)[number];

const GENERATE_FORMATS = ["pptx", "pdf", "png", "svg"] as const;
type GenerateTargetFormat = (typeof GENERATE_FORMATS)[number];

/**
 * Create a fully-wired MCP server instance exposing the four canonical
 * pptx.dev tools: generate_presentation, parse_pptx, validate_opf,
 * render_format. The server is transport-agnostic — connect it to
 * `StdioServerTransport` for local use or an HTTP-streaming transport
 * for remote deployment at mcp.pptx.dev.
 */
export function createPptxMcpServer(
  options: CreatePptxMcpServerOptions = {},
): McpServer {
  const clientOptions: PptxClientOptions = {};
  if (options.apiKey !== undefined) clientOptions.apiKey = options.apiKey;
  if (options.baseUrl !== undefined) clientOptions.baseUrl = options.baseUrl;
  if (options.fetch !== undefined) clientOptions.fetch = options.fetch;
  const client = new PptxClient(clientOptions);

  const server = new McpServer({
    name: options.name ?? SERVER_NAME,
    version: options.version ?? SERVER_VERSION,
  });

  // ─── generate_presentation ─────────────────────────────────────────
  server.registerTool(
    "generate_presentation",
    {
      title: "Generate a presentation from OPF JSON",
      description:
        "Submit an OPF (Open Presentation Format) document to pptx.dev and receive a generation job. Returns a 202-accepted envelope with job status, slide count, and any validation warnings. Use `validate_opf` first to catch schema errors client-side.",
      inputSchema: {
        document: z
          .record(z.any())
          .describe(
            "OPF document as a JSON object. Must include $schema, meta, design, and slides.",
          ),
        format: z
          .enum(GENERATE_FORMATS)
          .optional()
          .describe(
            "Target format. Defaults to pptx. Supported: pptx, pdf, png, svg.",
          ),
      },
    },
    async ({ document, format }) => {
      const opts: { format?: GenerateTargetFormat } = {};
      if (format !== undefined) opts.format = format;
      const result = await client.opf.generate(document, opts);
      return toTextResult(result);
    },
  );

  // ─── parse_pptx ────────────────────────────────────────────────────
  server.registerTool(
    "parse_pptx",
    {
      title: "Parse a .pptx file into OPF JSON",
      description:
        "Upload a .pptx file (by local filesystem path or base64 data) and get back OPF JSON plus a parseId for follow-up reads. Useful for converting existing decks into an AI-editable format.",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe(
            "Absolute filesystem path to a .pptx file. One of path or data is required.",
          ),
        data: z
          .string()
          .optional()
          .describe(
            "Base64-encoded .pptx bytes. One of path or data is required.",
          ),
        filename: z
          .string()
          .optional()
          .describe(
            "Optional filename hint (used when data is provided). Defaults to upload.pptx.",
          ),
        mode: z
          .enum(["opf", "parse"])
          .optional()
          .describe(
            "opf (default) converts the deck to OPF JSON. parse uploads and returns a parseId for per-slide reads.",
          ),
      },
    },
    async ({ path, data, filename, mode }) => {
      const bytes = await loadPptxBytes({ path, data });
      const effectiveFilename = filename ?? (path ? basename(path) : "upload.pptx");
      if (mode === "parse") {
        const result = await client.parse.upload({
          data: bytes,
          filename: effectiveFilename,
        });
        return toTextResult(result);
      }
      const opf = await client.convert.pptxToOpf({
        data: bytes,
        filename: effectiveFilename,
      });
      return toTextResult(opf);
    },
  );

  // ─── validate_opf ──────────────────────────────────────────────────
  server.registerTool(
    "validate_opf",
    {
      title: "Validate an OPF document",
      description:
        "Validate an OPF document against the canonical schema at https://pptx.dev/schema/opf/v1. Returns { valid, errors[], warnings[] }. Validation is free and should be run before generate_presentation.",
      inputSchema: {
        document: z
          .record(z.any())
          .describe("OPF document as a JSON object."),
      },
    },
    async ({ document }) => {
      const result = await client.opf.validate(document);
      return toTextResult(result);
    },
  );

  // ─── render_format ─────────────────────────────────────────────────
  server.registerTool(
    "render_format",
    {
      title: "Render a .pptx file to a target format",
      description:
        "Render a .pptx file to web (interactive slides with text runs), svg, or png. web returns slide data + viewerUrl; svg/png return a 202 job acknowledgement while the renderer is engaged.",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe(
            "Absolute filesystem path to a .pptx file. One of path or data is required.",
          ),
        data: z
          .string()
          .optional()
          .describe(
            "Base64-encoded .pptx bytes. One of path or data is required.",
          ),
        filename: z.string().optional(),
        format: z
          .enum(RENDER_FORMATS)
          .describe("Target format: web, svg, or png."),
        slides: z
          .array(z.number().int().positive())
          .optional()
          .describe(
            "Optional 1-based slide indices to render. Defaults to all slides.",
          ),
      },
    },
    async ({ path, data, filename, format, slides }) => {
      const bytes = await loadPptxBytes({ path, data });
      const effectiveFilename =
        filename ?? (path ? basename(path) : "upload.pptx");
      const file = { data: bytes, filename: effectiveFilename };
      if (format === "web") {
        const opts: { slides?: number[] } = {};
        if (slides !== undefined) opts.slides = slides;
        const result = await client.render.web(file, opts);
        return toTextResult(result);
      }
      const exportFormat = format as Exclude<RenderTargetFormat, "web">;
      const opts: { slides?: number[] } = {};
      if (slides !== undefined) opts.slides = slides;
      const result = await client.render.export(file, exportFormat, opts);
      return toTextResult(result);
    },
  );

  return server;
}

interface LoadBytesArgs {
  path?: string | undefined;
  data?: string | undefined;
}

async function loadPptxBytes({ path, data }: LoadBytesArgs): Promise<Uint8Array> {
  if (path) {
    return new Uint8Array(await readFile(path));
  }
  if (data) {
    return new Uint8Array(Buffer.from(data, "base64"));
  }
  throw new Error(
    "pptx-mcp: one of `path` or `data` is required for file-based tools.",
  );
}

function basename(p: string): string {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function toTextResult(value: unknown) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return {
    content: [{ type: "text" as const, text }],
  };
}

/**
 * Classify a pptx.dev SDK error into an MCP-friendly error message.
 * Intended for transport layers that want to surface structured errors.
 */
export function formatPptxError(err: unknown): string {
  if (err instanceof PptxValidationError) {
    return `OPF schema validation failed (HTTP ${err.status}): ${err.validationErrors.join("; ")}`;
  }
  if (err instanceof PptxRateLimitError) {
    const retry =
      err.retryAfterSeconds !== undefined
        ? ` Retry after ${err.retryAfterSeconds}s.`
        : "";
    return `pptx.dev rate limit exceeded.${retry}`;
  }
  if (err instanceof PptxApiError) {
    return `pptx.dev API error ${err.status}: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
