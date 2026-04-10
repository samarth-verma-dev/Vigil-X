/**
 * Validation middleware for Vigil-X Cloud Functions.
 * Returns arrays of error strings — empty array means valid.
 */

export function validateScanRequest(body: any): string[] {
  const errors: string[] = [];

  if (!body.qrData || typeof body.qrData !== "string") {
    errors.push("qrData is required and must be a string");
  }
  if (!body.gateId || typeof body.gateId !== "string") {
    errors.push("gateId is required and must be a string");
  }
  if (!body.guardId || typeof body.guardId !== "string") {
    errors.push("guardId is required and must be a string");
  }
  if (!body.deviceId || typeof body.deviceId !== "string") {
    errors.push("deviceId is required and must be a string");
  }

  return errors;
}

export function validateGuardDecision(body: any): string[] {
  const errors: string[] = [];

  if (!body.logId || typeof body.logId !== "string") {
    errors.push("logId is required and must be a string");
  }
  if (!body.decision || !["ALLOW", "DENY"].includes(body.decision)) {
    errors.push("decision is required and must be 'ALLOW' or 'DENY'");
  }
  if (!body.guardId || typeof body.guardId !== "string") {
    errors.push("guardId is required and must be a string");
  }

  return errors;
}
