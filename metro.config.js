const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Force all imports of 'assert' to resolve to the root assert@1.5.1
// (expo-notifications ships assert@2.1.0 which uses ./internal/errors that Metro can't resolve)
const rootAssert = path.resolve(__dirname, 'node_modules', 'assert');
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'assert' || moduleName === 'assert/') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(rootAssert, 'assert.js'),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
