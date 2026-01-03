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
    if (window.roundResult && window.roundResult !== roundResult) return window.roundResult(value, uncertainty, sigfigsOrDecPlace, isDecimalPlace);
    // Fallback local implementation (keeps existing behavior)
    if (isDecimalPlace) {
        const roundedValue = Math.round(parseFloat(value) * Math.pow(10, sigfigsOrDecPlace)) / Math.pow(10, sigfigsOrDecPlace);
        const roundedUnc = Math.round(parseFloat(uncertainty) * Math.pow(10, sigfigsOrDecPlace)) / Math.pow(10, sigfigsOrDecPlace);
        if (sigfigsOrDecPlace < 0) return { value: Math.round(roundedValue).toString(), uncertainty: Math.round(roundedUnc).toString() };
        return { value: roundedValue.toFixed(sigfigsOrDecPlace), uncertainty: roundedUnc.toFixed(sigfigsOrDecPlace) };
    }
    const sigfig = sigfigsOrDecPlace;
    let roundedValue;
    if (sigfig >= 999) roundedValue = parseFloat(value); else roundedValue = parseFloat(parseFloat(value).toPrecision(sigfig));
    const roundedUnc = parseFloat(uncertainty);
    let formattedValue;
    if (sigfig >= 999) {
        const decPlace = getDecimalPlace(uncertainty.toString(), uncertainty.toString());
        formattedValue = decPlace < 0 ? Math.round(roundedValue).toString() : parseFloat(roundedValue.toFixed(decPlace)).toFixed(decPlace);
    } else {
        formattedValue = parseFloat(value).toPrecision(sigfig);
    }
    const uncDecPlace = getDecimalPlace(uncertainty.toString(), uncertainty.toString());
    let formattedUnc = uncDecPlace < 0 ? Math.round(roundedUnc).toString() : roundedUnc.toFixed(uncDecPlace);
    if (uncDecPlace >= 0) {
        const numericVal = Number(value);
        if (isFinite(numericVal)) formattedValue = numericVal.toFixed(uncDecPlace);
    }
    if (String(formattedValue).toLowerCase().includes('e')) {
        const numericVal = Number(roundedValue);
        if (isFinite(numericVal) && Math.abs(numericVal) < 1000) {
            formattedValue = uncDecPlace < 0 ? Math.round(numericVal).toString() : parseFloat(numericVal.toFixed(uncDecPlace)).toFixed(uncDecPlace);
        }
    }
    return { value: formattedValue, uncertainty: formattedUnc };
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
    if (window.parseExpressionToInput && window.parseExpressionToInput !== parseExpressionToInput) return window.parseExpressionToInput(expr);
    // Minimal local fallback parser (keeps behavior small to avoid duplication)
    const parsed = [];
    let i = 0;
    while (i < expr.length) {
        const valueMatch = expr.substring(i).match(/^(-?\d*\.?\d+(?:[eE][+\-]?\d+)?)(?:±(-?\d*\.?\d+(?:[eE][+\-]?\d+)?))?/);
        if (valueMatch) {
            parsed.push([0, valueMatch[1], valueMatch[2] ? valueMatch[2] : '0', 0]);
            i += valueMatch[0].length;
        } else if ('+-*/()×÷'.includes(expr[i])) {
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
const evaluateWithExtremes = function(inputOrExpr, debugSteps = []) {
    if (window.evaluateWithExtremes && window.evaluateWithExtremes !== evaluateWithExtremes) {
        return window.evaluateWithExtremes(inputOrExpr, debugSteps);
    }
    // Fallback: attempt to evaluate numerically and return identical min/max
    try {
        const expr = (typeof inputOrExpr === 'string') ? inputOrExpr : formExpression(inputOrExpr || []);
        const val = evaluateNumericExpression(expr);
        return { exprMax: expr, exprMin: expr, evalMax: val, evalMin: val, min: val, max: val };
    } catch (e) {
        return { exprMax: '', exprMin: '', evalMax: NaN, evalMin: NaN, min: NaN, max: NaN };
    }
};

// Main calculate function
// Shared helpers for calculate() and calculateFromText()
function determinePrecision(silentResult, override) {
    if (window.determinePrecision && window.determinePrecision !== determinePrecision) return window.determinePrecision(silentResult, override);
    // Local fallback that inspects UI value pairs (keeps behavior compatible)
    let useDecimalPlace = false;
    let precision = 0;
    let precisionType = '';

    const valuePairs = Array.from(document.querySelectorAll('.value-pair'));
    const sigs = valuePairs.length ? valuePairs.map(p => {
        const val = p.querySelector('.value-input')?.value || '0';
        const unc = p.querySelector('.uncertainty-input')?.value || '0';
        try { return getSigFigs(val, unc); } catch (e) { return 1; }
    }) : [];
    const decs = valuePairs.length ? valuePairs.map(p => {
        const val = p.querySelector('.value-input')?.value || '0';
        const unc = p.querySelector('.uncertainty-input')?.value || '0';
        try { return getDecimalPlace(val, unc); } catch (e) { return 0; }
    }) : [];

    if (silentResult.usedMultDiv && !silentResult.usedAddSub) {
        useDecimalPlace = false;
        precision = silentResult.sigfig || (sigs.length ? Math.min(...sigs) : 1);
        precisionType = 'significant figures';
    } else if (silentResult.usedAddSub && !silentResult.usedMultDiv) {
        useDecimalPlace = true;
        precision = silentResult.decimalPlace || (decs.length ? Math.min(...decs) : 0);
        precisionType = precision < 0 ? `the ${['ones', 'tens', 'hundreds', 'thousands'][Math.abs(precision)]} place` : `${precision} decimal place${precision !== 1 ? 's' : ''}`;
    } else if (silentResult.usedMultDiv && silentResult.usedAddSub) {
        useDecimalPlace = false;
        precision = silentResult.sigfig || (sigs.length ? Math.min(...sigs) : 1);
        precisionType = 'significant figures';
    } else {
        useDecimalPlace = false;
        precision = sigs.length ? Math.min(...sigs) : 1;
        precisionType = 'significant figures';
    }

    if (override && override.override) {
        useDecimalPlace = override.useDecimalPlace;
        precision = override.precision;
        precisionType = override.precisionType;
    }

    return { useDecimalPlace, precision, precisionType };
}

function roundRangeValues(extremes, precision, useDecimalPlace) {
    if (window.roundRangeValues && window.roundRangeValues !== roundRangeValues) return window.roundRangeValues(extremes, precision, useDecimalPlace);
    const pseudoUncertainty = Math.abs(extremes.max - extremes.min) / 2;
    const formattedMax = roundResult(extremes.max, pseudoUncertainty, precision, useDecimalPlace);
    const formattedMin = roundResult(extremes.min, pseudoUncertainty, precision, useDecimalPlace);
    const midpoint = (parseFloat(extremes.min) + parseFloat(extremes.max)) / 2;
    const formattedMid = roundResult(midpoint, pseudoUncertainty, precision, useDecimalPlace);
    return { formattedMax, formattedMin, formattedMid, pseudoUncertainty, midpoint };
}

function buildRoundingReason(silentResult) {
    if (window.buildRoundingReason && window.buildRoundingReason !== buildRoundingReason) return window.buildRoundingReason(silentResult);
    if (silentResult.usedMultDiv && silentResult.usedAddSub) {
        return 'Mixed operations: multiplication/division takes precedence → use significant figures.';
    } else if (silentResult.usedMultDiv) {
        return 'Multiplication/Division detected → use significant figures.';
    } else if (silentResult.usedAddSub) {
        return 'Addition/Subtraction detected → use decimal places.';
    }
    return 'Default: use significant figures.';
}

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
    // Use top-level getRoundingOverride()

        if (mode === 'actual') {
            const calc = (typeof window.calculateActualValues === 'function') ? window.calculateActualValues(expression, { input, override: getRoundingOverride() }) : null;
            const resultDisplayEl = document.getElementById('resultDisplay');
            if (calc) {
                resultDisplayEl.innerHTML = `
                    <div class="result-uncertainty result-primary">${calc.formattedMid.value} ± ${calc.formattedMid.uncertainty}</div>
                    <div class="result-range">${calc.formattedMin.value} to ${calc.formattedMax.value}</div>
                `;
                displaySteps(calc.explanationSteps);
            } else {
                // Fallback: minimal display using existing helpers
                const silentResult = solve(expression, input, []);
                const evalDebug = [];
                const extremes = evaluateWithExtremes(input, evalDebug);
                const override = getRoundingOverride();
                const { useDecimalPlace, precision } = determinePrecision(silentResult, override);
                const rr = roundRangeValues(extremes, precision, useDecimalPlace);
                resultDisplayEl.innerHTML = `
                    <div class="result-uncertainty result-primary">${rr.formattedMid.value} ± ${rr.formattedMid.uncertainty}</div>
                    <div class="result-range">${rr.formattedMin.value} to ${rr.formattedMax.value}</div>
                `;
                displaySteps([`Expression:`, `   ${expression}`]);
            }
            document.getElementById('resultSection').style.display = 'block';
            document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
            return;
        }
    
    // For uncertainty-propagation mode: delegate to core calculator when available
    const calcProp = (typeof window.calculatePropagation === 'function') ? window.calculatePropagation(expression, { input, override: getRoundingOverride() }) : null;
    if (calcProp) {
        const resultDisplayEl = document.getElementById('resultDisplay');
        const fr = calcProp.finalResult;
        resultDisplayEl.innerHTML = `
            <div class="result-uncertainty result-primary">${fr.value} ± ${fr.uncertainty}</div>
            <div class="result-range">${formatDebugNumber(calcProp.displayMin)} to ${formatDebugNumber(calcProp.displayMax)}</div>
        `;
        displaySteps(calcProp.explanationSteps);
        document.getElementById('resultSection').style.display = 'block';
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
        return;
    }
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
        let debugSteps = [];

        // Determine mode (shared radio)
        const mode = document.querySelector('input[name="resultMode"]:checked')?.value || 'uncertainty';

        // If Actual Value mode selected, use directional Max-Min method
        if (mode === 'actual') {
            const calc = (typeof window.calculateActualValues === 'function') ? window.calculateActualValues(parseResult.rawExpression, { input: parseResult.parsedInput || [], override: getRoundingOverride() }) : null;
            const resultDisplayEl = document.getElementById('resultDisplay');
            if (calc) {
                resultDisplayEl.innerHTML = `
                    <div class="result-uncertainty result-primary">${calc.formattedMid.value} ± ${calc.formattedMid.uncertainty}</div>
                    <div class="result-range">${calc.formattedMin.value} to ${calc.formattedMax.value}</div>
                `;
                displaySteps(calc.explanationSteps);
            } else {
                // fallback minimal
                const evalDebug = [];
                const extremes = evaluateWithExtremes(parseResult.rawExpression, evalDebug);
                const silentResult = solve(parseResult.rawExpression, [], []);
                const override = getRoundingOverride();
                const { useDecimalPlace, precision } = determinePrecision(silentResult, override);
                const rr = roundRangeValues(extremes, precision, useDecimalPlace);
                resultDisplayEl.innerHTML = `
                    <div class="result-uncertainty result-primary">${rr.formattedMid.value} ± ${rr.formattedMid.uncertainty}</div>
                    <div class="result-range">${rr.formattedMin.value} to ${rr.formattedMax.value}</div>
                `;
                displaySteps([`Expression:`, `   ${parseResult.rawExpression}`]);
            }
            document.getElementById('resultSection').style.display = 'block';
            document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
            return;
        }


        // Default: standard uncertainty propagation
        const calcProp = (typeof window.calculatePropagation === 'function') ? window.calculatePropagation(parseResult.rawExpression, { input: parseResult.parsedInput || [], override: getRoundingOverride() }) : null;
        if (calcProp) {
            const fr = calcProp.finalResult;
            const resultDisplayEl = document.getElementById('resultDisplay');
            resultDisplayEl.innerHTML = `
                <div class="result-uncertainty result-primary">${fr.value} ± ${fr.uncertainty}</div>
                <div class="result-range">${formatDebugNumber(calcProp.displayMin)} to ${formatDebugNumber(calcProp.displayMax)}</div>
            `;
            displaySteps(calcProp.explanationSteps);
            document.getElementById('resultSection').style.display = 'block';
            document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
            return;
        }
        
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

