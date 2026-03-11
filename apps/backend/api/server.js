// Wrapper que carrega o NestJS pré-compilado pelo nest build
// O @vercel/node serve este JS diretamente, sem recompilar os decorators
let handler;
let loadError;

try {
  const mainModule = require('../dist/api/main');
  handler = mainModule.default || mainModule;
} catch (err) {
  loadError = err;
}

module.exports = function (req, res) {
  if (loadError) {
    return res.status(500).json({
      error: 'Module load failed',
      message: loadError.message,
      code: loadError.code,
      requireStack: loadError.requireStack,
    });
  }
  return handler(req, res);
};
module.exports.default = module.exports;
