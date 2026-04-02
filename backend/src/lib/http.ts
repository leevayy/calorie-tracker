import type { FastifyReply } from "fastify";

export const ErrorResponseJsonSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
  required: ["message"],
} as const;

export function sendValidationError(reply: FastifyReply, message = "Invalid request"): FastifyReply {
  return reply.status(400).send({ message });
}

export function sendUnauthorized(reply: FastifyReply): FastifyReply {
  return reply.status(401).send({ message: "Unauthorized" });
}
