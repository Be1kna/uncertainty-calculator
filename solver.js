// solver.js - solver and operation implementations moved out of script.js
(function(window){
    'use strict';

    // Multiplication and Division
    window.multDiv = function(op, value1, uncertainty1, value2, uncertainty2, debugSteps = []) {
        const sigfig1 = window.getSigFigs ? window.getSigFigs(value1, uncertainty1) : 1;
        const sigfig2 = window.getSigFigs ? window.getSigFigs(value2, uncertainty2) : 1;
        const sigfig = Math.min(sigfig1, sigfig2);

        let total;
        let operationSymbol;
        if (op === 'mult') {
            total = parseFloat(value1) * parseFloat(value2);
            operationSymbol = '×';
        } else {
            total = parseFloat(value1) / parseFloat(value2);
            operationSymbol = '÷';
        }

        const relUnc1 = parseFloat(uncertainty1) / Math.abs(parseFloat(value1));
        const relUnc2 = parseFloat(uncertainty2) / Math.abs(parseFloat(value2));
        const totalRel = relUnc1 + relUnc2;
        const uncertainty = Math.abs(total) * totalRel;

        const explanation = [];
        explanation.push(`${value1} ± ${uncertainty1} ${operationSymbol} ${value2} ± ${uncertainty2}`);
        if (op === 'mult') {
            explanation.push(`Value: ${value1} × ${value2} = ${total}`);
        } else {
            explanation.push(`Value: ${value1} ÷ ${value2} = ${total}`);
        }
        explanation.push(`Relative uncertainty: (${uncertainty1}${value1 ? '/' + Math.abs(parseFloat(value1)) : ''}) + (${uncertainty2}${value2 ? '/' + Math.abs(parseFloat(value2)) : ''}) = ${relUnc1.toFixed(4)} + ${relUnc2.toFixed(4)} = ${totalRel.toFixed(4)}`);
        explanation.push(`Absolute uncertainty: |${total}| × ${totalRel.toFixed(4)} = ${uncertainty}`);
        explanation.push(`Result: ${total} ± ${uncertainty}`);

        debugSteps.push(explanation.join('\n'));

        return {
            total: (window.preserveTrailingZeros ? window.preserveTrailingZeros(total) : String(total)),
            uncertainty: (window.preserveTrailingZeros ? window.preserveTrailingZeros(uncertainty) : String(uncertainty)),
            sigfig: sigfig
        };
    };

    // Addition and Subtraction
    window.addSubt = function(op, value1, uncertainty1, value2, uncertainty2, debugSteps = []) {
        const decPlace1 = window.getDecimalPlace ? window.getDecimalPlace(value1, uncertainty1) : 0;
        const decPlace2 = window.getDecimalPlace ? window.getDecimalPlace(value2, uncertainty2) : 0;

        let total;
        let operationSymbol;
        if (op === 'add') {
            total = parseFloat(value1) + parseFloat(value2);
            operationSymbol = '+';
        } else {
            total = parseFloat(value1) - parseFloat(value2);
            operationSymbol = '-';
        }

        const uncertainty = parseFloat(uncertainty1) + parseFloat(uncertainty2);

        let decPlace;
        const unce1 = parseFloat(uncertainty1);
        const unce2 = parseFloat(uncertainty2);

        if (unce1 === 0 && unce2 > 0) {
            decPlace = decPlace2;
        } else if (unce2 === 0 && unce1 > 0) {
            decPlace = decPlace1;
        } else {
            decPlace = Math.min(decPlace1, decPlace2);
        }

        const explanation = [];
        explanation.push(`${value1} ± ${uncertainty1} ${operationSymbol} ${value2} ± ${uncertainty2}`);
        explanation.push(`Value: ${value1} ${operationSymbol} ${value2} = ${total}`);
        explanation.push(`Uncertainty: ${uncertainty1} + ${uncertainty2} = ${uncertainty}`);
        explanation.push(`Result: ${total} ± ${uncertainty}`);

        debugSteps.push(explanation.join('\n'));

        return {
            total: (window.preserveTrailingZeros ? window.preserveTrailingZeros(total) : String(total)),
            uncertainty: (window.preserveTrailingZeros ? window.preserveTrailingZeros(uncertainty) : String(uncertainty)),
            decimalPlace: decPlace
        };
    };

    // Find innermost brackets in expression
    window.findInnermostBrackets = function(expr) {
        let maxDepth = 0;
        let depth = 0;
        let start = -1;
        let end = -1;
        for (let i = 0; i < expr.length; i++) {
            if (expr[i] === '(') {
                depth++;
                if (depth > maxDepth) { maxDepth = depth; start = i; end = i; }
            } else if (expr[i] === ')' && depth === maxDepth && maxDepth > 0) {
                end = i; break;
            } else if (expr[i] === ')') {
                depth--;
            }
        }
        return { start, end, depth: maxDepth };
    };

    // Main solver function
    window.solve = function(expression, input, debugSteps = []) {
        let stepNumber = 1;
        debugSteps.push(`Step ${stepNumber}: Expression: ${expression}`);
        stepNumber++;

        let bracketIter = 0;
        let lastBracketResult = null;

        while (true) {
            bracketIter++;
            if (bracketIter > 50) { debugSteps.push('ERROR: Too many bracket iterations, possible infinite loop'); break; }
            const bracket = window.findInnermostBrackets(expression);
            if (bracket.start === -1) break;
            const insideExpr = expression.substring(bracket.start + 1, bracket.end);
            debugSteps.push(`Step ${stepNumber}: Solving inside brackets: (${insideExpr})`);
            stepNumber++;

            const bracketInput = [];
            let i = 0;
            while (i < insideExpr.length) {
                const valueMatch = insideExpr.substring(i).match(/^([0-9.eE^]+)(?:±([0-9.eE^]+))?/);
                if (valueMatch) {
                    bracketInput.push([0, valueMatch[1], valueMatch[2] ? valueMatch[2] : "0", 0]);
                    i += valueMatch[0].length;
                } else if ('+-*/÷×'.includes(insideExpr[i])) {
                    bracketInput.push(insideExpr[i]); i++;
                } else { i++; }
            }

            const bracketResult = window.solveSimple(bracketInput, debugSteps, stepNumber);
            stepNumber = debugSteps.length + 1;
            lastBracketResult = bracketResult;
            const before = expression.substring(0, bracket.start);
            const after = expression.substring(bracket.end + 1);
            expression = before + `${bracketResult.total}±${bracketResult.uncertainty}` + after;
        }

        if (expression !== (input ? (window.formExpression ? window.formExpression(input) : '') : '')) {
            debugSteps.push(`Step ${stepNumber}: Expression after brackets: ${expression}`);
            stepNumber++;
        }

        const simplifiedInput = [];
        let i = 0;
        while (i < expression.length) {
            const valueMatch = expression.substring(i).match(/^([0-9.eE^]+)(?:±([0-9.eE^]+))?/);
            if (valueMatch) {
                const normalizedValue = valueMatch[1];
                const normalizedUncertainty = valueMatch[2] ? valueMatch[2] : "0";
                simplifiedInput.push([0, normalizedValue, normalizedUncertainty, 0]);
                i += valueMatch[0].length;
            } else if ('+*/-÷×'.includes(expression[i])) { simplifiedInput.push(expression[i]); i++; } else { i++; }
        }

        const result = window.solveSimple(simplifiedInput, debugSteps, stepNumber);
        if (simplifiedInput.length === 1 && lastBracketResult && !result.usedMultDiv && !result.usedAddSub) {
            result.usedMultDiv = lastBracketResult.usedMultDiv;
            result.usedAddSub = lastBracketResult.usedAddSub;
            result.sigfig = lastBracketResult.sigfig;
            result.decimalPlace = lastBracketResult.decimalPlace;
        }
        return result;
    };

    // Simple solver without brackets
    window.solveSimple = function(input, debugSteps = [], startStepNum = 1) {
        const workingInput = JSON.parse(JSON.stringify(input));
        let usedMultDiv = false; let usedAddSub = false; let finalSigfig = null; let finalDecimalPlace = null;
        let stepNum = startStepNum; let operationCount = 0;

        while (true) {
            let found = false;
            for (let i = 0; i < workingInput.length; i++) {
                if (workingInput[i] === '*' || workingInput[i] === '×' || workingInput[i] === '/' || workingInput[i] === '÷') {
                    const left = workingInput[i - 1]; const right = workingInput[i + 1];
                    const op = workingInput[i] === '*' || workingInput[i] === '×' ? 'mult' : 'div';
                    if (Array.isArray(left) && Array.isArray(right)) {
                        operationCount++; debugSteps.push(`Step ${stepNum}: First operation${operationCount > 1 ? ' (continued)' : ''}: ${op === 'mult' ? 'Multiplication' : 'Division'}`);
                        stepNum++;
                        const calc = window.multDiv(op, left[1], left[2], right[1], right[2], debugSteps);
                        usedMultDiv = true; finalSigfig = calc.sigfig;
                        workingInput[i - 1] = [0, calc.total, calc.uncertainty, 0]; workingInput.splice(i, 2); found = true; debugSteps.push(''); break;
                    }
                }
            }
            if (!found) break;
        }

        while (workingInput.length > 1) {
            const left = workingInput[0]; const operator = workingInput[1]; const right = workingInput[2];
            if (Array.isArray(left) && Array.isArray(right)) {
                const op = operator === '+' ? 'add' : 'subt'; operationCount++; debugSteps.push(`Step ${stepNum}: Next operation: ${op === 'add' ? 'Addition' : 'Subtraction'}`); stepNum++;
                const calc = window.addSubt(op, left[1], left[2], right[1], right[2], debugSteps);
                usedAddSub = true; finalDecimalPlace = calc.decimalPlace; workingInput[0] = [0, calc.total, calc.uncertainty, 0]; workingInput.splice(1, 2); debugSteps.push('');
            }
        }

        return {
            total: workingInput[0][1], uncertainty: workingInput[0][2], sigfig: finalSigfig, decimalPlace: finalDecimalPlace, usedMultDiv, usedAddSub
        };
    };

    // parseExpressionToInput and evaluateWithExtremes moved to evaluator.js

})(window);
