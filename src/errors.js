export class ProtocolError extends Error {
  constructor(code, message = code) { super(message); this.name = 'ProtocolError'; this.code = code; }
}
export const requireProtocol = (condition, code) => { if (!condition) throw new ProtocolError(code); };
