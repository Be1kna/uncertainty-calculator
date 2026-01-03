// Global state
let newValues = 0;
let input = []; // Structure: [[openBrackets, value, uncertainty, closeBrackets], [operator, value, uncertainty, openBrackets], ...]

// Helper: repeat string n times (delegated to helpers.js)
const repeatStr = function(str, n) {
    return window.repeatStr ? window.repeatStr(str, n) : (n > 0 ? str.repeat(n) : '');
};

// Keep trailing zeros by converting to string (delegated to helpers.js)
const preserveTrailingZeros = function(num) {
    return window.preserveTrailingZeros ? window.preserveTrailingZeros(num) : num.toString();
};

// Get significant figures from number string (preserve trailing zeros)
// Now considers uncertainty to determine significant figures
// Get significant figures (delegated to helpers.js)
const getSigFigs = function(numStr, uncertaintyStr = null) {
    return window.getSigFigs ? window.getSigFigs(numStr, uncertaintyStr) : (function(){
        const str = numStr.toString();
        let count = 0; let hasDecimal = str.includes('.'); let foundNonZero=false; let pastDecimal=false;
        for (let char of str) {
            if (char === '-'||char==='+') continue;
            if (char === '.') { pastDecimal = true; continue; }
            if (char !== '0') { foundNonZero = true; count++; }
            else if (foundNonZero || (hasDecimal && pastDecimal)) count++;
        }
        return count || 1;
    })();
};

// Get decimal place from number string based on uncertainty
// For decimals: returns positive number (0.123 -> 3)
// For integers: returns negative number (9000 -> -3 meaning thousands place)
// Now considers uncertainty to determine accuracy
// Get decimal place (delegated to helpers.js)
const getDecimalPlace = function(numStr, uncertaintyStr = null) {
    return window.getDecimalPlace ? window.getDecimalPlace(numStr, uncertaintyStr) : (function(){
        const str = numStr.toString();
        if (str.includes('.')) return str.split('.')[1].length;
        const trimmed = str.replace(/[^0-9]/g,''); if (!trimmed) return 0; let tz=0; for (let i=trimmed.length-1;i>=0;i--){ if (trimmed[i]==='0') tz++; else break;} return tz>0?-tz:0;
    })();
};

// multDiv operation (delegates to solver)
const multDiv = function(op, value1, uncertainty1, value2, uncertainty2, debugSteps = []) {
    if (window.multDiv && window.multDiv !== multDiv) return window.multDiv(op, value1, uncertainty1, value2, uncertainty2, debugSteps);
    // fallback (shouldn't happen) - simple implementation
    const total = parseFloat(value1) * (op === 'mult' ? parseFloat(value2) : 1/parseFloat(value2));
    const uncertainty = 0;
    return { total: String(total), uncertainty: String(uncertainty), sigfig: 1 };
};

// addSubt operation (delegates to solver)
const addSubt = function(op, value1, uncertainty1, value2, uncertainty2, debugSteps = []) {
    if (window.addSubt && window.addSubt !== addSubt) return window.addSubt(op, value1, uncertainty1, value2, uncertainty2, debugSteps);
    const total = parseFloat(value1) + (op === 'add' ? parseFloat(value2) : -parseFloat(value2));
    const uncertainty = 0;
    return { total: String(total), uncertainty: String(uncertainty), decimalPlace: 0 };
};

// Form expression from input
function formExpression(input) {
    let expression = '';
    
    for (let i = 0; i < input.length; i++) {
        const inp = input[i];
        
        // Handle value entries [openBrackets, value, uncertainty, closeBrackets]
        if (Array.isArray(inp) && inp.length === 4) {
            const openBrackets = inp[0];
            const value = inp[1];
            const uncertainty = inp[2];
            const closeBrackets = inp[3];
            
            const openBr = repeatStr('(', openBrackets);
            const closeBr = repeatStr(')', closeBrackets);
            
            expression += `${openBr}${value}±${uncertainty}${closeBr}`;
        }
        // Handle operator entries [operator, value, uncertainty, openBrackets]
        else if (Array.isArray(inp) && inp.length === 4 && typeof inp[0] === 'string') {
            const operator = inp[0];
            const value = inp[1];
            const uncertainty = inp[2];
            const openBrackets = inp[3];
            
            const openBr = repeatStr('(', openBrackets);
            
            expression += `${operator}${openBr}${value}±${uncertainty}`;
        }
        else if (typeof inp === 'string') {
            expression += inp;
        }
    }
    
    return expression;
}

// Find innermost brackets (delegates to solver)
const findInnermostBrackets = function(expr) {
    if (window.findInnermostBrackets && window.findInnermostBrackets !== findInnermostBrackets) return window.findInnermostBrackets(expr);
    // fallback
    let maxDepth = 0; let depth = 0; let start = -1; let end = -1;
    for (let i = 0; i < expr.length; i++) {
        if (expr[i] === '(') { depth++; if (depth > maxDepth) { maxDepth = depth; start = i; end = i; } }
        else if (expr[i] === ')' && depth === maxDepth && maxDepth > 0) { end = i; break; }
        else if (expr[i] === ')') depth--;
    }
    return { start, end, depth: maxDepth };
};

// Solve expression with bracket support (delegates to solver)
const solve = function(expression, input, debugSteps = []) {
    if (window.solve && window.solve !== solve) return window.solve(expression, input, debugSteps);
    // fallback: return a simple empty result
    return { total: expression, uncertainty: '0', usedMultDiv: false, usedAddSub: false };
};

// Solve expression without brackets (simple) - delegates to solver
const solveSimple = function(input, debugSteps = [], startStepNum = 1) {
    if (window.solveSimple && window.solveSimple !== solveSimple) return window.solveSimple(input, debugSteps, startStepNum);
    return { total: input.length ? String(input[0]) : '0', uncertainty: '0', sigfig: null, decimalPlace: null, usedMultDiv: false, usedAddSub: false };
};

// Round result based on sigfigs or decimal place
function roundResult(value, uncertainty, sigfigsOrDecPlace, isDecimalPlace) {
    if (isDecimalPlace) {
        const roundedValue = Math.round(parseFloat(value) * Math.pow(10, sigfigsOrDecPlace)) / Math.pow(10, sigfigsOrDecPlace);
        const roundedUnc = Math.round(parseFloat(uncertainty) * Math.pow(10, sigfigsOrDecPlace)) / Math.pow(10, sigfigsOrDecPlace);
        
        // Handle negative decimal places (integers)
        if (sigfigsOrDecPlace < 0) {
            return {
                value: Math.round(roundedValue).toString(),
                uncertainty: Math.round(roundedUnc).toString()
            };
        } else {
            return {
                value: roundedValue.toFixed(sigfigsOrDecPlace),
                uncertainty: roundedUnc.toFixed(sigfigsOrDecPlace)
            };
        }
    } else {
        const sigfig = sigfigsOrDecPlace;
        
        // Handle exact values (infinite sigfigs represented as 999)
        let roundedValue;
        if (sigfig >= 999) {
            // Exact value - don't round, just use uncertainty's precision
            roundedValue = parseFloat(value);
        } else {
            roundedValue = parseFloat(parseFloat(value).toPrecision(sigfig));
        }
        
        // For significant figures, format the value using toPrecision (preserves trailing zeros)
        const roundedUnc = parseFloat(uncertainty);
        
        // Format the value with proper sigfigs
        let formattedValue;
        if (sigfig >= 999) {
            // Exact values - just return as-is, rounded to uncertainty precision
            const decPlace = getDecimalPlace(uncertainty.toString(), uncertainty.toString());
            if (decPlace < 0) {
                formattedValue = Math.round(roundedValue).toString();
            } else {
                formattedValue = parseFloat(roundedValue.toFixed(decPlace)).toFixed(decPlace);
            }
        } else {
            // Non-exact: format with toPrecision which handles sigfigs correctly
            formattedValue = parseFloat(value).toPrecision(sigfig);
        }
        
        // Format uncertainty based on its decimal places
        const uncDecPlace = getDecimalPlace(uncertainty.toString(), uncertainty.toString());
        let formattedUnc;

        if (uncDecPlace < 0) {
            formattedUnc = Math.round(roundedUnc).toString();
        } else {
            formattedUnc = roundedUnc.toFixed(uncDecPlace);
        }

        // If the uncertainty suggests a decimal-place precision (e.g., ones, tenths), prefer
        // formatting the main value to match that decimal place rather than forcing sigfig formatting
        // which can produce unintuitive exponential rounding for small magnitudes.
        if (uncDecPlace >= 0) {
            if (uncDecPlace < 0) {
                // handled above, but keep branch for completeness
            } else {
                // Round the numeric value to the same decimal place as the uncertainty
                const numericVal = Number(value);
                if (isFinite(numericVal)) {
                    formattedValue = numericVal.toFixed(uncDecPlace);
                }
            }
        }

        // If formattedValue ended up in exponential notation but the numeric magnitude is small,
        // prefer a non-exponential display for readability (e.g., show "50" instead of "5e+1").
        if (String(formattedValue).toLowerCase().includes('e')) {
            const numericVal = Number(roundedValue);
            if (isFinite(numericVal) && Math.abs(numericVal) < 1000) {
                if (uncDecPlace < 0) {
                    // Keep the original numeric magnitude displayed as an integer
                    const orig = Number(value);
                    if (isFinite(orig)) {
                        formattedValue = Math.round(orig).toString();
                    } else {
                        formattedValue = Math.round(numericVal).toString();
                    }
                } else {
                    formattedValue = parseFloat(numericVal.toFixed(uncDecPlace)).toFixed(uncDecPlace);
                }
            }
        }

        return {
            value: formattedValue,
            uncertainty: formattedUnc
        };
    }
}

// Evaluate a numeric expression string safely (supports × and ÷)
const evaluateNumericExpression = function(expr) {
    if (window.evaluateNumericExpression && window.evaluateNumericExpression !== evaluateNumericExpression) return window.evaluateNumericExpression(expr);
    try {
        const safeExpr = expr.replace(/×/g, '*').replace(/÷/g, '/');
        // Use Function constructor to evaluate numeric expression
        // Wrap in Number() to coerce results
        // eslint-disable-next-line no-new-func
        const fn = new Function('return (' + safeExpr + ')');
        return Number(fn());
    } catch (e) {
        return NaN;
    }
};

// Format numbers for debug output to avoid long floating-point artifacts
const formatDebugNumber = function(n) {
    if (window.formatDebugNumber && window.formatDebugNumber !== formatDebugNumber) return window.formatDebugNumber(n);
    const num = Number(n);
    if (!isFinite(num)) return String(n);
    try {
        const p = parseFloat(num.toPrecision(12));
        return String(p);
    } catch (e) { return String(num); }
};

// Read rounding override selection from the UI. Returns {override, useDecimalPlace, precision, precisionType}
function getRoundingOverride() {
    try {
        const sel = document.getElementById('roundModeSelect');
        if (!sel) return { override: false };
        const mode = sel.value;
        const customInput = document.getElementById('roundCustomInput');
        const n = customInput && customInput.value ? parseInt(customInput.value) : null;
        if (mode === 'sigfig' && n !== null && !isNaN(n)) {
            return { override: true, useDecimalPlace: false, precision: n, precisionType: `${n} significant figure${n !== 1 ? 's' : ''}` };
        } else if (mode === 'decimals' && n !== null && !isNaN(n)) {
            return { override: true, useDecimalPlace: true, precision: n, precisionType: `${n} decimal place${n !== 1 ? 's' : ''}` };
        }
    } catch (e) {
        // ignore
    }
    return { override: false };
}

// Build two numeric expressions from input: one using value+unc, one using value-unc
// and evaluate both to produce min/max (Max-Min method using extremes)
// Parse an expression string like "4.5±0.3+2±0.1" into the internal input array format
function parseExpressionToInput(expr) {
    const parsed = [];
    let i = 0;
    while (i < expr.length) {
        // Match a number (optional sign), optional decimal, optional exponent (e/E), then optional ± uncertainty
        const valueMatch = expr.substring(i).match(/^(-?\d*\.?\d+(?:[eE][+\-]?\d+)?)(?:±(-?\d*\.?\d+(?:[eE][+\-]?\d+)?))?/);
        if (valueMatch) {
            const normalizedValue = valueMatch[1];
            const normalizedUncertainty = valueMatch[2] ? valueMatch[2] : "0";
            parsed.push([0, normalizedValue, normalizedUncertainty, 0]);
            i += valueMatch[0].length;
        } else if ('+-*/()×÷'.includes(expr[i])) {
            // Normalize ×/÷ to * and /
            const ch = expr[i] === '×' ? '*' : expr[i] === '÷' ? '/' : expr[i];
            parsed.push(ch);
            i++;
        } else {
            i++;
        }
    }
    return parsed;
}

// Improved evaluateWithExtremes: chooses per-variable high/low depending on whether increasing that variable
// increases the overall expression value. Accepts either an input array or a formatted expression string.
function evaluateWithExtremes(inputOrExpr, debugSteps = []) {
    // Convert input string to array if necessary
    let arr = inputOrExpr;
    if (typeof inputOrExpr === 'string') {
        arr = parseExpressionToInput(inputOrExpr);
    }

    // Collect indices of value entries
    const valueIndices = [];
    for (let i = 0; i < arr.length; i++) {
        if (Array.isArray(arr[i]) && arr[i].length === 4) valueIndices.push(i);
    }

    // Helper to build expression string given a map of choices {idx: 'high'|'low'}
    function buildExprWithChoices(choices) {
        let expr = '';
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
                if (Array.isArray(item) && item.length === 4) {
                    const openBr = repeatStr('(', item[0]);
                    const closeBr = repeatStr(')', item[3]);
                    const value = parseFloat(item[1]);
                    const uncertainty = parseFloat(item[2]) || 0;
                    let chosen;
                    if (choices && choices[i] === 'low') {
                        chosen = value - uncertainty;
                    } else if (choices && choices[i] === 'high') {
                        chosen = value + uncertainty;
                    } else {
                        chosen = value; // nominal
                    }
                    // Use formatted number for readability and to avoid FP artifacts
                    expr += openBr + formatDebugNumber(chosen) + closeBr;
            } else if (typeof item === 'string') {
                expr += item;
            }
        }
        return expr;
    }

    // Determine directional effect for each variable by perturbing it alone
    const chooseHighForMax = {};
    for (const idx of valueIndices) {
        // baseline: all nominal values
        const baseChoices = {};
        // expr when this var is high
        const highChoices = {};
        highChoices[idx] = 'high';
        // expr when this var is low
        const lowChoices = {};
        lowChoices[idx] = 'low';

        const exprHigh = buildExprWithChoices(highChoices);
        const exprLow = buildExprWithChoices(lowChoices);

        const valHigh = evaluateNumericExpression(exprHigh);
        const valLow = evaluateNumericExpression(exprLow);

        // Provide expanded debug: show nominal/high/low for this value and the evaluated results
        const item = arr[idx];
        const nominal = parseFloat(item[1]);
        const uncertainty = parseFloat(item[2]) || 0;
        const valueNumber = valueIndices.indexOf(idx) + 1; // 1-based numbering for readability
        debugSteps.push(`Value ${valueNumber}: nominal = ${formatDebugNumber(nominal)}, uncertainty = ${formatDebugNumber(uncertainty)}`);
        // If uncertainty is zero, skip perturbation calculations (no high/low)
        if (uncertainty === 0) {
            debugSteps.push(`  Exact value (uncertainty = 0): no high/low calculation needed`);
            debugSteps.push('');
            chooseHighForMax[idx] = null; // mark as exact
            continue;
        }

        debugSteps.push(`  If Value ${valueNumber} = HIGH (${formatDebugNumber(nominal + uncertainty)}), expression: ${exprHigh} → ${formatDebugNumber(valHigh)}`);
        debugSteps.push(`  If Value ${valueNumber} = LOW  (${formatDebugNumber(nominal - uncertainty)}), expression: ${exprLow} → ${formatDebugNumber(valLow)}`);

        const pickHigh = (valHigh >= valLow);
        chooseHighForMax[idx] = pickHigh;
        debugSteps.push(`  Decision: to make the result LARGER, use ${pickHigh ? 'HIGH' : 'LOW'} for Value ${valueNumber}`);
        // Add a blank line to visually separate this value's block from the next
        debugSteps.push('');
    }

    // Build final max/min expressions by selecting per-variable choices
    const maxChoices = {};
    const minChoices = {};
    for (const idx of valueIndices) {
        if (chooseHighForMax[idx] === null || chooseHighForMax[idx] === undefined) {
            // Exact value: use nominal for both max and min
            maxChoices[idx] = 'nominal';
            minChoices[idx] = 'nominal';
        } else if (chooseHighForMax[idx]) {
            maxChoices[idx] = 'high';
            minChoices[idx] = 'low';
        } else {
            maxChoices[idx] = 'low';
            minChoices[idx] = 'high';
        }
    }

    const exprMax = buildExprWithChoices(maxChoices);
    const exprMin = buildExprWithChoices(minChoices);

    debugSteps.push(`Constructed maximum-case expression: ${exprMax}`);
    debugSteps.push(`Constructed minimum-case expression: ${exprMin}`);

    const evalMax = evaluateNumericExpression(exprMax);
    const evalMin = evaluateNumericExpression(exprMin);

    debugSteps.push(`Evaluated maximum-case value: ${formatDebugNumber(evalMax)}`);
    debugSteps.push(`Evaluated minimum-case value: ${formatDebugNumber(evalMin)}`);

    const overallMin = Math.min(evalMin, evalMax);
    const overallMax = Math.max(evalMin, evalMax);

    return {
        exprMax,
        exprMin,
        evalMax,
        evalMin,
        min: overallMin,
        max: overallMax
    };
}

// Main calculate function
function calculate() {
    // Reset
    resetAll();
    
    // Collect input from UI
    input = [];
    const valuePairs = document.querySelectorAll('.value-pair');
    
    for (let i = 0; i < valuePairs.length; i++) {
        const pair = valuePairs[i];
        
        // Get operator before this pair (except first)
        let operator = '';
        if (i > 0) {
            const operatorSelect = document.querySelectorAll('.operator-select')[i - 1];
            if (operatorSelect) {
                operator = operatorSelect.value === '×' ? '*' : operatorSelect.value === '÷' ? '/' : operatorSelect.value;
            }
        }
        
        // Get brackets
        const openBracketBtn = pair.querySelector('.bracket-btn:not(.close)');
        const closeBracketBtn = pair.querySelector('.bracket-btn.close');
        const openBrackets = parseInt(openBracketBtn?.getAttribute('data-count') || '0');
        const closeBrackets = parseInt(closeBracketBtn?.getAttribute('data-count') || '0');
        
        // Get values
        const valueInput = pair.querySelector('.value-input');
        const uncInput = pair.querySelector('.uncertainty-input');
        
        const value = valueInput.value;
        const uncertainty = uncInput.value.trim(); // Trim whitespace
        
        // Validate value
        if (!value) {
            alert('Please enter all values');
            return;
        }
        
        // Validate that value is a valid number
        if (isNaN(parseFloat(value))) {
            alert('Please enter valid numbers');
            return;
        }
        
        // If uncertainty is provided, validate it; otherwise set to 0 (exact)
        let finalUncertainty = "0";
        if (uncertainty && uncertainty !== '') {
            if (isNaN(parseFloat(uncertainty))) {
                alert('Please enter valid uncertainty or leave blank for exact values');
                return;
            }
            finalUncertainty = uncertainty;
        }
        
        // Add to input array
        if (i === 0) {
            input.push([openBrackets, preserveTrailingZeros(value), preserveTrailingZeros(finalUncertainty), closeBrackets]);
        } else {
            input.push(operator);
            input.push([openBrackets, preserveTrailingZeros(value), preserveTrailingZeros(finalUncertainty), closeBrackets]);
        }
    }
    
    const expression = formExpression(input);
    const mode = document.querySelector('input[name="resultMode"]:checked')?.value || 'uncertainty';
    // Rounding override from UI (auto, sigfig, decimals)
    function getRoundingOverride() {
        const sel = document.getElementById('roundModeSelect');
        if (!sel) return { override: false };
        const val = sel.value;
        if (val === 'auto') return { override: false };
        const customInput = document.getElementById('roundCustomInput');
        const n = customInput && customInput.value ? parseInt(customInput.value) : null;
        if (n === null || isNaN(n)) return { override: false };
        if (val === 'sigfig') {
            return { override: true, useDecimalPlace: false, precision: n, precisionType: `${n} significant figure${n !== 1 ? 's' : ''}` };
        }
        if (val === 'decimals') {
            return { override: true, useDecimalPlace: true, precision: n, precisionType: `${n} decimal place${n !== 1 ? 's' : ''}` };
        }
        return { override: false };
    }

        if (mode === 'actual') {
        // Run solver silently to collect rounding metadata
        const silentResult = solve(expression, input, []);

        // Evaluate extremes and capture per-value decision debug lines
        const evalDebug = [];
        const extremes = evaluateWithExtremes(input, evalDebug);

        // Determine precision using silentResult metadata
        let useDecimalPlace = false;
        let precision = 0;
        let precisionType = '';

        if (silentResult.usedMultDiv && !silentResult.usedAddSub) {
            useDecimalPlace = false;
            precision = silentResult.sigfig || Math.min(...Array.from(document.querySelectorAll('.value-pair')).map(p => {
                const val = p.querySelector('.value-input').value;
                const unc = p.querySelector('.uncertainty-input').value;
                return getSigFigs(val, unc);
            }));
            precisionType = 'significant figures';
        } else if (silentResult.usedAddSub && !silentResult.usedMultDiv) {
            useDecimalPlace = true;
            precision = silentResult.decimalPlace || Math.min(...Array.from(document.querySelectorAll('.value-pair')).map(p => {
                const val = p.querySelector('.value-input').value;
                const unc = p.querySelector('.uncertainty-input').value;
                return getDecimalPlace(val, unc);
            }));
            precisionType = precision < 0 ? `the ${['ones', 'tens', 'hundreds', 'thousands'][Math.abs(precision)]} place` : `${precision} decimal place${precision !== 1 ? 's' : ''}`;
        } else if (silentResult.usedMultDiv && silentResult.usedAddSub) {
            useDecimalPlace = false;
            precision = silentResult.sigfig || Math.min(...Array.from(document.querySelectorAll('.value-pair')).map(p => {
                const val = p.querySelector('.value-input').value;
                const unc = p.querySelector('.uncertainty-input').value;
                return getSigFigs(val, unc);
            }));
            precisionType = 'significant figures';
        } else {
            useDecimalPlace = false;
            precision = Math.min(...Array.from(document.querySelectorAll('.value-pair')).map(p => {
                const val = p.querySelector('.value-input').value;
                const unc = p.querySelector('.uncertainty-input').value;
                return getSigFigs(val, unc);
            }));
            precisionType = 'significant figures';
        }

        // Apply UI override if set
        const override = getRoundingOverride();
        if (override.override) {
            useDecimalPlace = override.useDecimalPlace;
            precision = override.precision;
            precisionType = override.precisionType;
        }

        // Use half the range as a pseudo-uncertainty for formatting purposes
        const pseudoUncertainty = Math.abs(extremes.max - extremes.min) / 2;

        // Format extremes for display
        let formattedMax = roundResult(extremes.max, pseudoUncertainty, precision, useDecimalPlace);
        let formattedMin = roundResult(extremes.min, pseudoUncertainty, precision, useDecimalPlace);

        // Also produce an uncertainty-style representation (midpoint ± half-range)
        const midpoint = (parseFloat(extremes.min) + parseFloat(extremes.max)) / 2;
        let formattedMid = roundResult(midpoint, pseudoUncertainty, precision, useDecimalPlace);

        // If using sigfigs, ensure precision is not less than required by the uncertainty's sig figs
        if (!useDecimalPlace) {
            try {
                const uncSig = getSigFigs(formattedMid.uncertainty, formattedMid.uncertainty);
                const valSigStr = getSigFigs(formattedMid.value); // string-based sigfigs for value
                const desiredSig = Math.max(uncSig || 0, valSigStr || 0);
                if (desiredSig > precision) {
                    precision = desiredSig;
                    precisionType = `${precision} significant figure${precision !== 1 ? 's' : ''}`;
                    // Recompute formatted values with the increased precision
                    formattedMax = roundResult(extremes.max, pseudoUncertainty, precision, useDecimalPlace);
                    formattedMin = roundResult(extremes.min, pseudoUncertainty, precision, useDecimalPlace);
                    formattedMid = roundResult(midpoint, pseudoUncertainty, precision, useDecimalPlace);
                }
            } catch (e) {
                // ignore
            }
        }

        // Explain rounding rule in user-friendly language
        let roundingReason = '';
        if (silentResult.usedMultDiv && silentResult.usedAddSub) {
            roundingReason = 'Mixed operations: multiplication/division takes precedence → use significant figures.';
        } else if (silentResult.usedMultDiv) {
            roundingReason = 'Multiplication/Division detected → use significant figures.';
        } else if (silentResult.usedAddSub) {
            roundingReason = 'Addition/Subtraction detected → use decimal places.';
        } else {
            roundingReason = 'Default: use significant figures.';
        }

        // Build sequential explanation
        const explanationSteps = [];
        let step = 1;
        explanationSteps.push(`Step ${step}: Expression:`);
        explanationSteps.push(`   ${expression}`);
        step++;

        explanationSteps.push('');
        explanationSteps.push(`Step ${step}: Find Input Ranges of Values and their impact in expression`);
        step++;

        // Parse per-value lines from evalDebug
        for (let i = 0; i < evalDebug.length; i++) {
            const line = evalDebug[i];
            if (line.startsWith('Value ')) {
                const block = [];
                let j = i;
                while (j < evalDebug.length && evalDebug[j].trim() !== '') {
                    block.push(evalDebug[j]);
                    j++;
                }
                const m = block[0].match(/Value \d+: nominal = ([^,]+), uncertainty = (.+)/);
                    if (m) {
                        const nominal = parseFloat(m[1]);
                        const unc = parseFloat(m[2]) || 0;
                        explanationSteps.push(`Value = ${formatDebugNumber(nominal)}`);
                        explanationSteps.push(`Uncertainty = ${formatDebugNumber(unc)}`);
                        explanationSteps.push(`HIGH = ${formatDebugNumber(nominal + unc)}`);
                        const decisionLine = block.find(l => l.trim().startsWith('Decision:')) || '';
                        const pickHigh = decisionLine.includes('HIGH');
                        explanationSteps.push(`Impact on expression: makes it ${pickHigh ? 'larger' : 'smaller'}`);
                        explanationSteps.push(`LOW = ${formatDebugNumber(nominal - unc)}`);
                        explanationSteps.push(`Impact on expression: makes it ${pickHigh ? 'smaller' : 'larger'}`);
                        // blank line to separate values visually inside the same Step 1 box
                        explanationSteps.push('');
                    }
                i = j;
            }
        }

        // Min-Max expressions
        explanationSteps.push('');
        explanationSteps.push(`Step ${step}: Min-Max Expressions`);
        step++;
        explanationSteps.push(`Minimum-case expression: ${extremes.exprMin}`);
        explanationSteps.push(`Maximum-case expression: ${extremes.exprMax}`);
        explanationSteps.push(`Minimum-case value: ${formatDebugNumber(extremes.evalMin)}`);
        explanationSteps.push(`Maximum-case value: ${formatDebugNumber(extremes.evalMax)}`);

        // Rounding
        explanationSteps.push('');
        explanationSteps.push(`Step ${step}: Rounding`);
        step++;
        explanationSteps.push(`   ${roundingReason}`);
        explanationSteps.push(`   Range before rounding: ${formatDebugNumber(extremes.min)} to ${formatDebugNumber(extremes.max)}`);
        explanationSteps.push(`   Range after rounding: ${formattedMin.value} to ${formattedMax.value}`);

        // Uncertainty (midpoint ± half-range)
        explanationSteps.push('');
        explanationSteps.push(`Step ${step}: Uncertainty`);
        explanationSteps.push(`   Middle of range: (${formatDebugNumber(extremes.min)}+${formatDebugNumber(extremes.max)})/2 = ${formatDebugNumber(midpoint)}`);
        explanationSteps.push(`   Uncertainty: ${formatDebugNumber(midpoint)} - ${formatDebugNumber(extremes.min)} = ${formatDebugNumber(Math.abs(midpoint - extremes.min))}`);
        explanationSteps.push(`   Rounded: ${formattedMid.value} ± ${formattedMid.uncertainty}`);

        const resultDisplayEl = document.getElementById('resultDisplay');
        resultDisplayEl.innerHTML = `
            <div class="result-uncertainty result-primary">${formattedMid.value} ± ${formattedMid.uncertainty}</div>
            <div class="result-range">${formattedMin.value} to ${formattedMax.value}</div>
        `;
        displaySteps(explanationSteps);

        document.getElementById('resultSection').style.display = 'block';
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
        return;
    }
    
    // For uncertainty-propagation mode: run the solver to collect raw steps and result
    const rawSteps = [];
    const result = solve(expression, input, rawSteps);

    // Determine if we should use sigfigs or decimal places based on operations performed
    let useDecimalPlace = false;
    let precision = 0;
    let precisionType = '';
    
    if (result.usedMultDiv && !result.usedAddSub) {
        // Only multiplication/division - use significant figures
        useDecimalPlace = false;
        precision = result.sigfig || Math.min(...Array.from(valuePairs).map(p => {
            const val = p.querySelector('.value-input').value;
            const unc = p.querySelector('.uncertainty-input').value;
            return getSigFigs(val, unc);
        }));
        precisionType = 'significant figures';
    } else if (result.usedAddSub && !result.usedMultDiv) {
        // Only addition/subtraction - use decimal places
        useDecimalPlace = true;
        precision = result.decimalPlace || Math.min(...Array.from(valuePairs).map(p => {
            const val = p.querySelector('.value-input').value;
            const unc = p.querySelector('.uncertainty-input').value;
            return getDecimalPlace(val, unc);
        }));
        precisionType = precision < 0 ? `the ${['ones', 'tens', 'hundreds', 'thousands'][Math.abs(precision)]} place` : `${precision} decimal place${precision !== 1 ? 's' : ''}`;
    } else if (result.usedMultDiv && result.usedAddSub) {
        // Mixed operations - use whatever was from the last operation
        // If we did mult/div last, use sigfigs; if add/sub last, use decimal places
        useDecimalPlace = false; // Assume mult/div takes precedence
        precision = result.sigfig || Math.min(...Array.from(valuePairs).map(p => {
            const val = p.querySelector('.value-input').value;
            const unc = p.querySelector('.uncertainty-input').value;
            return getSigFigs(val, unc);
        }));
        precisionType = 'significant figures';
    } else {
        // Fallback (shouldn't happen)
        useDecimalPlace = false;
        precision = Math.min(...Array.from(valuePairs).map(p => {
            const val = p.querySelector('.value-input').value;
            const unc = p.querySelector('.uncertainty-input').value;
            return getSigFigs(val, unc);
        }));
        precisionType = 'significant figures';
    }

    // Apply UI rounding override if present (custom sigfig or decimal places)
    const override = getRoundingOverride();
    if (override.override) {
        useDecimalPlace = override.useDecimalPlace;
        precision = override.precision;
        precisionType = override.precisionType;
    }
    
    // Round result
    let finalResult = roundResult(result.total, result.uncertainty, precision, useDecimalPlace);

    // Post-adjust sigfigs: ensure precision is at least large enough for the displayed
    // value's string sigfigs or the uncertainty's sigfigs to avoid under-rounding
    if (!useDecimalPlace) {
        try {
            const uncSig = getSigFigs(finalResult.uncertainty, finalResult.uncertainty);
            const valSigStr = getSigFigs(finalResult.value);
            const desiredSig = Math.max(uncSig || 0, valSigStr || 0);
            if (desiredSig > precision) {
                precision = desiredSig;
                finalResult = roundResult(result.total, result.uncertainty, precision, useDecimalPlace);
            }
        } catch (e) {
            // ignore
        }
    }

    // Friendly rounding explanation
    let roundingReason = '';
    if (result.usedMultDiv && result.usedAddSub) {
        roundingReason = 'Mixed operations: multiplication/division takes precedence → use significant figures.';
    } else if (result.usedMultDiv) {
        roundingReason = 'Multiplication/Division detected → use significant figures.';
    } else if (result.usedAddSub) {
        roundingReason = 'Addition/Subtraction detected → use decimal places.';
    } else {
        roundingReason = 'Default: use significant figures.';
    }

    // Build a clean, sequential Step-by-step explanation from the raw solver steps
    const explanationSteps = [];
    let stepNum = 1;
    explanationSteps.push(`Step ${stepNum}: Expression:`);
    explanationSteps.push(`   ${expression}`);
    stepNum++;

    // Each entry in rawSteps may contain multiple lines; treat each non-empty block as one step
    const usedIdx = new Set();
    const opRe = /(?:Next|First)\s*operation\s*[:\-]?\s*(Addition|Subtraction|Multiplication|Division)/i;
    for (let bi = 0; bi < rawSteps.length; bi++) {
        if (usedIdx.has(bi)) continue;
        const block = rawSteps[bi];
        const rawLines = block.split('\n').map(l => l.trim());

        // Try to detect op descriptor in prev/current/next blocks
        let opName = null;
        // check current
        for (const rl of rawLines) {
            const m = rl.match(opRe);
            if (m) { opName = m[1]; break; }
        }
        // check previous block
        if (!opName && bi > 0) {
            const prevLines = rawSteps[bi - 1].split('\n').map(l => l.trim());
            for (const rl of prevLines) {
                const m = rl.match(opRe);
                if (m) { opName = m[1]; usedIdx.add(bi - 1); break; }
            }
        }
        // check next block
        if (!opName && bi + 1 < rawSteps.length) {
            const nextLines = rawSteps[bi + 1].split('\n').map(l => l.trim());
            for (const rl of nextLines) {
                const m = rl.match(opRe);
                if (m) { opName = m[1]; usedIdx.add(bi + 1); break; }
            }
        }

        // Filter out Step headers and operation descriptor lines for the body
        let bodyLines = rawLines.filter(l => l && !/^Step \d+:/.test(l) && !/^(?:Next|First)\s*operation/i.test(l));
        // If current block has no body, try to take from next block
        if (bodyLines.length === 0 && bi + 1 < rawSteps.length && !usedIdx.has(bi + 1)) {
            const nextRawLines = rawSteps[bi + 1].split('\n').map(l => l.trim());
            const candidate = nextRawLines.filter(l => l && !/^Step \d+:/.test(l) && !/^(?:Next|First)\s*operation/i.test(l));
            if (candidate.length) {
                bodyLines = candidate;
                usedIdx.add(bi + 1);
            }
        }

        if (bodyLines.length === 0) continue;

        explanationSteps.push('');
        if (opName) {
            explanationSteps.push(`Step ${stepNum}: ${opName}`);
            for (let i = 0; i < bodyLines.length; i++) explanationSteps.push(`   ${bodyLines[i]}`);
        } else {
            explanationSteps.push(`Step ${stepNum}: ${bodyLines[0]}`);
            for (let i = 1; i < bodyLines.length; i++) explanationSteps.push(`   ${bodyLines[i]}`);
        }
        stepNum++;
    }

    // Rounding / final result step
    explanationSteps.push('');
    explanationSteps.push(`Step ${stepNum}: Rounding`);
    explanationSteps.push(`   Rounding rule: ${roundingReason} Chosen precision: ${precision} (${precisionType}).`);
    explanationSteps.push(`   Before rounding: ${formatDebugNumber(result.total)} ± ${formatDebugNumber(result.uncertainty)}`);
    explanationSteps.push(`   After rounding: ${finalResult.value} ± ${finalResult.uncertainty}`);
    stepNum++;

    explanationSteps.push('');
    explanationSteps.push(`Step ${stepNum}: Final Result`);
    explanationSteps.push(`   ${finalResult.value} ± ${finalResult.uncertainty}`);
    
    // Also compute Actual extremes silently to show range alongside uncertainty result
    try {
        // Keep computing extremes for debug only, but derive displayed range from the rounded finalResult
        const extremesForDisplay = evaluateWithExtremes(input, []);
        const pseudoUncertainty2 = Math.abs(extremesForDisplay.max - extremesForDisplay.min) / 2;

        const numericFinalValue2 = Number(finalResult.value);
        const numericFinalUnc2 = Number(finalResult.uncertainty);
        const displayMin2 = numericFinalValue2 - numericFinalUnc2;
        const displayMax2 = numericFinalValue2 + numericFinalUnc2;

        const resultDisplayEl = document.getElementById('resultDisplay');
        resultDisplayEl.innerHTML = `
            <div class="result-uncertainty result-primary">${finalResult.value} ± ${finalResult.uncertainty}</div>
            <div class="result-range">${formatDebugNumber(displayMin2)} to ${formatDebugNumber(displayMax2)}</div>
        `;
    } catch (e) {
        // Fallback to single-line display
        displayResult(`${finalResult.value} ± ${finalResult.uncertainty}`);
    }
    displaySteps(explanationSteps);
    
    // Show result section
    document.getElementById('resultSection').style.display = 'block';
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
}

function resetAll() {
    // Reset global state
    newValues = 0;
    input = [];
}

// Display result
function displayResult(formattedResult) {
    const resultDisplay = document.getElementById('resultDisplay');
    resultDisplay.textContent = formattedResult;
}

// Display debug steps
const displaySteps = function(debugSteps) {
    if (typeof window !== 'undefined' && typeof window._displaySteps === 'function' && window._displaySteps !== displaySteps) {
        return window._displaySteps(debugSteps);
    }
    // Fallback: simple rendering if display implementation not yet available
    const explanationContent = document.getElementById('explanationContent');
    if (!explanationContent) return;
    try {
        explanationContent.innerHTML = '';
        const pre = document.createElement('pre');
        pre.textContent = Array.isArray(debugSteps) ? debugSteps.join('\n') : String(debugSteps);
        explanationContent.appendChild(pre);
    } catch (e) {
        // best-effort no-op
    }
};

// Theme, rounding, and value-pair UI helpers are implemented in ui.js
// Provide thin wrappers that delegate to window._ui when available, with safe fallbacks.
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle ? themeToggle.querySelector('.theme-icon') : null;

function getTheme() {
    if (window._ui && typeof window._ui.getTheme === 'function') return window._ui.getTheme();
    return localStorage.getItem('theme') || 'light';
}

function setTheme(theme) {
    if (window._ui && typeof window._ui.setTheme === 'function') return window._ui.setTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    if (window._ui && typeof window._ui.toggleTheme === 'function') return window._ui.toggleTheme();
    const currentTheme = getTheme();
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

function toggleRoundingControls() {
    if (window._ui && typeof window._ui.toggleRoundingControls === 'function') return window._ui.toggleRoundingControls();
    const sel = document.getElementById('roundModeSelect');
    const input = document.getElementById('roundCustomInput');
    const helper = document.getElementById('roundHelper');
    if (!sel || !input) return;
    if (sel.value === 'auto') {
        input.style.display = 'none';
        if (helper) {
            helper.style.visibility = 'hidden'; helper.style.opacity = '0'; helper.style.pointerEvents = 'none';
        }
    } else {
        input.style.display = 'inline-block';
        input.placeholder = sel.value === 'sigfig' ? 'Significant figures' : 'Decimal places';
        if (helper) {
            if (sel.value === 'decimals') { helper.style.visibility = 'visible'; helper.style.opacity = '1'; helper.style.pointerEvents = 'auto'; }
            else { helper.style.visibility = 'hidden'; helper.style.opacity = '0'; helper.style.pointerEvents = 'none'; }
        }
    }
}

// Ensure control visibility on load
document.addEventListener('DOMContentLoaded', () => { try { toggleRoundingControls(); } catch (e) {} });

// Value pair management wrappers
window.valuePairCount = window.valuePairCount || 0;
function addValuePair() {
    if (window._ui && typeof window._ui.addValuePair === 'function') return window._ui.addValuePair();
}
function removeValuePair(idx) {
    if (window._ui && typeof window._ui.removeValuePair === 'function') return window._ui.removeValuePair(idx);
}
function updateRemoveButtons() {
    if (window._ui && typeof window._ui.updateRemoveButtons === 'function') return window._ui.updateRemoveButtons();
}

function toggleBracket(pairIndex) {
    if (window._ui && typeof window._ui.toggleBracket === 'function') return window._ui.toggleBracket(pairIndex);
}

function toggleCloseBracket(pairIndex) {
    if (window._ui && typeof window._ui.toggleCloseBracket === 'function') return window._ui.toggleCloseBracket(pairIndex);
}

// Initialize with 2 value pairs
addValuePair();
addValuePair();

// Update the remove button visibility
updateRemoveButtons();

// Input mode switching
function switchInputMode(mode) {
    if (window._ui && typeof window._ui.switchInputMode === 'function') return window._ui.switchInputMode(mode);
}

// Parse text expression into input format
function parseTextExpression(text) {
    if (window._ui && typeof window._ui.parseTextExpression === 'function') return window._ui.parseTextExpression(text);
}

// Calculate from text input
function calculateFromText() {
    const textInput = document.getElementById('textExpression');
    const expression = textInput.value;
    
    if (!expression.trim()) {
        alert('Please enter an expression');
        return;
    }
    
    try {
        // Parse the text expression
        const parseResult = parseTextExpression(expression);
        
        if (!parseResult.rawExpression || parseResult.rawExpression.length === 0) {
            alert('Could not parse expression. Please check the format.');
            return;
        }
        
        // Debug steps array
        const debugSteps = [];

        // Determine mode (shared radio)
        const mode = document.querySelector('input[name="resultMode"]:checked')?.value || 'uncertainty';

        // If Actual Value mode selected, use directional Max-Min method
        if (mode === 'actual') {
            // Build debug steps only for Actual Value mode
            debugSteps.push(`Expression: ${parseResult.rawExpression}`);
            debugSteps.push('');

            const extremes = evaluateWithExtremes(parseResult.rawExpression, debugSteps);

            // Run solver silently to collect rounding metadata without adding steps
            const silentResult = solve(parseResult.rawExpression, [], []);

            // Determine precision using same rules as calculate()
            let useDecimalPlace = false;
            let precision = 0;
            let precisionType = '';

            if (silentResult.usedMultDiv && !silentResult.usedAddSub) {
                useDecimalPlace = false;
                precision = silentResult.sigfig || 999;
                precisionType = 'significant figures';
            } else if (silentResult.usedAddSub && !silentResult.usedMultDiv) {
                useDecimalPlace = true;
                precision = silentResult.decimalPlace || 0;
                precisionType = precision < 0 ? `the ${['ones', 'tens', 'hundreds', 'thousands'][Math.abs(precision)]} place` : `${precision} decimal place${precision !== 1 ? 's' : ''}`;
            } else {
                useDecimalPlace = false;
                precision = silentResult.sigfig || 999;
                precisionType = 'significant figures';
            }

            // Apply UI rounding override if present
            const override = getRoundingOverride();
            if (override.override) {
                useDecimalPlace = override.useDecimalPlace;
                precision = override.precision;
                precisionType = override.precisionType;
            }

            const pseudoUncertainty = Math.abs(extremes.max - extremes.min) / 2;

            let formattedMax = roundResult(extremes.max, pseudoUncertainty, precision, useDecimalPlace);
            let formattedMin = roundResult(extremes.min, pseudoUncertainty, precision, useDecimalPlace);

            // Also produce an uncertainty-style representation (midpoint ± half-range)
            const midpoint = (parseFloat(extremes.min) + parseFloat(extremes.max)) / 2;
            let formattedMid = roundResult(midpoint, pseudoUncertainty, precision, useDecimalPlace);

            // Ensure sigfig precision isn't smaller than the value/uncertainty's needs
            if (!useDecimalPlace) {
                try {
                    const uncSig = getSigFigs(formattedMid.uncertainty, formattedMid.uncertainty);
                    const valSigStr = getSigFigs(formattedMid.value);
                    const desiredSig = Math.max(uncSig || 0, valSigStr || 0);
                    if (desiredSig > precision) {
                        precision = desiredSig;
                        precisionType = `${precision} significant figure${precision !== 1 ? 's' : ''}`;
                        formattedMax = roundResult(extremes.max, pseudoUncertainty, precision, useDecimalPlace);
                        formattedMin = roundResult(extremes.min, pseudoUncertainty, precision, useDecimalPlace);
                        formattedMid = roundResult(midpoint, pseudoUncertainty, precision, useDecimalPlace);
                        debugSteps.push(`Adjusted precision to ${precision} based on value/uncertainty sig figs; recomputed rounded results.`);
                    }
                } catch (e) {}
            }

            const resultDisplayEl = document.getElementById('resultDisplay');
            resultDisplayEl.innerHTML = `
                <div class="result-uncertainty result-primary">${formattedMid.value} ± ${formattedMid.uncertainty}</div>
                <div class="result-range">${formattedMin.value} to ${formattedMax.value}</div>
            `;

            // Build structured explanation steps from raw evaluateWithExtremes debug output
            // Determine roundingReason similar to calculate()
            let roundingReason = '';
            if (silentResult.usedMultDiv && silentResult.usedAddSub) {
                roundingReason = 'Mixed operations: multiplication/division takes precedence → use significant figures.';
            } else if (silentResult.usedMultDiv) {
                roundingReason = 'Multiplication/Division detected → use significant figures.';
            } else if (silentResult.usedAddSub) {
                roundingReason = 'Addition/Subtraction detected → use decimal places.';
            } else {
                roundingReason = 'Default: use significant figures.';
            }

            const explanationSteps = [];
            explanationSteps.push('Expression: ');
            explanationSteps.push('   ' + parseResult.rawExpression);
            explanationSteps.push('');
            explanationSteps.push('Step 1: Find Input Ranges of Values and their impact in expression');

            // Parse value blocks from debugSteps created by evaluateWithExtremes
            for (let i = 0; i < debugSteps.length; i++) {
                const line = debugSteps[i];
                if (line.startsWith('Value ')) {
                    const block = [];
                    let j = i;
                    while (j < debugSteps.length && debugSteps[j].trim() !== '') {
                        block.push(debugSteps[j]);
                        j++;
                    }
                    const m = block[0].match(/Value \d+: nominal = ([^,]+), uncertainty = (.+)/);
                    if (m) {
                        const nominal = parseFloat(m[1]);
                        const unc = parseFloat(m[2]) || 0;
                        explanationSteps.push(`Value = ${formatDebugNumber(nominal)}`);
                        explanationSteps.push(`Uncertainty = ${formatDebugNumber(unc)}`);
                        explanationSteps.push(`HIGH = ${formatDebugNumber(nominal + unc)}`);
                        const decisionLine = block.find(l => l.trim().startsWith('Decision:')) || '';
                        const pickHigh = decisionLine.includes('HIGH');
                        explanationSteps.push(`Impact on expression: makes it ${pickHigh ? 'larger' : 'smaller'}`);
                        explanationSteps.push(`LOW = ${formatDebugNumber(nominal - unc)}`);
                        explanationSteps.push(`Impact on expression: makes it ${pickHigh ? 'smaller' : 'larger'}`);
                        // blank line to separate values visually inside the same Step 1 box
                        explanationSteps.push('');
                    }
                    i = j;
                }
            }

            explanationSteps.push('');
            explanationSteps.push('Step 2: Min-Max Expressions');
            explanationSteps.push(`Minimum-case expression: ${extremes.exprMin}`);
            explanationSteps.push(`Maximum-case expression: ${extremes.exprMax}`);
            explanationSteps.push(`Minimum-case value: ${formatDebugNumber(extremes.evalMin)}`);
            explanationSteps.push(`Maximum-case value: ${formatDebugNumber(extremes.evalMax)}`);

            explanationSteps.push('');
            explanationSteps.push('Step 3: Rounding');
            explanationSteps.push(`Rounding rule: ${roundingReason}`);
            explanationSteps.push(`Range before rounding: ${formatDebugNumber(extremes.min)} to ${formatDebugNumber(extremes.max)}`);
            explanationSteps.push(`Range after rounding: ${formattedMin.value} to ${formattedMax.value}`);

            explanationSteps.push('');
            explanationSteps.push('Step 4: Uncertainty');
            explanationSteps.push(`Middle of range: (${formatDebugNumber(extremes.min)}+${formatDebugNumber(extremes.max)})/2 = ${formatDebugNumber(midpoint)}`);
            explanationSteps.push(`Uncertainty: ${formatDebugNumber(midpoint)} - ${formatDebugNumber(extremes.min)} = ${formatDebugNumber(Math.abs(midpoint - extremes.min))}`);
            explanationSteps.push(`Rounded: ${formattedMid.value} ± ${formattedMid.uncertainty}`);

            displaySteps(explanationSteps);

            document.getElementById('resultSection').style.display = 'block';
            document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
            return;
        }

        // Default: standard uncertainty propagation
        const rawSteps2 = [];
        const result = solve(parseResult.rawExpression, [], rawSteps2);

        // For now, use simplified precision logic
        let useDecimalPlace = false;
        let precision = 0;
        let precisionType = '';

        if (result.usedMultDiv && !result.usedAddSub) {
            useDecimalPlace = false;
            precision = result.sigfig || 999;
            precisionType = 'significant figures';
        } else if (result.usedAddSub && !result.usedMultDiv) {
            useDecimalPlace = true;
            precision = result.decimalPlace || 0;
            precisionType = precision < 0 ? `the ${['ones', 'tens', 'hundreds', 'thousands'][Math.abs(precision)]} place` : `${precision} decimal place${precision !== 1 ? 's' : ''}`;
        } else {
            useDecimalPlace = false;
            precision = result.sigfig || 999;
            precisionType = 'significant figures';
        }

        // Apply UI rounding override if present (force custom sigfigs/decimals)
        const override2 = getRoundingOverride();
        if (override2.override) {
            useDecimalPlace = override2.useDecimalPlace;
            precision = override2.precision;
            precisionType = override2.precisionType;
        }

        // Round result
        let finalResult = roundResult(result.total, result.uncertainty, precision, useDecimalPlace);

        // Post-adjust sigfigs for text-mode propagation: ensure uncertainty sigfigs aren't larger than chosen precision
        if (!useDecimalPlace) {
            try {
                const uncSig = getSigFigs(finalResult.uncertainty, finalResult.uncertainty);
                if (uncSig > 0 && uncSig > precision) {
                    precision = Math.max(precision, uncSig);
                    finalResult = roundResult(result.total, result.uncertainty, precision, useDecimalPlace);
                }
            } catch (e) {}
        }
        // Build sequential explanation steps from raw solver output
        const explanationSteps2 = [];
        let stepN = 1;
        explanationSteps2.push(`Step ${stepN}: Expression:`);
        explanationSteps2.push(`   ${parseResult.rawExpression}`);
        stepN++;

        const usedIdx2 = new Set();
        const opRe2 = /(?:Next|First)\s*operation\s*[:\-]?\s*(Addition|Subtraction|Multiplication|Division)/i;
        for (let bi = 0; bi < rawSteps2.length; bi++) {
            if (usedIdx2.has(bi)) continue;
            const block = rawSteps2[bi];
            const rawLines = block.split('\n').map(l => l.trim());

            let opName = null;
            for (const rl of rawLines) {
                const m = rl.match(opRe2);
                if (m) { opName = m[1]; break; }
            }
            if (!opName && bi > 0) {
                const prevLines = rawSteps2[bi - 1].split('\n').map(l => l.trim());
                for (const rl of prevLines) {
                    const m = rl.match(opRe2);
                    if (m) { opName = m[1]; usedIdx2.add(bi - 1); break; }
                }
            }
            if (!opName && bi + 1 < rawSteps2.length) {
                const nextLines = rawSteps2[bi + 1].split('\n').map(l => l.trim());
                for (const rl of nextLines) {
                    const m = rl.match(opRe2);
                    if (m) { opName = m[1]; usedIdx2.add(bi + 1); break; }
                }
            }

            let bodyLines = rawLines.filter(l => l && !/^Step \d+:/.test(l) && !/^(?:Next|First)\s*operation/i.test(l));
            if (bodyLines.length === 0 && bi + 1 < rawSteps2.length && !usedIdx2.has(bi + 1)) {
                const nextRawLines = rawSteps2[bi + 1].split('\n').map(l => l.trim());
                const candidate = nextRawLines.filter(l => l && !/^Step \d+:/.test(l) && !/^(?:Next|First)\s*operation/i.test(l));
                if (candidate.length) { bodyLines = candidate; usedIdx2.add(bi + 1); }
            }

            if (bodyLines.length === 0) continue;

            explanationSteps2.push('');
            if (opName) {
                explanationSteps2.push(`Step ${stepN}: ${opName}`);
                for (let i = 0; i < bodyLines.length; i++) explanationSteps2.push(`   ${bodyLines[i]}`);
            } else {
                explanationSteps2.push(`Step ${stepN}: ${bodyLines[0]}`);
                for (let i = 1; i < bodyLines.length; i++) explanationSteps2.push(`   ${bodyLines[i]}`);
            }
            stepN++;
        }

        explanationSteps2.push('');
        explanationSteps2.push(`Step ${stepN}: Rounding`);
        explanationSteps2.push(`   Rounding to ${precisionType} because ${result.usedMultDiv && result.usedAddSub ? 'mixed operations use' : result.usedMultDiv ? 'multiplication/division uses' : 'addition/subtraction uses'} ${precisionType}`);
        explanationSteps2.push(`   Before rounding: ${result.total} ± ${result.uncertainty}`);
        explanationSteps2.push(`   After rounding: ${finalResult.value} ± ${finalResult.uncertainty}`);
        stepN++;

        explanationSteps2.push('');
        explanationSteps2.push(`Step ${stepN}: Final Result`);
        explanationSteps2.push(`   ${finalResult.value} ± ${finalResult.uncertainty}`);

        // Display: compute extremes for debug but derive shown range from the rounded finalResult
        try {
            const extremesForDisplay = evaluateWithExtremes(parseResult.rawExpression, []);
            const pseudoUncertainty2 = Math.abs(extremesForDisplay.max - extremesForDisplay.min) / 2;

            const numericFinalValue = Number(finalResult.value);
            const numericFinalUnc = Number(finalResult.uncertainty);
            const displayMin = numericFinalValue - numericFinalUnc;
            const displayMax = numericFinalValue + numericFinalUnc;

            const resultDisplayEl = document.getElementById('resultDisplay');
            resultDisplayEl.innerHTML = `
                <div class="result-uncertainty result-primary">${finalResult.value} ± ${finalResult.uncertainty}</div>
                <div class="result-range">${formatDebugNumber(displayMin)} to ${formatDebugNumber(displayMax)}</div>
            `;
        } catch (e) {
            displayResult(`${finalResult.value} ± ${finalResult.uncertainty}`);
        }
        displaySteps(explanationSteps2);

        // Show result section
        document.getElementById('resultSection').style.display = 'block';
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        const debugBox = document.getElementById('debugBox');
        const debugContent = document.getElementById('debugContent');
        const msg = 'Error parsing expression: ' + (error && error.message ? error.message : String(error));
        alert(msg);
        console.error(error);
        if (debugBox && debugContent) {
            debugBox.style.display = 'block';
            debugContent.textContent = msg + '\n\nStack:\n' + (error && error.stack ? error.stack : 'no stack available');
        }
    }
}

// Insert symbol into text expression input
function insertSymbol(symbol) {
    if (window._ui && typeof window._ui.insertSymbol === 'function') return window._ui.insertSymbol(symbol);
}

// Allow Enter key to calculate
document.addEventListener('keypress', function(event) {
    // Only handle if we're in text mode and focused on the text input
    const textInput = document.getElementById('textExpression');
    if (document.activeElement === textInput && event.key === 'Enter') {
        calculateFromText();
    } else if (event.key === 'Enter' && document.getElementById('uiInputMode').style.display !== 'none') {
        calculate();
    }
});

