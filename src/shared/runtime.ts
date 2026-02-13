import type { ShelfRequest, ShelfResponse } from "@/src/shared/protocol";
import { ShelfProtocolError } from "@/src/shared/protocol";

function isErrorResponse(payload: unknown): payload is { error: { message: string } } {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") {
    return false;
  }

  return typeof (error as { message?: unknown }).message === "string";
}

export async function sendShelfMessage<TResponse extends ShelfResponse>(
  request: ShelfRequest,
): Promise<TResponse> {
  const response = (await browser.runtime.sendMessage(request)) as ShelfResponse | undefined;

  if (!response) {
    throw new ShelfProtocolError("Empty response from extension background");
  }

  if (isErrorResponse(response)) {
    throw new ShelfProtocolError(response.error.message);
  }

  return response as TResponse;
}
