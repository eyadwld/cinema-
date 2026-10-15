const formatMeta = (meta) => {
  if (!meta || Object.keys(meta).length === 0) {
    return "";
  }

  return ` ${JSON.stringify(meta)}`;
};

const timestamp = () => new Date().toISOString();

export const info = (message, meta = {}) => {
  console.info(`[INFO] ${timestamp()} ${message}${formatMeta(meta)}`);
};

export const warn = (message, meta = {}) => {
  console.warn(`[WARN] ${timestamp()} ${message}${formatMeta(meta)}`);
};

export const error = (message, meta = {}) => {
  console.error(`[ERROR] ${timestamp()} ${message}${formatMeta(meta)}`);
};

export default { info, warn, error };
