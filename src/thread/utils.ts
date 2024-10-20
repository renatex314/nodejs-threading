/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import path from "path";

export type NotAssignableToJson =
| bigint
| symbol
| Function;

type JSONValue = {
  [key: string]: JSONValue;
};

export type JSONCompatible<T> = unknown extends T ? never : {
  [P in keyof T]:
  T[P] extends JSONValue ? T[P] :
    T[P] extends NotAssignableToJson ? never :
      JSONCompatible<T[P]>;
};

export const getCallerDirname = (skipFrames: number = 1): string => {
  const originalPrepareStackTrace = Error.prepareStackTrace;

  try {
    Error.prepareStackTrace = (_: Error, stack: NodeJS.CallSite[]) => stack;
    const err = new Error();
    const stack = err.stack as unknown as NodeJS.CallSite[];

    const targetFrame = 1 + skipFrames;

    if (stack && stack.length > targetFrame) {
      const callerFile = stack[targetFrame].getFileName();
      if (callerFile) {
        return path.dirname(callerFile);
      }
    }

    return __dirname;
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
}

export const isRunningOnTsNode = () => {
  // @ts-expect-error // check if code is not running under ts-node
  return !!process[Symbol.for("ts-node.register.instance")];
}

export const resolveFilenameOnTsNode = (filename: string) => {
  if (!isRunningOnTsNode()) {
    return filename.replace('.ts','.js');
  }
    
  return filename;
}

export type FunctionData = { isAsync: boolean, parameters: Array<string>, body: string };
export const extractFunctionData = (func: Function): FunctionData => {
  let funcStr = func.toString().trim();
  let isAsync = false;

  if (funcStr.startsWith('async')) {
    funcStr = funcStr.slice(5).trim();
    isAsync = true;
  }

  // Initialize parameters and body
  let params = '';
  let body = '';

  // Match regular function declarations
  const funcMatch = funcStr.match(/^function\s*[^(]*\(([^)]*)\)\s*\{([\s\S]*)\}$/);
  if (funcMatch) {
    params = funcMatch[1].trim();
    body = funcMatch[2].trim();
  } else {
    // Match arrow functions
    const arrowFuncMatch = funcStr.match(/^\s*(?:\(([^)]*)\)|([^\s=()]+))\s*=>\s*([\s\S]*)$/);
    if (arrowFuncMatch) {
      // Extract parameters
      params = (arrowFuncMatch[1] || arrowFuncMatch[2] || '').trim();

      const remainder = arrowFuncMatch[3].trim();
      if (remainder.startsWith('{')) {
        // Extract body including nested braces
        body = extractBody(remainder);
      } else {
        // Body is a single expression
        // Prepend 'return ' to the expression and add a semicolon
        body = 'return ' + remainder + ';';
      }
    }
  }

  return {
    isAsync: isAsync,
    parameters: params?.split(',').map(p => p.trim()).filter(p => p.length > 0) || [],
    body: body
  };

  function extractBody(code: string) {
    if (!code.startsWith('{')) return code;
    let braceCount = 0;
    let bodyStart = 0;

    for (let i = 0; i < code.length; i++) {
      if (code[i] === '{') {
        if (braceCount === 0) bodyStart = i + 1;
        braceCount++;
      } else if (code[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          const bodyContent = code.slice(bodyStart, i).trim();
          return bodyContent;
        }
      }
    }
    return code; // In case of unmatched braces
  }
}
