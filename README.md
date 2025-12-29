# Uncertainty Calculator

A powerful, educational physics tool for calculating uncertainty propagation with step-by-step explanations.

## Features

- **Four Operations**: Support for addition, subtraction, multiplication, and division with uncertainties
- **Accurate Propagation**: Implements standard uncertainty propagation rules
- **Step-by-Step Explanations**: Shows detailed calculations for each operation
- **Light/Dark Theme**: Toggle between themes for comfortable viewing
- **Precision Handling**: Automatically rounds results to match uncertainty precision (or use the Rounding control to override with custom sig figs or decimal places)

## How to Use

1. Enter the first value and its uncertainty (±)
2. Select the operation (addition, subtraction, multiplication, or division)
3. Enter the second value and its uncertainty (±)
4. Click "Calculate" to see the result and step-by-step explanation

## Uncertainty Propagation Rules

### Addition/Subtraction
For z = x ± y, the uncertainty is calculated as:
```
δz = δx + δy  (this calculator uses direct addition of absolute uncertainties)
```

### Multiplication/Division
For z = x × y or z = x ÷ y, the relative uncertainty is:
```
δz/z = (δx/|x|) + (δy/|y|)  (this calculator sums relative uncertainties)
```
Then the absolute uncertainty is: δz = |z| × (δz/z)

## Actual Value (Max–Min) Mode

This calculator includes an "Actual Value" mode that computes the range of possible results by selecting, for each measured value a±Δa, either a+Δa or a−Δa depending on which makes the overall expression larger or smaller. Use this mode for a quick min→max range when a full propagation is not desired.

Note: Results are shown in two formats for clarity — an uncertainty-style line (midpoint ± half-range) and a rounded min→max range. Rounding follows the same rules as the standard propagation (sig figs for multiplication/division, decimal places for addition/subtraction) and can be overridden with the Rounding control.

## Rounding Override

Use the Rounding control to force either a specific number of significant figures or decimal places. Decimal-place rounding accepts non-positive integers (e.g., 0 for whole numbers, -1 for tens, -2 for hundreds).

## Example

**Input:**
- x = 10.5 ± 0.2
- Operator: Multiplication
- y = 3.8 ± 0.1

**Steps:**
1. Calculate result: 10.5 × 3.8 = 39.9
2. Calculate relative uncertainties: 0.0190 and 0.0263
3. Combine relative uncertainties: 0.0190 + 0.0263 = 0.0453 (this calculator sums relative uncertainties)
4. Calculate absolute uncertainty: 39.9 × 0.0453 = 1.81
5. **Final Answer**: 39.9 ± 1.81

## Technology

- Pure HTML, CSS, and JavaScript
- No dependencies required
- Responsive design for mobile and desktop

## Accessibility

- Keyboard support (Enter key to calculate)
- Theme toggle for comfortable viewing
- Clear visual feedback

---

Built with ❤️ for physics education

