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

    // Define all type declaration node types to exclude
    const typeDeclarationTypes = [
      'TSTypeAliasDeclaration',
      'TSInterfaceDeclaration',
      'TSEnumDeclaration',
      'TSModuleDeclaration',
      'TSDeclareFunction',
      'TSDeclareMethod',
      'TSPropertySignature',
      // Add more as needed
    ];

    // Helper function to determine if a node is a type reference
    function isTypeReference(node) {
      return (
        node.parent.type === 'TSTypeReference' ||
        node.parent.type === 'TSUnionType' ||
        node.parent.type === 'TSIntersectionType' ||
        node.parent.type === 'TSMappedType' ||
        node.parent.type === 'TSIndexedAccessType' ||
        node.parent.type === 'TSTypeOperator' ||
        node.parent.type === 'TSParenthesizedType' ||
        node.parent.type === 'TSTypeLiteral' ||
        node.parent.type === 'TSFunctionType'
        // Add other type node types as needed
      );
    }

    function checkFunction(node) {
      // **Step 1:** Exclude functions that are part of type declarations
      let parent = node.parent;
      while (parent) {
        if (typeDeclarationTypes.includes(parent.type)) {
          // Skip checking this function
          return;
        }
        parent = parent.parent;
      }

      let shouldCheck = false;

      // **Step 2:** Check if the function itself has @noExternalVars annotation
      const jsdoc = sourceCode.getJSDocComment(node);
      if (jsdoc && /@noExternalVars\b/.test(jsdoc.value)) {
        shouldCheck = true;
      }

      // **Step 3:** If not, check if the function's contextual type has @noExternalVars annotation
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
        // **Step 4:** Get the current function scope
        const functionScope = sourceCode.getScope(node);

        // **Step 5:** Iterate over all variables used in the function
        functionScope.through.forEach((reference) => {
          const variable = reference.resolved;

          if (!variable) {
            // Variable is not resolved, likely a global variable
            // We can skip reporting this
            return;
          }

          // **Step 6:** Check if the variable is declared in an outer scope
          const variableScope = variable.scope;

          // **Step 7:** Determine if the reference is a type reference and skip if so
          const identifier = reference.identifier;
          if (isTypeReference(identifier)) {
            // It's a type reference; skip it
            return;
          }

          // **Step 8:** If the variable's scope is outside the function's scope and not global, report it
          if (
            variableScope !== functionScope &&
            variableScope.type !== 'global'
          ) {
            context.report({
              node: reference.identifier,
              message: `Usage of variable '${reference.identifier.name}' from outer scope is not allowed inside functions annotated with @noExternalVars.`,
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
