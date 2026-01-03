// ui.js - UI wiring helpers (theme, rounding controls, value-pair management)
(function(window){
    'use strict';

    // Theme management
    function getTheme() {
        return localStorage.getItem('theme') || 'light';
    }

    function setTheme(theme) {
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = themeToggle ? themeToggle.querySelector('.theme-icon') : null;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    function toggleTheme() {
        const currentTheme = getTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }

    // Show/hide custom rounding input based on selection
    function toggleRoundingControls() {
        const sel = document.getElementById('roundModeSelect');
        const input = document.getElementById('roundCustomInput');
        const helper = document.getElementById('roundHelper');
        if (!sel || !input) return;
        if (sel.value === 'auto') {
            input.style.display = 'none';
            if (helper) {
                helper.style.visibility = 'hidden';
                helper.style.opacity = '0';
                helper.style.pointerEvents = 'none';
            }
        } else {
            input.style.display = 'inline-block';
            input.placeholder = sel.value === 'sigfig' ? 'Significant figures' : 'Decimal places';
            if (helper) {
                if (sel.value === 'decimals') {
                    helper.style.visibility = 'visible';
                    helper.style.opacity = '1';
                    helper.style.pointerEvents = 'auto';
                } else {
                    helper.style.visibility = 'hidden';
                    helper.style.opacity = '0';
                    helper.style.pointerEvents = 'none';
                }
            }
        }
    }

    // Value pair management
    window.valuePairCount = window.valuePairCount || 0;

    function addValuePair() {
        // Mirror the original behavior in script.js
        if (typeof window.newValues === 'undefined') window.newValues = 0;
        window.newValues++;
        window.valuePairCount++;
        const valuePairCount = window.valuePairCount;
        const inputSection = document.getElementById('inputSection');
        if (!inputSection) return;

        const valuePairDiv = document.createElement('div');
        valuePairDiv.className = 'value-pair';
        valuePairDiv.id = `valuePair${valuePairCount}`;

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

        const bracketBtns = valuePairDiv.querySelectorAll('.bracket-btn');
        bracketBtns.forEach(btn => {
            btn.style.visibility = 'visible';
        });

        inputSection.appendChild(valuePairDiv);
    }

    function removeValuePair(pairIndex) {
        const pairToRemove = document.getElementById(`valuePair${pairIndex}`);
        if (!pairToRemove) return;
        const operatorBefore = pairToRemove.previousElementSibling;
        if (operatorBefore && operatorBefore.classList.contains('operator-between')) {
            operatorBefore.remove();
        }
        pairToRemove.remove();
        updateRemoveButtons();
    }

    function updateRemoveButtons() {
        const valuePairs = document.querySelectorAll('.value-pair');
        valuePairs.forEach((pair, index) => {
            const removeBtn = pair.querySelector('.remove-btn');
            if (removeBtn) {
                if (valuePairs.length > 2) {
                    removeBtn.style.display = 'block';
                } else {
                    removeBtn.style.display = 'none';
                }
            }
        });
    }

    // Initialize UI on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        try { toggleRoundingControls(); } catch (e) {}
        // Initialize theme
        try { setTheme(getTheme()); } catch (e) {}
        // Initialize two value pairs
        try { addValuePair(); addValuePair(); updateRemoveButtons(); } catch (e) {}
    });

    // Export selected functions under a single namespace to avoid collisions
    window._ui = window._ui || {};
    window._ui.getTheme = getTheme;
    window._ui.setTheme = setTheme;
    window._ui.toggleTheme = toggleTheme;
    window._ui.toggleRoundingControls = toggleRoundingControls;
    window._ui.addValuePair = addValuePair;
    window._ui.removeValuePair = removeValuePair;
    window._ui.updateRemoveButtons = updateRemoveButtons;

    // Bracket toggles for value pairs
    function toggleBracket(pairIndex) {
        const pair = document.getElementById(`valuePair${pairIndex}`);
        if (!pair) return;
        const btn = pair.querySelector('.bracket-btn:not(.close)');
        let count = parseInt(btn.getAttribute('data-count') || '0');
        count = (count + 1) % 4;
        btn.setAttribute('data-count', count.toString());
        if (count === 0) { btn.textContent = '('; btn.classList.remove('active'); }
        else { btn.textContent = '('.repeat(count); btn.classList.add('active'); }
    }

    function toggleCloseBracket(pairIndex) {
        const pair = document.getElementById(`valuePair${pairIndex}`);
        if (!pair) return;
        const btn = pair.querySelector('.bracket-btn.close');
        let count = parseInt(btn.getAttribute('data-count') || '0');
        count = (count + 1) % 4;
        btn.setAttribute('data-count', count.toString());
        if (count === 0) { btn.textContent = ')'; btn.classList.remove('active'); }
        else { btn.textContent = ')'.repeat(count); btn.classList.add('active'); }
    }

    // Input mode switching (UI vs Text)
    function switchInputMode(mode) {
        const uiMode = document.getElementById('uiInputMode');
        const textMode = document.getElementById('textInputMode');
        const uiBtn = document.getElementById('uiModeBtn');
        const textBtn = document.getElementById('textModeBtn');
        if (!uiMode || !textMode || !uiBtn || !textBtn) return;
        if (mode === 'ui') {
            uiMode.style.display = 'block'; textMode.style.display = 'none'; uiBtn.classList.add('active'); textBtn.classList.remove('active');
        } else {
            uiMode.style.display = 'none'; textMode.style.display = 'block'; uiBtn.classList.remove('active'); textBtn.classList.add('active');
            const txt = document.getElementById('textExpression'); if (txt) txt.focus();
        }
    }

    // Parse text expression into a normalized string (adds ±0 where missing)
    function parseTextExpression(text) {
        const debugSteps = [];
        debugSteps.push(`Parsing text: "${text}"`);
        let cleaned = text
            .replace(/\s+/g, ' ')
            .replace(/\s*±\s*/g, '±')
            .replace(/\s*\+\s*/g, '+')
            .replace(/\s*-\s*/g, '-')
            .replace(/\s*\*\s*/g, '*')
            .replace(/\s*×\s*/g, '*')
            .replace(/\s*\/\s*/g, '/')
            .replace(/\s*÷\s*/g, '/')
            .trim();
        debugSteps.push(`Cleaned text: "${cleaned}"`);
        let exprString = cleaned;
        let result = '';
        let i = 0;
        while (i < exprString.length) {
            const valueMatch = exprString.substring(i).match(/^(-?[0-9.eE^]+)(?:±([0-9.eE^]+))?/);
            if (valueMatch) {
                const value = valueMatch[1]; const uncertainty = valueMatch[2] ? valueMatch[2] : "0";
                result += `${value}±${uncertainty}`; i += valueMatch[0].length; debugSteps.push(`  Found value: ${value} ± ${uncertainty}`); continue;
            }
            if ('+-*/()'.includes(exprString[i])) {
                result += exprString[i];
                if ('+-*/'.includes(exprString[i])) debugSteps.push(`  Found operator: ${exprString[i]}`); else debugSteps.push(`  Found bracket: ${exprString[i]}`);
                i++; continue;
            }
            i++;
        }
        debugSteps.push(`Converted expression: "${result}"`);
        return { parsedInput: [], rawExpression: result };
    }

    // Insert symbol into text expression input
    function insertSymbol(symbol) {
        const textInput = document.getElementById('textExpression');
        if (!textInput) return;
        const cursorPos = textInput.selectionStart;
        const textBefore = textInput.value.substring(0, cursorPos);
        const textAfter = textInput.value.substring(textInput.selectionEnd);
        textInput.value = textBefore + symbol + textAfter;
        textInput.selectionStart = textInput.selectionEnd = cursorPos + symbol.length;
        textInput.focus();
    }

    // Keypress handling for Enter -> calculate in appropriate mode
    document.addEventListener('keypress', function(event) {
        const textInput = document.getElementById('textExpression');
        if (document.activeElement === textInput && event.key === 'Enter') {
            if (typeof window.calculateFromText === 'function') window.calculateFromText();
        } else if (event.key === 'Enter' && document.getElementById('uiInputMode').style.display !== 'none') {
            if (typeof window.calculate === 'function') window.calculate();
        }
    });

    // Export additional UI functions
    window._ui.toggleBracket = toggleBracket;
    window._ui.toggleCloseBracket = toggleCloseBracket;
    window._ui.switchInputMode = switchInputMode;
    window._ui.parseTextExpression = parseTextExpression;
    window._ui.insertSymbol = insertSymbol;

})(window);
