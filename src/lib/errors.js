export class ApiError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function isDuplicateKey(error, field) {
  return error?.code === 11000 && (!field || error.keyPattern?.[field]);
}
