// evaluator.js - parsing and evaluation helpers moved out of solver.js
(function(window){
    'use strict';

    // Simple parser to convert expression string into input array format
    window.parseExpressionToInput = function(expr) {
        const parsed = []; let i = 0;
        while (i < expr.length) {
            const valueMatch = expr.substring(i).match(/^(-?\d*\.?\d+(?:[eE][+\-]?\d+)?)(?:±(-?\d*\.?\d+(?:[eE][+\-]?\d+)?))?/);
            if (valueMatch) {
                const normalizedValue = valueMatch[1]; const normalizedUncertainty = valueMatch[2] ? valueMatch[2] : "0";
                parsed.push([0, normalizedValue, normalizedUncertainty, 0]); i += valueMatch[0].length;
            } else if ('+-*/()×÷'.includes(expr[i])) { const ch = expr[i] === '×' ? '*' : expr[i] === '÷' ? '/' : expr[i]; parsed.push(ch); i++; } else { i++; }
        }
        return parsed;
    };

    //min-max evaluation method
    window.evaluateWithExtremes = function(inputOrExpr, debugSteps = []) {
        let arr = inputOrExpr;
        if (typeof inputOrExpr === 'string') arr = window.parseExpressionToInput ? window.parseExpressionToInput(inputOrExpr) : [];
        const valueIndices = [];
        for (let i = 0; i < arr.length; i++) if (Array.isArray(arr[i]) && arr[i].length === 4) valueIndices.push(i);

        function buildExprWithChoices(choices) {
            let expr = '';
            for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                if (Array.isArray(item) && item.length === 4) {
                    const openBr = window.repeatStr ? window.repeatStr('(', item[0]) : '('.repeat(item[0]);
                    const closeBr = window.repeatStr ? window.repeatStr(')', item[3]) : ')'.repeat(item[3]);
                    const value = parseFloat(item[1]); const uncertainty = parseFloat(item[2]) || 0; let chosen;
                    if (choices && choices[i] === 'low') chosen = value - uncertainty; else if (choices && choices[i] === 'high') chosen = value + uncertainty; else chosen = value;
                    expr += openBr + (window.formatDebugNumber ? window.formatDebugNumber(chosen) : String(chosen)) + closeBr;
                } else if (typeof item === 'string') expr += item;
            }
            return expr;
        }

        const chooseHighForMax = {};
        for (const idx of valueIndices) {
            const baseChoices = {}; const highChoices = {}; highChoices[idx] = 'high'; const lowChoices = {}; lowChoices[idx] = 'low';
            const exprHigh = buildExprWithChoices(highChoices); const exprLow = buildExprWithChoices(lowChoices);
            const valHigh = window.evaluateNumericExpression ? window.evaluateNumericExpression(exprHigh) : NaN;
            const valLow = window.evaluateNumericExpression ? window.evaluateNumericExpression(exprLow) : NaN;
            const item = arr[idx]; const nominal = parseFloat(item[1]); const uncertainty = parseFloat(item[2]) || 0; const valueNumber = valueIndices.indexOf(idx) + 1;
            debugSteps.push(`Value ${valueNumber}: nominal = ${window.formatDebugNumber ? window.formatDebugNumber(nominal) : String(nominal)}, uncertainty = ${window.formatDebugNumber ? window.formatDebugNumber(uncertainty) : String(uncertainty)}`);
            if (uncertainty === 0) { debugSteps.push(`  Exact value (uncertainty = 0): no high/low calculation needed`); debugSteps.push(''); chooseHighForMax[idx] = null; continue; }
            debugSteps.push(`  If Value ${valueNumber} = HIGH (${window.formatDebugNumber ? window.formatDebugNumber(nominal + uncertainty) : String(nominal + uncertainty)}), expression: ${exprHigh} → ${window.formatDebugNumber ? window.formatDebugNumber(valHigh) : String(valHigh)}`);
            debugSteps.push(`  If Value ${valueNumber} = LOW  (${window.formatDebugNumber ? window.formatDebugNumber(nominal - uncertainty) : String(nominal - uncertainty)}), expression: ${exprLow} → ${window.formatDebugNumber ? window.formatDebugNumber(valLow) : String(valLow)}`);
            const pickHigh = (valHigh >= valLow); chooseHighForMax[idx] = pickHigh; debugSteps.push(`  Decision: to make the result LARGER, use ${pickHigh ? 'HIGH' : 'LOW'} for Value ${valueNumber}`); debugSteps.push('');
        }

        const maxChoices = {}; const minChoices = {};
        for (const idx of valueIndices) {
            if (chooseHighForMax[idx] === null || chooseHighForMax[idx] === undefined) { maxChoices[idx] = 'nominal'; minChoices[idx] = 'nominal'; }
            else if (chooseHighForMax[idx]) { maxChoices[idx] = 'high'; minChoices[idx] = 'low'; } else { maxChoices[idx] = 'low'; minChoices[idx] = 'high'; }
        }

        const exprMax = buildExprWithChoices(maxChoices); const exprMin = buildExprWithChoices(minChoices);
        debugSteps.push(`Constructed maximum-case expression: ${exprMax}`); debugSteps.push(`Constructed minimum-case expression: ${exprMin}`);
        const evalMax = window.evaluateNumericExpression ? window.evaluateNumericExpression(exprMax) : NaN;
        const evalMin = window.evaluateNumericExpression ? window.evaluateNumericExpression(exprMin) : NaN;
        debugSteps.push(`Evaluated maximum-case value: ${window.formatDebugNumber ? window.formatDebugNumber(evalMax) : String(evalMax)}`);
        debugSteps.push(`Evaluated minimum-case value: ${window.formatDebugNumber ? window.formatDebugNumber(evalMin) : String(evalMin)}`);
        const overallMin = Math.min(evalMin, evalMax); const overallMax = Math.max(evalMin, evalMax);
        return { exprMax, exprMin, evalMax, evalMin, min: overallMin, max: overallMax };
    };

})(window);
