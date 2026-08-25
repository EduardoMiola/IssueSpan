import type { FastifyReply } from "fastify";
import { z } from "zod";
import { AuthenticationError, AuthorizationError } from "@issuespan/identity";

type Problem = {
  type: "about:blank";
  title: string;
  status: number;
  detail: string;
  code: string;
};

export const invalidCredentialsProblem: Problem = {
  type: "about:blank",
  title: "Unauthorized",
  status: 401,
  detail: "Invalid email or password.",
  code: "INVALID_CREDENTIALS",
};

export const loginRateLimitedProblem: Problem = {
  type: "about:blank",
  title: "Too Many Requests",
  status: 429,
  detail: "Try again later.",
  code: "LOGIN_RATE_LIMITED",
};

function sendProblem(reply: FastifyReply, problem: Problem) {
  return reply.status(problem.status).type("application/problem+json").send(problem);
}

/** Maps anticipated request failures to safe RFC 9457-compatible responses. */
export function handleApiError(error: unknown, reply: FastifyReply) {
  if (error instanceof AuthenticationError) {
    return sendProblem(reply, {
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Authentication required.",
      code: error.code,
    });
  }

  if (error instanceof AuthorizationError) {
    return sendProblem(reply, {
      type: "about:blank",
      title: "Forbidden",
      status: 403,
      detail: "Access denied.",
      code: error.code,
    });
  }

  if (
    error instanceof z.ZodError
    || (
      typeof error === "object"
      && error !== null
      && "statusCode" in error
      && error.statusCode === 400
    )
  ) {
    return sendProblem(reply, {
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: "Invalid request.",
      code: "INVALID_REQUEST",
    });
  }

  return sendProblem(reply, {
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
    detail: "Unexpected error.",
    code: "INTERNAL_ERROR",
  });
}
