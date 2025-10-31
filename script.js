// Global state
let newValues = 0;
let input = []; // Structure: [[openBrackets, value, uncertainty, closeBrackets], [operator, value, uncertainty, openBrackets], ...]

// Helper: repeat string n times
function repeatStr(str, n) {
    return n > 0 ? str.repeat(n) : '';
}

// Keep trailing zeros by converting to string
function preserveTrailingZeros(num) {
    return num.toString();
}

// Normalize scientific notation: (removed - no longer converting ^ to e)
function normalizeScientificNotation(str) {
    return str;
}

// Get significant figures from number string (preserve trailing zeros)
// Now considers uncertainty to determine significant figures
function getSigFigs(numStr, uncertaintyStr = null, debugSteps = null) {
    const str = numStr.toString();
    
    if (debugSteps) {
        debugSteps.push(`    getSigFigs called with value="${str}", uncertainty="${uncertaintyStr}"`);
    }
    
    // First, count sig figs from the string (including trailing zeros)
    let count = 0;
    let hasDecimal = str.includes('.');
    let foundNonZero = false;
    let pastDecimal = false;
    
    if (debugSteps) {
        debugSteps.push(`    Analyzing string: "${str}"`);
    }
    
    for (let char of str) {
        if (char === '-' || char === '+') continue;
        if (char === '.') {
            pastDecimal = true;
            continue;
        }
        
        if (char !== '0') {
            foundNonZero = true;
            count++;
            if (debugSteps) {
                debugSteps.push(`      Found non-zero: '${char}', count now: ${count}`);
            }
        } else if (foundNonZero || (hasDecimal && pastDecimal)) {
            // Any zeros after finding non-zero digit count, OR after decimal
            count++;
            if (debugSteps) {
                debugSteps.push(`      Found zero (significant): '${char}', count now: ${count}`);
            }
        } else {
            if (debugSteps) {
                debugSteps.push(`      Skipping leading zero: '${char}'`);
            }
        }
    }
    
    let stringBasedSigfigs = count || 1;
    
    if (debugSteps) {
        debugSteps.push(`    String-based sigfigs for "${str}": ${stringBasedSigfigs}`);
    }
    
    // If uncertainty provided, use it to refine the sig figs
    if (uncertaintyStr) {
        let value = parseFloat(str);
        let uncertainty = parseFloat(uncertaintyStr);
        
        // If uncertainty is 0, value is exact (infinite sig figs)
        // BUT only if it's an integer without decimal - values like 5.00 should keep their sigfigs
        if (uncertainty === 0) {
            const hasDecimalPoint = str.includes('.');
            if (!hasDecimalPoint) {
                // Integer with zero uncertainty = truly exact
                if (debugSteps) {
                    debugSteps.push(`    Exact integer value (uncertainty = 0), returning infinite sigfigs (represented as 999)`);
                }
                return 999; // Represent infinite as a very large number
            } else {
                // Value with decimal point like 5.00 - use string-based sigfigs
                if (debugSteps) {
                    debugSteps.push(`    Decimal with zero uncertainty (e.g., 5.00), using string-based sigfigs: ${stringBasedSigfigs}`);
                }
                return stringBasedSigfigs;
            }
        }
        
        if (uncertainty > 0) {
            // Find the decimal place of uncertainty
            const uncertaintyAbs = Math.abs(uncertainty);
            const orderUnc = Math.floor(Math.log10(uncertaintyAbs));
            
            // Find the decimal place of the value
            const orderVal = Math.floor(Math.log10(Math.abs(value || 0.1)));
            
            if (debugSteps) {
                debugSteps.push(`    Value ${value} has order ${orderVal}, uncertainty ${uncertainty} has order ${orderUnc}`);
            }
            
            // The difference tells us how many digits are significant
            // e.g., 4000 (order 3) ± 200 (order 2) -> difference 1 -> 4 and one uncertain -> 2 sig figs
            // e.g., 0.90 (order -1) ± 0.10 (order -2) -> difference 1 -> 2 sig figs
            const diff = orderVal - orderUnc;
            const uncertaintyBasedSigfigs = Math.max(1, diff + 1);
            
            if (debugSteps) {
                debugSteps.push(`    Uncertainty-based sigfigs: ${uncertaintyBasedSigfigs}`);
            }
            
            // Use the uncertainty-based sigfigs as it's more accurate
            // String-based is just a fallback for when uncertainty isn't provided
            // The uncertainty tells us the precision, so it's more reliable
            return uncertaintyBasedSigfigs;
        }
    }
    
    return stringBasedSigfigs;
}

// Get decimal place from number string based on uncertainty
// For decimals: returns positive number (0.123 -> 3)
// For integers: returns negative number (9000 -> -3 meaning thousands place)
// Now considers uncertainty to determine accuracy
function getDecimalPlace(numStr, uncertaintyStr = null) {
    const str = numStr.toString();
    let value = parseFloat(str);
    let uncertainty = uncertaintyStr ? parseFloat(uncertaintyStr) : null;
    
    // If uncertainty provided, use it to determine decimal place
    if (uncertainty !== null && uncertainty > 0) {
        // Find what decimal place the uncertainty is in
        // uncertainty = 200 -> decimal place = -2 (hundreds)
        // uncertainty = 0.002 -> decimal place = 3 (thousandths)
        
        // Convert uncertainty to scientific notation to find the magnitude
        const uncertaintyAbs = Math.abs(uncertainty);
        if (uncertaintyAbs === 0) return 0;
        
        // Find the order of magnitude of the uncertainty
        // e.g., 200 -> 2*10^2 -> order = 2 -> decimal place = -2
        // e.g., 0.002 -> 2*10^-3 -> order = -3 -> decimal place = 3
        const order = Math.floor(Math.log10(uncertaintyAbs));
        
        // The first significant digit position gives us the decimal place
        const uncertaintyStr2 = uncertaintyAbs.toExponential();
        const parts = uncertaintyStr2.split('e');
        const coefficient = parseFloat(parts[0]);
        
        // Round coefficient to 1 sig fig and adjust order
        const roundedCoeff = Math.round(coefficient);
        const finalOrder = order + (Math.log10(coefficient) - Math.log10(roundedCoeff));
        
        // Decimal place is negative of order for integers, positive for decimals
        return -Math.round(finalOrder);
    }
    
    // Fallback: original logic based on value alone
    if (str.includes('.')) {
        const parts = str.split('.');
        // Count all digits after decimal including trailing zeros
        return parts[1].length;
    }
    // Integer case - count trailing zeros to determine place
    // 9000 has uncertainty in thousands place -> -3
    // 450 has uncertainty in tens place -> -1
    // 50 has uncertainty in tens place -> -1
    const trimmed = str.replace(/[^0-9]/g, '');
    if (trimmed.length === 0) return 0;
    
    // Count trailing zeros
    let trailingZeros = 0;
    for (let i = trimmed.length - 1; i >= 0; i--) {
        if (trimmed[i] === '0') {
            trailingZeros++;
        } else {
            break;
        }
    }
    
    // Return negative of trailing zeros count
    // Example: 9000 has 3 trailing zeros -> -3 (thousands place)
    // Example: 450 has 1 trailing zero -> -1 (tens place)
    return trailingZeros > 0 ? -trailingZeros : 0;
}

// multDiv operation
function multDiv(op, value1, uncertainty1, value2, uncertainty2, debugSteps = []) {
    debugSteps.push(`  multDiv operation: ${op}`);
    debugSteps.push(`  Input: ${value1} ± ${uncertainty1}, ${value2} ± ${uncertainty2}`);
    
    const sigfig1 = getSigFigs(value1, uncertainty1, debugSteps);
    const sigfig2 = getSigFigs(value2, uncertainty2, debugSteps);
    const sigfig = Math.min(sigfig1, sigfig2);
    
    debugSteps.push(`  Sig figs: ${sigfig1} and ${sigfig2}, using min: ${sigfig}`);
    
    let total;
    if (op === 'mult') {
        total = parseFloat(value1) * parseFloat(value2);
        debugSteps.push(`  Multiplication: ${value1} × ${value2} = ${total}`);
    } else {
        total = parseFloat(value1) / parseFloat(value2);
        debugSteps.push(`  Division: ${value1} ÷ ${value2} = ${total}`);
    }
    
    const relUnc1 = parseFloat(uncertainty1) / Math.abs(parseFloat(value1));
    const relUnc2 = parseFloat(uncertainty2) / Math.abs(parseFloat(value2));
    debugSteps.push(`  Relative uncertainty 1: ${uncertainty1} / ${Math.abs(parseFloat(value1))} = ${relUnc1}`);
    debugSteps.push(`  Relative uncertainty 2: ${uncertainty2} / ${Math.abs(parseFloat(value2))} = ${relUnc2}`);
    
    const totalRel = relUnc1 + relUnc2;
    debugSteps.push(`  Sum of relative uncertainties: ${relUnc1} + ${relUnc2} = ${totalRel}`);
    
    const uncertainty = Math.abs(total) * totalRel;
    debugSteps.push(`  Absolute uncertainty: ${Math.abs(total)} × ${totalRel} = ${uncertainty}`);
    
    return {
        total: preserveTrailingZeros(total),
        uncertainty: preserveTrailingZeros(uncertainty),
        sigfig: sigfig
    };
}

// addSubt operation
function addSubt(op, value1, uncertainty1, value2, uncertainty2, debugSteps = []) {
    debugSteps.push(`  addSubt operation: ${op}`);
    debugSteps.push(`  Input: ${value1} ± ${uncertainty1}, ${value2} ± ${uncertainty2}`);
    
    const decPlace1 = getDecimalPlace(value1, uncertainty1);
    const decPlace2 = getDecimalPlace(value2, uncertainty2);
    
    // Calculate the result first
    let total;
    if (op === 'add') {
        total = parseFloat(value1) + parseFloat(value2);
        debugSteps.push(`  Addition: ${value1} + ${value2} = ${total}`);
    } else {
        total = parseFloat(value1) - parseFloat(value2);
        debugSteps.push(`  Subtraction: ${value1} - ${value2} = ${total}`);
    }
    
    const uncertainty = parseFloat(uncertainty1) + parseFloat(uncertainty2);
    debugSteps.push(`  Uncertainty sum: ${uncertainty1} + ${uncertainty2} = ${uncertainty}`);
    
    // For decimal places: if one value is exact, use the other's precision
    // Otherwise, use the minimum (least precise)
    let decPlace;
    const unce1 = parseFloat(uncertainty1);
    const unce2 = parseFloat(uncertainty2);
    
    if (unce1 === 0 && unce2 > 0) {
        // First value is exact, use second's precision
        decPlace = decPlace2;
        debugSteps.push(`  First value exact, using second's decimal places: ${decPlace}`);
    } else if (unce2 === 0 && unce1 > 0) {
        // Second value is exact, use first's precision
        decPlace = decPlace1;
        debugSteps.push(`  Second value exact, using first's decimal places: ${decPlace}`);
    } else {
        // Both have uncertainty or both are exact, use minimum
        decPlace = Math.min(decPlace1, decPlace2);
        debugSteps.push(`  Decimal places: ${decPlace1} and ${decPlace2}, using min: ${decPlace}`);
    }
    
    return {
        total: preserveTrailingZeros(total),
        uncertainty: preserveTrailingZeros(uncertainty),
        decimalPlace: decPlace
    };
}

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

// Find innermost brackets
function findInnermostBrackets(expr) {
    let maxDepth = 0;
    let depth = 0;
    let start = -1;
    let end = -1;
    
    for (let i = 0; i < expr.length; i++) {
        if (expr[i] === '(') {
            depth++;
            if (depth > maxDepth) {
                maxDepth = depth;
                start = i;
                end = i;
            }
        } else if (expr[i] === ')' && depth === maxDepth && maxDepth > 0) {
            end = i;
            break;
        } else if (expr[i] === ')') {
            depth--;
        }
    }
    
    return { start, end, depth: maxDepth };
}

// Solve expression with bracket support
function solve(expression, input, debugSteps = []) {
    debugSteps.push(`=== SOLVING EXPRESSION ===`);
    debugSteps.push(`Expression: ${expression}`);
    debugSteps.push(`Input array: ${JSON.stringify(input)}`);
    
    // Recursively solve brackets
    let bracketIter = 0;
    let lastBracketResult = null;
    
    while (true) {
        bracketIter++;
        if (bracketIter > 50) {
            debugSteps.push('ERROR: Too many bracket iterations, possible infinite loop');
            break;
        }
        
        const bracket = findInnermostBrackets(expression);
        
        if (bracket.start === -1) {
            debugSteps.push('No more brackets found');
            break; // No more brackets
        }
        
        debugSteps.push(`Bracket iteration ${bracketIter}: Found brackets at positions ${bracket.start}-${bracket.end}`);
        
        // Extract content inside brackets
        const insideExpr = expression.substring(bracket.start + 1, bracket.end);
        debugSteps.push(`  Content inside brackets: "${insideExpr}"`);
        
        // Create a simplified input for the bracket content
        const bracketInput = [];
        let i = 0;
        while (i < insideExpr.length) {
            // Look for value pattern: number±number or just number
            const valueMatch = insideExpr.substring(i).match(/^([0-9.eE^]+)(?:±([0-9.eE^]+))?/);
            if (valueMatch) {
                bracketInput.push([0, valueMatch[1], valueMatch[2] ? valueMatch[2]:"0", 0]); // No brackets inside
                i += valueMatch[0].length;
            } else if ('+-*/÷×'.includes(insideExpr[i])) {
                bracketInput.push(insideExpr[i]);
                i++;
            } else {
                i++;
            }
        }
        
        debugSteps.push(`  Parsed bracket input: ${JSON.stringify(bracketInput)}`);
        
        // Solve the bracket expression
        const bracketResult = solveSimple(bracketInput, debugSteps);
        debugSteps.push(`  Bracket result: ${bracketResult.total} ± ${bracketResult.uncertainty}`);
        
        // Store the last bracket result for potential use
        lastBracketResult = bracketResult;
        
        // Replace the bracket in expression
        const before = expression.substring(0, bracket.start);
        const after = expression.substring(bracket.end + 1);
        expression = before + `${bracketResult.total}±${bracketResult.uncertainty}` + after;
        debugSteps.push(`  New expression after bracket replacement: ${expression}`);
    }
    
    // Now solve the simplified expression (no brackets)
    debugSteps.push(`Solving final expression (no brackets): ${expression}`);
        const simplifiedInput = [];
        let i = 0;
        while (i < expression.length) {
            const valueMatch = expression.substring(i).match(/^([0-9.eE^]+)(?:±([0-9.eE^]+))?/);
            if (valueMatch) {
                const normalizedValue = normalizeScientificNotation(valueMatch[1]);
                const normalizedUncertainty = valueMatch[2] ? normalizeScientificNotation(valueMatch[2]) : "0";
                simplifiedInput.push([0, normalizedValue, normalizedUncertainty, 0]);
                i += valueMatch[0].length;
            } else if ('+*/-÷×'.includes(expression[i])) {
                simplifiedInput.push(expression[i]);
                i++;
            } else {
                i++;
            }
        }
    
    debugSteps.push(`Final simplified input: ${JSON.stringify(simplifiedInput)}`);
    const result = solveSimple(simplifiedInput, debugSteps);
    
    // If the final result is just a single value (no operations performed) and we have a last bracket result,
    // return that bracket result's metadata instead
    if (simplifiedInput.length === 1 && lastBracketResult && !result.usedMultDiv && !result.usedAddSub) {
        debugSteps.push(`No operations in final solve - using bracket result metadata`);
        result.usedMultDiv = lastBracketResult.usedMultDiv;
        result.usedAddSub = lastBracketResult.usedAddSub;
        result.sigfig = lastBracketResult.sigfig;
        result.decimalPlace = lastBracketResult.decimalPlace;
    }
    
    debugSteps.push(`solveSimple returned: ${JSON.stringify(result)}`);
    return result;
}

// Solve expression without brackets (simple)
function solveSimple(input, debugSteps = []) {
    // Make a copy to modify
    const workingInput = JSON.parse(JSON.stringify(input));
    
    debugSteps.push(`Starting solveSimple with input: ${JSON.stringify(workingInput)}`);
    
    // Track what type of operations were done
    let usedMultDiv = false;
    let usedAddSub = false;
    let finalSigfig = null;
    let finalDecimalPlace = null;
    
    // Step 1: Handle multiplication and division
    let stepNum = 1;
    while (true) {
        let found = false;
        for (let i = 0; i < workingInput.length; i++) {
            if (workingInput[i] === '*' || workingInput[i] === '×' || workingInput[i] === '/' || workingInput[i] === '÷') {
                const left = workingInput[i - 1];
                const right = workingInput[i + 1];
                const op = workingInput[i] === '*' || workingInput[i] === '×' ? 'mult' : 'div';
                
                if (Array.isArray(left) && Array.isArray(right)) {
                    debugSteps.push(`Step ${stepNum}: Found ${op === 'mult' ? 'multiplication' : 'division'}`);
                    debugSteps.push(`  Left operand: ${left[1]} ± ${left[2]}`);
                    debugSteps.push(`  Right operand: ${right[1]} ± ${right[2]}`);
                    
                    const calc = multDiv(op, left[1], left[2], right[1], right[2], debugSteps);
                    usedMultDiv = true;
                    finalSigfig = calc.sigfig;
                    
                    debugSteps.push(`  Result: ${calc.total} ± ${calc.uncertainty}`);
                    debugSteps.push(`  Sigfigs for this operation: ${finalSigfig}`);
                    
                    workingInput[i - 1] = [0, calc.total, calc.uncertainty, 0];
                    workingInput.splice(i, 2);
                    found = true;
                    stepNum++;
                    debugSteps.push(`  New working input: ${JSON.stringify(workingInput)}`);
                    break;
                }
            }
        }
        if (!found) {
            debugSteps.push('No more multiplication/division operations found');
            break;
        }
    }
    
    // Step 2: Handle addition and subtraction
    while (workingInput.length > 1) {
        const left = workingInput[0];
        const operator = workingInput[1];
        const right = workingInput[2];
        
        if (Array.isArray(left) && Array.isArray(right)) {
            const op = operator === '+' ? 'add' : 'subt';
            debugSteps.push(`Step ${stepNum}: Found ${op === 'add' ? 'addition' : 'subtraction'}`);
            debugSteps.push(`  Left operand: ${left[1]} ± ${left[2]}`);
            debugSteps.push(`  Right operand: ${right[1]} ± ${right[2]}`);
            
            const calc = addSubt(op, left[1], left[2], right[1], right[2], debugSteps);
            usedAddSub = true;
            finalDecimalPlace = calc.decimalPlace;
            
            debugSteps.push(`  Result: ${calc.total} ± ${calc.uncertainty}`);
            debugSteps.push(`  Decimal places for this operation: ${finalDecimalPlace}`);
            
            workingInput[0] = [0, calc.total, calc.uncertainty, 0];
            workingInput.splice(1, 2);
            stepNum++;
            debugSteps.push(`  New working input: ${JSON.stringify(workingInput)}`);
        }
    }
    
    debugSteps.push(`Final result: ${workingInput[0][1]} ± ${workingInput[0][2]}`);
    debugSteps.push(`Operations used: Mult/Div=${usedMultDiv}, Add/Sub=${usedAddSub}`);
    
    return {
        total: workingInput[0][1],
        uncertainty: workingInput[0][2],
        sigfig: finalSigfig,
        decimalPlace: finalDecimalPlace,
        usedMultDiv,
        usedAddSub
    };
}

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
        
        return {
            value: formattedValue,
            uncertainty: formattedUnc
        };
    }
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
    
    // Debug steps array
    const debugSteps = [];
    debugSteps.push('=== COLLECTING INPUT ===');
    debugSteps.push(`Collected input array: ${JSON.stringify(input)}`);
    
    // Solve
    const expression = formExpression(input);
    debugSteps.push(`Formed expression: ${expression}`);
    
    const result = solve(expression, input, debugSteps);
    debugSteps.push(`Solve returned: ${result.total} ± ${result.uncertainty}`);
    debugSteps.push(`Result metadata - usedMultDiv: ${result.usedMultDiv}, usedAddSub: ${result.usedAddSub}, sigfig: ${result.sigfig}, decimalPlace: ${result.decimalPlace}`);
    
    // Determine if we should use sigfigs or decimal places based on operations performed
    let useDecimalPlace = false;
    let precision = 0;
    
    if (result.usedMultDiv && !result.usedAddSub) {
        // Only multiplication/division - use significant figures
        useDecimalPlace = false;
        precision = result.sigfig || Math.min(...Array.from(valuePairs).map(p => {
            const val = p.querySelector('.value-input').value;
            const unc = p.querySelector('.uncertainty-input').value;
            return getSigFigs(val, unc);
        }));
        debugSteps.push(`Using significant figures (from mult/div operations), precision: ${precision}`);
    } else if (result.usedAddSub && !result.usedMultDiv) {
        // Only addition/subtraction - use decimal places
        useDecimalPlace = true;
        precision = result.decimalPlace || Math.min(...Array.from(valuePairs).map(p => {
            const val = p.querySelector('.value-input').value;
            const unc = p.querySelector('.uncertainty-input').value;
            return getDecimalPlace(val, unc);
        }));
        debugSteps.push(`Using decimal places (from add/sub operations), precision: ${precision}`);
    } else if (result.usedMultDiv && result.usedAddSub) {
        // Mixed operations - use whatever was from the last operation
        // If we did mult/div last, use sigfigs; if add/sub last, use decimal places
        useDecimalPlace = false; // Assume mult/div takes precedence
        precision = result.sigfig || Math.min(...Array.from(valuePairs).map(p => {
            const val = p.querySelector('.value-input').value;
            const unc = p.querySelector('.uncertainty-input').value;
            return getSigFigs(val, unc);
        }));
        debugSteps.push(`Mixed operations - using significant figures, precision: ${precision}`);
    } else {
        // Fallback (shouldn't happen)
        useDecimalPlace = false;
        precision = Math.min(...Array.from(valuePairs).map(p => {
            const val = p.querySelector('.value-input').value;
            const unc = p.querySelector('.uncertainty-input').value;
            return getSigFigs(val, unc);
        }));
        debugSteps.push(`Fallback: Using significant figures, precision: ${precision}`);
    }
    
    // Round result
    debugSteps.push(`Before rounding: ${result.total} ± ${result.uncertainty}`);
    const finalResult = roundResult(result.total, result.uncertainty, precision, useDecimalPlace);
    debugSteps.push(`After rounding: ${finalResult.value} ± ${finalResult.uncertainty}`);
    
    // Display
    const resultStr = `${finalResult.value} ± ${finalResult.uncertainty}`;
    displayResult(resultStr);
    displaySteps(debugSteps);
    
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
function displaySteps(debugSteps) {
    const explanationContent = document.getElementById('explanationContent');
    explanationContent.innerHTML = '';
    
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step';
    stepDiv.innerHTML = `
        <div class="step-title">Step-by-Step Calculation & Debug Info</div>
        <div class="step-content"><pre>${debugSteps.join('\n')}</pre></div>
    `;
    explanationContent.appendChild(stepDiv);
}

// Theme management
const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('.theme-icon');

function getTheme() {
    return localStorage.getItem('theme') || 'light';
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    const currentTheme = getTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Initialize theme
setTheme(getTheme());

// Value pair management
let valuePairCount = 0;

function addValuePair() {
    newValues++;
    valuePairCount++;
    const inputSection = document.getElementById('inputSection');
    
    // Create value pair container
    const valuePairDiv = document.createElement('div');
    valuePairDiv.className = 'value-pair';
    valuePairDiv.id = `valuePair${valuePairCount}`;
    
    // If this is not the first pair, add operator selector
    if (valuePairCount > 1) {
        const operatorDiv = document.createElement('div');
        operatorDiv.className = 'operator-between';
        operatorDiv.innerHTML = `
            <select class="operator-select" data-pair="${valuePairCount}">
                <option value="+">+</option>
                <option value="-">-</option>
                <option value="*">×</option>
                <option value="/">÷</option>
            </select>
        `;
        inputSection.appendChild(operatorDiv);
    }
    
    // Create value inputs with visible bracket buttons
    valuePairDiv.innerHTML = `
        <button class="bracket-btn" onclick="toggleBracket(${valuePairCount})" title="Click to cycle through 0-3 opening brackets" data-pair="${valuePairCount}" data-count="0">(</button>
        <div class="value-inputs">
            <div class="input-group">
                <label>Value ${valuePairCount}</label>
                <input type="text" class="value-input" placeholder="Enter value" step="any">
            </div>
            <div class="input-group">
                <label>± Uncertainty (optional)</label>
                <input type="text" class="uncertainty-input" placeholder="Enter uncertainty (or leave blank for exact)" step="any">
            </div>
        </div>
        <button class="bracket-btn close" onclick="toggleCloseBracket(${valuePairCount})" title="Click to cycle through 0-3 closing brackets" data-pair="${valuePairCount}" data-count="0">)</button>
        ${valuePairCount > 2 ? `<button class="remove-btn" onclick="removeValuePair(${valuePairCount})" title="Remove this value">×</button>` : ''}
    `;
    
    // Make bracket buttons always visible
    const bracketBtns = valuePairDiv.querySelectorAll('.bracket-btn');
    bracketBtns.forEach(btn => {
        btn.style.visibility = 'visible';
    });
    
    inputSection.appendChild(valuePairDiv);
}

function removeValuePair(pairIndex) {
    const pairToRemove = document.getElementById(`valuePair${pairIndex}`);
    const operatorBefore = pairToRemove.previousElementSibling;
    
    // Remove value pair and its operator
    if (operatorBefore && operatorBefore.classList.contains('operator-between')) {
        operatorBefore.remove();
    }
    pairToRemove.remove();
    
    // Recalculate and update button visibilities
    updateRemoveButtons();
}

function updateRemoveButtons() {
    const valuePairs = document.querySelectorAll('.value-pair');
    valuePairs.forEach((pair, index) => {
        const removeBtn = pair.querySelector('.remove-btn');
        if (removeBtn) {
            // Show remove button only if there are more than 2 pairs
            if (valuePairs.length > 2) {
                removeBtn.style.display = 'block';
            } else {
                removeBtn.style.display = 'none';
            }
        }
    });
}

function toggleBracket(pairIndex) {
    const pair = document.getElementById(`valuePair${pairIndex}`);
    const btn = pair.querySelector('.bracket-btn:not(.close)');
    
    // Get current bracket count from attribute or default to 0
    let count = parseInt(btn.getAttribute('data-count') || '0');
    
    // Cycle through 0 -> 1 -> 2 -> 3 -> 0
    count = (count + 1) % 4;
    
    // Update count attribute
    btn.setAttribute('data-count', count.toString());
    
    // Update button text to show number of brackets
    if (count === 0) {
        btn.textContent = '(';
        btn.classList.remove('active');
    } else {
        btn.textContent = '('.repeat(count);
        btn.classList.add('active');
    }
}

function toggleCloseBracket(pairIndex) {
    const pair = document.getElementById(`valuePair${pairIndex}`);
    const btn = pair.querySelector('.bracket-btn.close');
    
    // Get current bracket count from attribute or default to 0
    let count = parseInt(btn.getAttribute('data-count') || '0');
    
    // Cycle through 0 -> 1 -> 2 -> 3 -> 0
    count = (count + 1) % 4;
    
    // Update count attribute
    btn.setAttribute('data-count', count.toString());
    
    // Update button text to show number of brackets
    if (count === 0) {
        btn.textContent = ')';
        btn.classList.remove('active');
    } else {
        btn.textContent = ')'.repeat(count);
        btn.classList.add('active');
    }
}

// Initialize with 2 value pairs
addValuePair();
addValuePair();

// Update the remove button visibility
updateRemoveButtons();

// Input mode switching
function switchInputMode(mode) {
    const uiMode = document.getElementById('uiInputMode');
    const textMode = document.getElementById('textInputMode');
    const uiBtn = document.getElementById('uiModeBtn');
    const textBtn = document.getElementById('textModeBtn');
    
    if (mode === 'ui') {
        uiMode.style.display = 'block';
        textMode.style.display = 'none';
        uiBtn.classList.add('active');
        textBtn.classList.remove('active');
    } else {
        uiMode.style.display = 'none';
        textMode.style.display = 'block';
        uiBtn.classList.remove('active');
        textBtn.classList.add('active');
        document.getElementById('textExpression').focus();
    }
}

// Parse text expression into input format
function parseTextExpression(text) {
    const debugSteps = [];
    debugSteps.push(`Parsing text: "${text}"`);
    
    // Clean up the text
    let cleaned = text
        .replace(/\s+/g, ' ')  // Normalize spaces
        .replace(/\s*±\s*/g, '±')  // Remove spaces around ±
        .replace(/\s*\+\s*/g, '+')  // Remove spaces around +
        .replace(/\s*-\s*/g, '-')  // Remove spaces around -
        .replace(/\s*\*\s*/g, '*')  // Remove spaces around *
        .replace(/\s*×\s*/g, '*')  // Normalize × to *
        .replace(/\s*\//g, '/')  // Remove spaces before /
        .replace(/\/\s*/g, '/')  // Remove spaces after /
        .replace(/\s*÷\s*/g, '/')  // Normalize ÷ to /
        .trim();
    
    debugSteps.push(`Cleaned text: "${cleaned}"`);
    
    // Convert expression to standard format: add ±0 to values without uncertainty
    // and keep brackets as-is
    let exprString = cleaned;
    
    // Build expression string with proper formatting
    let result = '';
    let i = 0;
    
    while (i < exprString.length) {
        // Try to match a value
        const valueMatch = exprString.substring(i).match(/^(-?[0-9.eE^]+)(?:±([0-9.eE^]+))?/);
        
        if (valueMatch) {
            const value = normalizeScientificNotation(valueMatch[1]);
            const uncertainty = valueMatch[2] ? normalizeScientificNotation(valueMatch[2]) : "0";
            result += `${value}±${uncertainty}`;
            i += valueMatch[0].length;
            debugSteps.push(`  Found value: ${value} ± ${uncertainty}`);
            continue;
        }
        
        // Match operators and brackets - keep as-is
        if ('+-*/()'.includes(exprString[i])) {
            result += exprString[i];
            if (exprString[i] === '+' || exprString[i] === '-' || exprString[i] === '*' || exprString[i] === '/') {
                debugSteps.push(`  Found operator: ${exprString[i]}`);
            } else {
                debugSteps.push(`  Found bracket: ${exprString[i]}`);
            }
            i++;
            continue;
        }
        
        // Skip whitespace
        i++;
    }
    
    debugSteps.push(`Converted expression: "${result}"`);
    
    return { parsedInput: [], rawExpression: result };
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
        debugSteps.push('=== COLLECTING INPUT ===');
        debugSteps.push(`Raw expression: ${parseResult.rawExpression}`);
        
        const result = solve(parseResult.rawExpression, [], debugSteps);
        debugSteps.push(`Solve returned: ${result.total} ± ${result.uncertainty}`);
        debugSteps.push(`Result metadata - usedMultDiv: ${result.usedMultDiv}, usedAddSub: ${result.usedAddSub}, sigfig: ${result.sigfig}, decimalPlace: ${result.decimalPlace}`);
        
        // For now, use simplified precision logic
        let useDecimalPlace = false;
        let precision = 0;
        
        if (result.usedMultDiv && !result.usedAddSub) {
            useDecimalPlace = false;
            precision = result.sigfig || 999;
            debugSteps.push(`Using significant figures, precision: ${precision}`);
        } else if (result.usedAddSub && !result.usedMultDiv) {
            useDecimalPlace = true;
            precision = result.decimalPlace || 0;
            debugSteps.push(`Using decimal places, precision: ${precision}`);
        } else {
            useDecimalPlace = false;
            precision = result.sigfig || 999;
            debugSteps.push(`Mixed operations - using significant figures, precision: ${precision}`);
        }
        
        // Round result
        debugSteps.push(`Before rounding: ${result.total} ± ${result.uncertainty}`);
        const finalResult = roundResult(result.total, result.uncertainty, precision, useDecimalPlace);
        debugSteps.push(`After rounding: ${finalResult.value} ± ${finalResult.uncertainty}`);
        
        // Display
        const resultStr = `${finalResult.value} ± ${finalResult.uncertainty}`;
        displayResult(resultStr);
        displaySteps(debugSteps);
        
        // Show result section
        document.getElementById('resultSection').style.display = 'block';
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        alert('Error parsing expression: ' + error.message);
        console.error(error);
    }
}

// Insert symbol into text expression input
function insertSymbol(symbol) {
    const textInput = document.getElementById('textExpression');
    const cursorPos = textInput.selectionStart;
    const textBefore = textInput.value.substring(0, cursorPos);
    const textAfter = textInput.value.substring(textInput.selectionEnd);
    
    textInput.value = textBefore + symbol + textAfter;
    
    // Place cursor after inserted symbol
    textInput.selectionStart = textInput.selectionEnd = cursorPos + symbol.length;
    textInput.focus();
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

