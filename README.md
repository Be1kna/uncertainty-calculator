# Uncertainty Calculator

A powerful, educational physics tool for calculating uncertainty propagation with step-by-step explanations.

## Features

- **Four Operations**: Support for addition, subtraction, multiplication, and division with uncertainties
- **Accurate Propagation**: Implements standard uncertainty propagation rules
- **Step-by-Step Explanations**: Shows detailed calculations for each operation
- **Light/Dark Theme**: Toggle between themes for comfortable viewing
- **Precision Handling**: Automatically rounds results to match uncertainty precision

## How to Use

1. Enter the first value and its uncertainty (±)
2. Select the operation (addition, subtraction, multiplication, or division)
3. Enter the second value and its uncertainty (±)
4. Click "Calculate" to see the result and step-by-step explanation

## Uncertainty Propagation Rules

### Addition/Subtraction
For z = x ± y, the uncertainty is calculated as:
```
δz = √(δx² + δy²)
```

### Multiplication/Division
For z = x × y or z = x ÷ y, the relative uncertainty is:
```
δz/z = √((δx/x)² + (δy/y)²)
```
Then the absolute uncertainty is: δz = |z| × (δz/z)

## Example

**Input:**
- x = 10.5 ± 0.2
- Operator: Multiplication
- y = 3.8 ± 0.1

**Steps:**
1. Calculate result: 10.5 × 3.8 = 39.9
2. Calculate relative uncertainties: 0.0190 and 0.0263
3. Combine relative uncertainties: √(0.0190² + 0.0263²) = 0.0326
4. Calculate absolute uncertainty: 39.9 × 0.0326 = 1.30
5. **Final Answer**: 39.9 ± 1.30

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

