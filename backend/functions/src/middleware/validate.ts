/**
 * Request validation middleware for Cloud Functions
 * Validates incoming request bodies against expected shapes
 */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validates that required fields exist and are non-empty strings
 */
export function validateRequiredFields(
  body: Record<string, unknown>,
  fields: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of fields) {
    if (!body[field] || (typeof body[field] === "string" && (body[field] as string).trim() === "")) {
      errors.push({
        field,
        message: `${field} is required and must not be empty`,
      });
    }
  }

  return errors;
}

/**
 * Validates scan request body
 */
export function validateScanRequest(body: Record<string, unknown>): ValidationError[] {
  return validateRequiredFields(body, ["qrData", "gateId", "guardId", "deviceId"]);
}

/**
 * Validates guard decision request body
 */
export function validateGuardDecision(body: Record<string, unknown>): ValidationError[] {
  const errors = validateRequiredFields(body, ["logId", "decision", "guardId"]);

  if (body.decision && !["ALLOW", "DENY"].includes(body.decision as string)) {
    errors.push({
      field: "decision",
      message: "decision must be either ALLOW or DENY",
    });
  }

  return errors;
}
