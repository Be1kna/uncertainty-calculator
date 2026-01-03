// Core calculator module exposing two core calculation functions.
// These are thin, pure-ish functions that call the solver/evaluator
// and return structured results for the UI adapters to format and render.

(function(){
    'use strict';

    function safeCall(fn, ...args) { return (typeof fn === 'function') ? fn(...args) : undefined; }

    function roundResult(value, uncertainty, sigfigsOrDecPlace, isDecimalPlace) {
        // Use helpers on window when available
        const getDecimalPlace = window.getDecimalPlace;
        const getSigFigs = window.getSigFigs;
        const formatDebugNumber = window.formatDebugNumber;

        if (isDecimalPlace) {
            const roundedValue = Math.round(parseFloat(value) * Math.pow(10, sigfigsOrDecPlace)) / Math.pow(10, sigfigsOrDecPlace);
            const roundedUnc = Math.round(parseFloat(uncertainty) * Math.pow(10, sigfigsOrDecPlace)) / Math.pow(10, sigfigsOrDecPlace);
            if (sigfigsOrDecPlace < 0) {
                return { value: Math.round(roundedValue).toString(), uncertainty: Math.round(roundedUnc).toString() };
            } else {
                return { value: roundedValue.toFixed(sigfigsOrDecPlace), uncertainty: roundedUnc.toFixed(sigfigsOrDecPlace) };
            }
        } else {
            const sigfig = sigfigsOrDecPlace;
            let roundedValue;
            if (sigfig >= 999) {
                roundedValue = parseFloat(value);
            } else {
                roundedValue = parseFloat(parseFloat(value).toPrecision(sigfig));
            }
            const roundedUnc = parseFloat(uncertainty);
            let formattedValue;
            if (sigfig >= 999) {
                const decPlace = getDecimalPlace ? getDecimalPlace(uncertainty.toString(), uncertainty.toString()) : 0;
                if (decPlace < 0) formattedValue = Math.round(roundedValue).toString();
                else formattedValue = parseFloat(roundedValue.toFixed(decPlace)).toFixed(decPlace);
            } else {
                formattedValue = parseFloat(value).toPrecision(sigfig);
            }
            const uncDecPlace = getDecimalPlace ? getDecimalPlace(uncertainty.toString(), uncertainty.toString()) : 0;
            let formattedUnc;
            if (uncDecPlace < 0) formattedUnc = Math.round(roundedUnc).toString();
            else formattedUnc = roundedUnc.toFixed(uncDecPlace);
            if (uncDecPlace >= 0) {
                const numericVal = Number(value);
                if (isFinite(numericVal)) formattedValue = numericVal.toFixed(uncDecPlace);
            }
            if (String(formattedValue).toLowerCase().includes('e')) {
                const numericVal = Number(roundedValue);
                if (isFinite(numericVal) && Math.abs(numericVal) < 1000) {
                    if (uncDecPlace < 0) formattedValue = Math.round(numericVal).toString();
                    else formattedValue = parseFloat(numericVal.toFixed(uncDecPlace)).toFixed(uncDecPlace);
                }
            }
            return { value: formattedValue, uncertainty: formattedUnc };
        }
    }

    function determinePrecision(silentResult, override, inputArray) {
        // Derive sigfig/decimal-place suggestions from provided inputArray when available
        const getSigFigs = window.getSigFigs;
        const getDecimalPlace = window.getDecimalPlace;
        let useDecimalPlace = false; let precision = 0; let precisionType = '';
        const sigs = (inputArray && inputArray.length) ? inputArray.filter(i=>Array.isArray(i)).map(p=>{ try{return getSigFigs ? getSigFigs(p[1], p[2]) : 1;}catch(e){return 1;} }) : [];
        const decs = (inputArray && inputArray.length) ? inputArray.filter(i=>Array.isArray(i)).map(p=>{ try{return getDecimalPlace ? getDecimalPlace(p[1], p[2]) : 0;}catch(e){return 0;} }) : [];

        if (silentResult && silentResult.usedMultDiv && !silentResult.usedAddSub) {
            useDecimalPlace = false; precision = silentResult.sigfig || (sigs.length ? Math.min(...sigs) : 1); precisionType = 'significant figures';
        } else if (silentResult && silentResult.usedAddSub && !silentResult.usedMultDiv) {
            useDecimalPlace = true; precision = silentResult.decimalPlace || (decs.length ? Math.min(...decs) : 0); precisionType = precision < 0 ? `the ${['ones','tens','hundreds','thousands'][Math.abs(precision)]} place` : `${precision} decimal place${precision!==1?'s':''}`;
        } else if (silentResult && silentResult.usedMultDiv && silentResult.usedAddSub) {
            useDecimalPlace = false; precision = silentResult.sigfig || (sigs.length ? Math.min(...sigs) : 1); precisionType = 'significant figures';
        } else {
            useDecimalPlace = false; precision = sigs.length ? Math.min(...sigs) : 1; precisionType = 'significant figures';
        }

        if (override && override.override) {
            useDecimalPlace = override.useDecimalPlace; precision = override.precision; precisionType = override.precisionType;
        }
        return { useDecimalPlace, precision, precisionType };
    }

    function roundRangeValues(extremes, precision, useDecimalPlace) {
        const pseudoUncertainty = Math.abs(extremes.max - extremes.min) / 2;
        const formattedMax = roundResult(extremes.max, pseudoUncertainty, precision, useDecimalPlace);
        const formattedMin = roundResult(extremes.min, pseudoUncertainty, precision, useDecimalPlace);
        const midpoint = (parseFloat(extremes.min) + parseFloat(extremes.max)) / 2;
        const formattedMid = roundResult(midpoint, pseudoUncertainty, precision, useDecimalPlace);
        return { formattedMax, formattedMin, formattedMid, pseudoUncertainty, midpoint };
    }

    function buildRoundingReason(silentResult) {
        if (silentResult && silentResult.usedMultDiv && silentResult.usedAddSub) return 'Mixed operations: multiplication/division takes precedence → use significant figures.';
        else if (silentResult && silentResult.usedMultDiv) return 'Multiplication/Division detected → use significant figures.';
        else if (silentResult && silentResult.usedAddSub) return 'Addition/Subtraction detected → use decimal places.';
        return 'Default: use significant figures.';
    }

    function buildActualExplanation(expression, evalDebug, extremes, formattedMax, formattedMin, formattedMid, roundingReason) {
        const steps = [];
        let step = 1;
        steps.push(`Step ${step}: Expression:`);
        steps.push(`   ${expression}`);
        step++;
        steps.push('');
        steps.push(`Step ${step}: Find Input Ranges of Values and their impact in expression`);
        step++;
        for (let i = 0; i < evalDebug.length; i++) {
            const line = evalDebug[i];
            if (line.startsWith('Value ')) {
                const block = []; let j = i;
                while (j < evalDebug.length && evalDebug[j].trim() !== '') { block.push(evalDebug[j]); j++; }
                const m = block[0].match(/Value \d+: nominal = ([^,]+), uncertainty = (.+)/);
                if (m) {
                    const nominal = parseFloat(m[1]); const unc = parseFloat(m[2]) || 0;
                    steps.push(`Value = ${window.formatDebugNumber(nominal)}`);
                    steps.push(`Uncertainty = ${window.formatDebugNumber(unc)}`);
                    steps.push(`HIGH = ${window.formatDebugNumber(nominal + unc)}`);
                    const decisionLine = block.find(l => l.trim().startsWith('Decision:')) || '';
                    const pickHigh = decisionLine.includes('HIGH');
                    steps.push(`Impact on expression: makes it ${pickHigh ? 'larger' : 'smaller'}`);
                    steps.push(`LOW = ${window.formatDebugNumber(nominal - unc)}`);
                    steps.push(`Impact on expression: makes it ${pickHigh ? 'smaller' : 'larger'}`);
                    steps.push('');
                }
                i = j;
            }
        }
        steps.push('');
        steps.push(`Step ${step}: Min-Max Expressions`); step++;
        steps.push(`Minimum-case expression: ${extremes.exprMin}`);
        steps.push(`Maximum-case expression: ${extremes.exprMax}`);
        steps.push(`Minimum-case value: ${window.formatDebugNumber(extremes.evalMin)}`);
        steps.push(`Maximum-case value: ${window.formatDebugNumber(extremes.evalMax)}`);
        steps.push('');
        steps.push(`Step ${step}: Rounding`); step++;
        steps.push(`   ${roundingReason}`);
        steps.push(`   Range before rounding: ${window.formatDebugNumber(extremes.min)} to ${window.formatDebugNumber(extremes.max)}`);
        steps.push(`   Range after rounding: ${formattedMin.value} to ${formattedMax.value}`);
        steps.push('');
        steps.push(`Step ${step}: Uncertainty`);
        steps.push(`   Middle of range: (${window.formatDebugNumber(extremes.min)}+${window.formatDebugNumber(extremes.max)})/2 = ${window.formatDebugNumber((parseFloat(extremes.min)+parseFloat(extremes.max))/2)}`);
        steps.push(`   Uncertainty: ${window.formatDebugNumber((parseFloat(extremes.min)+parseFloat(extremes.max))/2)} - ${window.formatDebugNumber(extremes.min)} = ${window.formatDebugNumber(Math.abs((parseFloat(extremes.min)+parseFloat(extremes.max))/2 - extremes.min))}`);
        steps.push(`   Rounded: ${formattedMid.value} ± ${formattedMid.uncertainty}`);
        return steps;
    }

    function buildPropagationExplanation(expression, rawSteps, result, finalResult, precision, precisionType) {
        const steps = [];
        let stepNum = 1;
        steps.push(`Step ${stepNum}: Expression:`);
        steps.push(`   ${expression}`);
        stepNum++;
        const usedIdx = new Set();
        const opRe = /(?:Next|First)\s*operation\s*[:\-]?\s*(Addition|Subtraction|Multiplication|Division)/i;
        for (let bi = 0; bi < rawSteps.length; bi++) {
            if (usedIdx.has(bi)) continue;
            const block = rawSteps[bi];
            const rawLines = block.split('\n').map(l => l.trim());
            let opName = null;
            for (const rl of rawLines) { const m = rl.match(opRe); if (m) { opName = m[1]; break; } }
            if (!opName && bi > 0) {
                const prevLines = rawSteps[bi-1].split('\n').map(l=>l.trim());
                for (const rl of prevLines) { const m = rl.match(opRe); if (m) { opName = m[1]; usedIdx.add(bi-1); break; } }
            }
            if (!opName && bi+1 < rawSteps.length) {
                const nextLines = rawSteps[bi+1].split('\n').map(l=>l.trim());
                for (const rl of nextLines) { const m = rl.match(opRe); if (m) { opName = m[1]; usedIdx.add(bi+1); break; } }
            }
            let bodyLines = rawLines.filter(l=>l && !/^Step \d+:/.test(l) && !/^(?:Next|First)\s*operation/i.test(l));
            if (bodyLines.length === 0 && bi+1 < rawSteps.length && !usedIdx.has(bi+1)) {
                const nextRawLines = rawSteps[bi+1].split('\n').map(l=>l.trim());
                const candidate = nextRawLines.filter(l=>l && !/^Step \d+:/.test(l) && !/^(?:Next|First)\s*operation/i.test(l));
                if (candidate.length) { bodyLines = candidate; usedIdx.add(bi+1); }
            }
            if (bodyLines.length === 0) continue;
            steps.push('');
            if (opName) { steps.push(`Step ${stepNum}: ${opName}`); for (let i=0;i<bodyLines.length;i++) steps.push(`   ${bodyLines[i]}`); }
            else { steps.push(`Step ${stepNum}: ${bodyLines[0]}`); for (let i=1;i<bodyLines.length;i++) steps.push(`   ${bodyLines[i]}`); }
            stepNum++;
        }
        steps.push('');
        steps.push(`Step ${stepNum}: Rounding`);
        steps.push(`   Rounding rule: ${result.usedMultDiv && result.usedAddSub ? 'Mixed operations: multiplication/division takes precedence → use significant figures.' : result.usedMultDiv ? 'Multiplication/Division detected → use significant figures.' : result.usedAddSub ? 'Addition/Subtraction detected → use decimal places.' : 'Default: use significant figures.'} Chosen precision: ${precision} (${precisionType}).`);
        steps.push(`   Before rounding: ${window.formatDebugNumber(result.total)} ± ${window.formatDebugNumber(result.uncertainty)}`);
        steps.push(`   After rounding: ${finalResult.value} ± ${finalResult.uncertainty}`);
        stepNum++;
        steps.push('');
        steps.push(`Step ${stepNum}: Final Result`);
        steps.push(`   ${finalResult.value} ± ${finalResult.uncertainty}`);
        return steps;
    }

    function calculateActualValues(expression, options = {}) {
        const input = options.input && options.input.length ? options.input : (typeof window.parseExpressionToInput === 'function' ? window.parseExpressionToInput(expression) : []);
        // Build per-value debug lines here so explanations include Input Ranges (Step 2)
        const evalDebug = [];
        try {
            const arr = input.length ? input : (typeof window.parseExpressionToInput === 'function' ? window.parseExpressionToInput(expression) : []);
            const valueIndices = [];
            for (let i = 0; i < arr.length; i++) if (Array.isArray(arr[i]) && arr[i].length === 4) valueIndices.push(i);
            function buildExprWithChoices(choices) {
                let expr = '';
                for (let i = 0; i < arr.length; i++) {
                    const item = arr[i];
                    if (Array.isArray(item) && item.length === 4) {
                        const openBr = window.repeatStr ? window.repeatStr('(', item[0]) : '('.repeat(item[0]);
                        const closeBr = window.repeatStr ? window.repeatStr(')', item[3]) : ')'.repeat(item[3]);
                        const value = parseFloat(item[1]); const uncertainty = parseFloat(item[2]) || 0;
                        let chosen = value;
                        if (choices && choices[i] === 'low') chosen = value - uncertainty;
                        else if (choices && choices[i] === 'high') chosen = value + uncertainty;
                        expr += openBr + (window.formatDebugNumber ? window.formatDebugNumber(chosen) : String(chosen)) + closeBr;
                    } else if (typeof item === 'string') expr += item;
                }
                return expr;
            }
            for (let vi = 0; vi < valueIndices.length; vi++) {
                const idx = valueIndices[vi];
                const item = arr[idx];
                const nominal = parseFloat(item[1]);
                const uncertainty = parseFloat(item[2]) || 0;
                evalDebug.push(`Value ${vi+1}: nominal = ${nominal}, uncertainty = ${uncertainty}`);
                if (uncertainty === 0) {
                    evalDebug.push(`Decision: no uncertainty (nominal only)`);
                    evalDebug.push('');
                    continue;
                }
                const exprHigh = buildExprWithChoices(Object.assign({}, {[idx]: 'high'}));
                const exprLow = buildExprWithChoices(Object.assign({}, {[idx]: 'low'}));
                const valHigh = window.evaluateNumericExpression ? window.evaluateNumericExpression(exprHigh) : NaN;
                const valLow = window.evaluateNumericExpression ? window.evaluateNumericExpression(exprLow) : NaN;
                evalDebug.push(`Expr HIGH: ${exprHigh} = ${valHigh}`);
                evalDebug.push(`Expr LOW: ${exprLow} = ${valLow}`);
                const pickHigh = (valHigh >= valLow);
                evalDebug.push(`Decision: ${pickHigh ? 'HIGH' : 'LOW'} yields the ${pickHigh ? 'larger' : 'smaller'} expression`);
                evalDebug.push('');
            }
        } catch (e) {
            // fall back to empty debug
        }
        const extremes = safeCall(window.evaluateWithExtremes, input.length ? input : expression, evalDebug) || { min:0, max:0, exprMin:'', exprMax:'', evalMin:0, evalMax:0 };
        const silentResult = safeCall(window.solve, expression, input, []) || { usedMultDiv:false, usedAddSub:false };
        const override = options.override || { override: false };
        const { useDecimalPlace, precision, precisionType } = determinePrecision(silentResult, override, input);
        const rr = roundRangeValues(extremes, precision, useDecimalPlace);
        const roundingReason = buildRoundingReason(silentResult);
        const explanationSteps = buildActualExplanation(expression, evalDebug, extremes, rr.formattedMax, rr.formattedMin, rr.formattedMid, roundingReason);
        return {
            expression,
            input,
            silentResult,
            evalDebug,
            extremes,
            formattedMax: rr.formattedMax,
            formattedMin: rr.formattedMin,
            formattedMid: rr.formattedMid,
            pseudoUncertainty: rr.pseudoUncertainty,
            midpoint: rr.midpoint,
            roundingReason,
            explanationSteps
        };
    }

    function calculatePropagation(expression, options = {}) {
        const input = options.input && options.input.length ? options.input : (typeof window.parseExpressionToInput === 'function' ? window.parseExpressionToInput(expression) : []);
        const rawSteps = [];
        const result = safeCall(window.solve, expression, input, rawSteps) || { total: expression, uncertainty: '0', usedMultDiv:false, usedAddSub:false };
        const override = options.override || { override: false };
        const { useDecimalPlace, precision, precisionType } = determinePrecision(result, override, input);
        let finalResult = roundResult(result.total, result.uncertainty, precision, useDecimalPlace);
        if (!useDecimalPlace) {
            try {
                const uncSig = window.getSigFigs ? window.getSigFigs(finalResult.uncertainty, finalResult.uncertainty) : 0;
                if (uncSig > 0 && uncSig > precision) {
                    const newPrecision = Math.max(precision, uncSig);
                    finalResult = roundResult(result.total, result.uncertainty, newPrecision, useDecimalPlace);
                }
            } catch (e) {}
        }
        const roundingReason = buildRoundingReason(result);
        const explanationSteps = buildPropagationExplanation(expression, rawSteps, result, finalResult, precision, precisionType);
        // compute display range from finalResult
        let displayMin = null, displayMax = null, extremesForDisplay = null;
        try {
            extremesForDisplay = safeCall(window.evaluateWithExtremes, input.length ? input : expression, []);
            const numericFinalValue = Number(finalResult.value);
            const numericFinalUnc = Number(finalResult.uncertainty);
            displayMin = numericFinalValue - numericFinalUnc;
            displayMax = numericFinalValue + numericFinalUnc;
        } catch (e) {}
        return { expression, input, result, rawSteps, finalResult, precision, precisionType, roundingReason, explanationSteps, displayMin, displayMax, extremesForDisplay };
    }

    window.calculateActualValues = calculateActualValues;
    window.calculatePropagation = calculatePropagation;
})();
