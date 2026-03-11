// Wrapper que carrega o NestJS pré-compilado pelo nest build
// O @vercel/node serve este JS diretamente, sem recompilar os decorators
const mainModule = require('../dist/api/main');
const handler = mainModule.default || mainModule;

module.exports = handler;
module.exports.default = handler;
