// helpers.js - small utility functions moved out of script.js for easier navigation
(function(window) {
    'use strict';

    window.repeatStr = function (str, n) {
        return n > 0 ? str.repeat(n) : '';
    };

    window.preserveTrailingZeros = function (num) {
        return num.toString();
    };

    // Determine significant figures from number string and optional uncertainty string
    window.getSigFigs = function (numStr, uncertaintyStr = null) {
        const str = numStr.toString();
        let count = 0;
        let hasDecimal = str.includes('.');
        let foundNonZero = false;
        let pastDecimal = false;
        for (let char of str) {
            if (char === '-' || char === '+') continue;
            if (char === '.') { pastDecimal = true; continue; }
            if (char !== '0') { foundNonZero = true; count++; }
            else if (foundNonZero || (hasDecimal && pastDecimal)) { count++; }
        }
        let stringBasedSigfigs = count || 1;
        if (uncertaintyStr) {
            let value = parseFloat(str);
            let uncertainty = parseFloat(uncertaintyStr);
            if (uncertainty === 0) {
                const hasDecimalPoint = str.includes('.');
                if (!hasDecimalPoint) return 999;
                else return stringBasedSigfigs;
            }
            if (uncertainty > 0) {
                const uncertaintyAbs = Math.abs(uncertainty);
                const orderUnc = Math.floor(Math.log10(uncertaintyAbs));
                const orderVal = Math.floor(Math.log10(Math.abs(value || 0.1)));
                const diff = orderVal - orderUnc;
                const uncertaintyBasedSigfigs = Math.max(1, diff + 1);
                return uncertaintyBasedSigfigs;
            }
        }
        return stringBasedSigfigs;
    };

    // Determine decimal place from number string and optional uncertainty string
    window.getDecimalPlace = function (numStr, uncertaintyStr = null) {
        const str = numStr.toString();
        let value = parseFloat(str);
        let uncertainty = uncertaintyStr ? parseFloat(uncertaintyStr) : null;
        if (uncertainty !== null && uncertainty > 0) {
            const uncertaintyAbs = Math.abs(uncertainty);
            if (uncertaintyAbs === 0) return 0;
            const order = Math.floor(Math.log10(uncertaintyAbs));
            const uncertaintyStr2 = uncertaintyAbs.toExponential();
            const parts = uncertaintyStr2.split('e');
            const coefficient = parseFloat(parts[0]);
            const roundedCoeff = Math.round(coefficient);
            const finalOrder = order + (Math.log10(coefficient) - Math.log10(roundedCoeff));
            return -Math.round(finalOrder);
        }
        if (str.includes('.')) {
            const parts = str.split('.');
            return parts[1].length;
        }
        const trimmed = str.replace(/[^0-9]/g, '');
        if (trimmed.length === 0) return 0;
        let trailingZeros = 0;
        for (let i = trimmed.length - 1; i >= 0; i--) {
            if (trimmed[i] === '0') trailingZeros++; else break;
        }
        return trailingZeros > 0 ? -trailingZeros : 0;
    };

    // Simple numeric expression evaluator using Function constructor
    window.evaluateNumericExpression = function (expr) {
        try {
            const safeExpr = expr.replace(/×/g, '*').replace(/÷/g, '/');
            const fn = new Function('return (' + safeExpr + ')');
            return Number(fn());
        } catch (e) {
            return NaN;
        }
    };

    // Format number for debug output
    window.formatDebugNumber = function (n) {
        const num = Number(n);
        if (!isFinite(num)) return String(n);
        try {
            const p = parseFloat(num.toPrecision(10));
            return String(p);
        } catch (e) { return String(num); }
    };

})(window);
