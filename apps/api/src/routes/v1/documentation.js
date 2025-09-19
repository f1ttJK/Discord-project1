"use strict";

/**
 * API Documentation endpoint with OpenAPI/Swagger specification
 * @param {import('fastify').FastifyInstance} fastify
 */
async function documentationRoutes(fastify) {
  // OpenAPI specification
  const openApiSpec = {
    openapi: "3.0.3",
    info: {
      title: "Discord Bot Management API",
      description: "REST API for managing Discord bot configurations, leveling, and moderation features",
      version: "1.0.0",
      contact: {
        name: "API Support",
        url: "https://github.com/example/discord-bot"
      }
    },
    servers: [
      {
        url: "/v1",
        description: "API v1"
      }
    ],
    paths: {
      "/health": {
        get: {
          summary: "Health check",
          description: "Returns API health status and dependency information",
          tags: ["System"],
          responses: {
            "200": {
              description: "API is healthy",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", enum: ["healthy", "degraded"] },
                      timestamp: { type: "string", format: "date-time" },
                      uptime: { type: "integer" },
                      dependencies: {
                        type: "object",
                        properties: {
                          discord: {
                            type: "object",
                            properties: {
                              status: { type: "string" },
                              failures: { type: "integer" },
                              successes: { type: "integer" }
                            }
                          },
                          database: {
                            type: "object",
                            properties: {
                              status: { type: "string" },
                              failures: { type: "integer" },
                              successes: { type: "integer" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "503": {
              description: "API is degraded",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" }
                }
              }
            }
          }
        }
      },
      "/guilds/{guildId}": {
        get: {
          summary: "Get guild information",
          description: "Retrieve basic information about a guild",
          tags: ["Guilds"],
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "guildId",
              in: "path",
              required: true,
              schema: { type: "string", pattern: "^\\d{17,19}$" },
              description: "Discord guild ID"
            }
          ],
          responses: {
            "200": {
              description: "Guild information",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      guild: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          createdAt: { type: "string", format: "date-time" },
                          updatedAt: { type: "string", format: "date-time" }
                        }
                      }
                    }
                  }
                }
              }
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" }
          }
        }
      },
      "/guilds/{guildId}/config": {
        get: {
          summary: "Get guild configuration",
          description: "Retrieve the configuration settings for a guild",
          tags: ["Guild Config"],
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "guildId",
              in: "path",
              required: true,
              schema: { type: "string", pattern: "^\\d{17,19}$" },
              description: "Discord guild ID"
            }
          ],
          responses: {
            "200": {
              description: "Guild configuration",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      config: { $ref: "#/components/schemas/GuildConfig" },
                      cached: { type: "boolean" }
                    }
                  }
                }
              }
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" }
          }
        },
        put: {
          summary: "Update guild configuration",
          description: "Update the configuration settings for a guild",
          tags: ["Guild Config"],
          security: [{ sessionAuth: [] }, { bearerAuth: [] }],
          parameters: [
            {
              name: "guildId",
              in: "path",
              required: true,
              schema: { type: "string", pattern: "^\\d{17,19}$" },
              description: "Discord guild ID"
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GuildConfigUpdate" }
              }
            }
          },
          responses: {
            "200": {
              description: "Configuration updated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      config: { $ref: "#/components/schemas/GuildConfig" },
                      updated: { type: "boolean" },
                      timestamp: { type: "string", format: "date-time" }
                    }
                  }
                }
              }
            },
            "400": { $ref: "#/components/responses/ValidationError" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "404": { $ref: "#/components/responses/NotFound" }
          }
        }
      },
      "/metrics": {
        get: {
          summary: "Get API metrics",
          description: "Returns API performance and health metrics",
          tags: ["System"],
          responses: {
            "200": {
              description: "API metrics",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      timestamp: { type: "string", format: "date-time" },
                      uptime: { type: "integer" },
                      memory: { type: "object" },
                      application: {
                        type: "object",
                        properties: {
                          requests: { type: "object" },
                          cache: { type: "object" },
                          circuitBreakers: { type: "object" }
                        }
                      }
                    }
                  }
                },
                "text/plain": {
                  schema: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message", "status"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                status: { type: "integer" },
                details: { type: "object" }
              }
            }
          }
        },
        GuildConfig: {
          type: "object",
          properties: {
            levelingEnabled: { type: "boolean", default: false },
            warnsEnabled: { type: "boolean", default: true },
            muteEnabled: { type: "boolean", default: true },
            economyEnabled: { type: "boolean", default: false },
            maxWarns: { type: "integer", minimum: 1, maximum: 10, default: 3 },
            warnExpiry: { type: "integer", minimum: 0, default: 0 },
            muteRole: { type: "string", nullable: true },
            maxMuteDuration: { type: "integer", minimum: 60, maximum: 2592000, default: 86400 },
            dailyReward: { type: "integer", minimum: 1, maximum: 1000, default: 100 },
            workReward: { type: "integer", minimum: 1, maximum: 1000, default: 50 },
            language: { type: "string", enum: ["en", "ru", "es", "fr", "de"], default: "en" },
            timezone: { type: "string", nullable: true },
            logChannel: { type: "string", nullable: true },
            welcomeChannel: { type: "string", nullable: true },
            welcomeMessage: { type: "string", maxLength: 2000, nullable: true },
            curve: { type: "string", enum: ["linear", "exponential", "logarithmic"], default: "linear" }
          }
        },
        GuildConfigUpdate: {
          type: "object",
          properties: {
            levelingEnabled: { type: "boolean" },
            warnsEnabled: { type: "boolean" },
            muteEnabled: { type: "boolean" },
            economyEnabled: { type: "boolean" },
            maxWarns: { type: "integer", minimum: 1, maximum: 10 },
            warnExpiry: { type: "integer", minimum: 0 },
            muteRole: { type: "string" },
            maxMuteDuration: { type: "integer", minimum: 60, maximum: 2592000 },
            dailyReward: { type: "integer", minimum: 1, maximum: 1000 },
            workReward: { type: "integer", minimum: 1, maximum: 1000 },
            language: { type: "string", enum: ["en", "ru", "es", "fr", "de"] },
            timezone: { type: "string" },
            logChannel: { type: "string" },
            welcomeChannel: { type: "string" },
            welcomeMessage: { type: "string", maxLength: 2000 },
            curve: { type: "string", enum: ["linear", "exponential", "logarithmic"] }
          },
          additionalProperties: false
        }
      },
      responses: {
        Unauthorized: {
          description: "Authentication required",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" }
            }
          }
        },
        Forbidden: {
          description: "Insufficient permissions",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" }
            }
          }
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" }
            }
          }
        },
        ValidationError: {
          description: "Request validation failed",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/Error" },
                  {
                    type: "object",
                    properties: {
                      error: {
                        type: "object",
                        properties: {
                          issues: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                path: { type: "string" },
                                message: { type: "string" },
                                code: { type: "string" }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      },
      securitySchemes: {
        sessionAuth: {
          type: "apiKey",
          in: "cookie",
          name: "session"
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    tags: [
      {
        name: "System",
        description: "System health and monitoring endpoints"
      },
      {
        name: "Guilds",
        description: "Guild management operations"
      },
      {
        name: "Guild Config",
        description: "Guild configuration management"
      }
    ]
  };

  // Serve OpenAPI spec as JSON
  fastify.get("/docs/openapi.json", async (request, reply) => {
    reply.type('application/json');
    return openApiSpec;
  });

  // Serve Swagger UI
  fastify.get("/docs", async (request, reply) => {
    const swaggerHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Discord Bot API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/v1/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;

    reply.type('text/html');
    return swaggerHtml;
  });

  // API endpoints summary
  fastify.get("/docs/endpoints", async (request, reply) => {
    return {
      endpoints: [
        { method: "GET", path: "/v1/health", description: "Health check" },
        { method: "GET", path: "/v1/ready", description: "Readiness probe" },
        { method: "GET", path: "/v1/live", description: "Liveness probe" },
        { method: "GET", path: "/v1/metrics", description: "API metrics" },
        { method: "GET", path: "/v1/metrics/cache", description: "Cache metrics" },
        { method: "GET", path: "/v1/metrics/circuit-breakers", description: "Circuit breaker status" },
        { method: "GET", path: "/v1/me", description: "Current user info" },
        { method: "GET", path: "/v1/guilds", description: "List user guilds" },
        { method: "GET", path: "/v1/guilds/{guildId}", description: "Get guild info" },
        { method: "GET", path: "/v1/guilds/{guildId}/config", description: "Get guild config" },
        { method: "PUT", path: "/v1/guilds/{guildId}/config", description: "Update guild config" },
        { method: "GET", path: "/v1/docs", description: "API documentation (Swagger UI)" },
        { method: "GET", path: "/v1/docs/openapi.json", description: "OpenAPI specification" },
        { method: "GET", path: "/v1/docs/endpoints", description: "Endpoints summary" }
      ],
      authentication: {
        session: "Cookie-based session authentication",
        bearer: "JWT Bearer token authentication"
      },
      rateLimit: {
        global: "1000 requests per minute per IP",
        user: "100 requests per minute per user",
        guildConfig: "30 requests per minute per user per guild"
      }
    };
  });
}

module.exports = documentationRoutes;
