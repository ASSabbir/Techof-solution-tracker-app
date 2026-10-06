class AppError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST', fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.expose = true;
  }
}
module.exports = AppError;
