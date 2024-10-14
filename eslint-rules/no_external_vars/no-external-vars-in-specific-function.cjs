/**
 * @fileoverview Disallow external variables inside functions annotated with @noExternalVars.
 */
const { ESLintUtils } = require('@typescript-eslint/utils');

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow variables from outer scopes in functions annotated with @noExternalVars or functions using types annotated with @noExternalVars',
      category: 'Best Practices',
      recommended: false,
    },
    schema: [], // no options
  },

  create(context) {
    const parserServices = ESLintUtils.getParserServices(context);
    const typeChecker = parserServices.program.getTypeChecker();
    const sourceCode = context.getSourceCode();

    function checkFunction(node) {
      let shouldCheck = false;

      // Check if the function itself has @noExternalVars annotation
      const jsdoc = sourceCode.getJSDocComment(node);
      if (jsdoc && /@noExternalVars\b/.test(jsdoc.value)) {
        shouldCheck = true;
      }

      // If not, check if the function's contextual type has @noExternalVars annotation
      if (!shouldCheck) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);

        // Get the contextual type of the function expression
        const contextualType = typeChecker.getContextualType(tsNode);

        if (contextualType) {
          const symbol = contextualType.aliasSymbol || contextualType.getSymbol();

          if (symbol) {
            // Get the JSDoc tags associated with the symbol
            const jsDocTags = symbol.getJsDocTags();

            if (jsDocTags.some((tag) => tag.name === 'noExternalVars')) {
              shouldCheck = true;
            }
          }
        }
      }

      if (shouldCheck) {
        // Get the current function scope
        const functionScope = sourceCode.getScope(node);

        // Iterate over all variables used in the function
        functionScope.through.forEach((reference) => {
          const variable = reference.resolved;

          if (!variable) {
            // Variable is not resolved, likely a global variable
            // We can skip reporting this
            return;
          }

          // Check if the variable is declared in an outer scope
          const variableScope = variable.scope;

          // If the variable's scope is outside the function's scope, report it
          if (
            variableScope !== functionScope &&
            variableScope.type !== 'global' // Exclude global scope variables
          ) {
            context.report({
              node: reference.identifier,
              message: `Usage of variable '${reference.identifier.name}' from outer scope is not allowed inside functions annotated with @noExternalVars, it can potentially cause problems at runtime.`,
            });
          }
        });
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
};
