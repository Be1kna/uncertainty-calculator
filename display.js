// Display steps implementation moved out of script.js
(function(){
    // Display the calculation steps in the explanation area
    function displayStepsImpl(debugSteps) {
        const explanationContent = document.getElementById('explanationContent');
        if (!explanationContent) return;
        explanationContent.innerHTML = '';
        // Accept either an array of step-block strings or array of individual lines.
        // Normalize into an array of lines.
        const lines = [];
        for (const item of debugSteps) {
            if (typeof item === 'string') {
                const parts = item.split('\n');
                for (const p of parts) lines.push(p);
            } else {
                try { lines.push(String(item)); } catch (e) { /* ignore */ }
            }
        }

        // Group lines into blocks. Prefer explicit 'Step N:' headers; otherwise split on blank lines.
        // If a block starts with a Step header, preserve blank lines inside that block
        const blocks = [];
        let current = [];
        const headerRe = /^Step\s*\d+\s*[:\-]?/i;

        for (let i = 0; i < lines.length; i++) {
            const lineRaw = lines[i];
            const line = lineRaw.trimEnd();
            if (headerRe.test(line)) {
                if (current.length) { blocks.push(current); current = []; }
                current.push(line);
            } else if (line === '') {
                // If current block starts with a Step header, keep blank lines inside it
                if (current.length && headerRe.test(current[0])) {
                    current.push('');
                } else {
                    if (current.length) { blocks.push(current); current = []; }
                }
            } else {
                if (!current.length) {
                    // start a new implicit block
                    current.push(line);
                } else {
                    current.push(line);
                }
            }
        }
        if (current.length) blocks.push(current);

        // Render each block as its own boxed step
        blocks.forEach((blk, idx) => {
            const box = document.createElement('div');
            box.className = 'step-box';

            // Determine step number if header present
            const headerRe = /^Step\s*(\d+)/i;
            let stepNumber = null;
            let firstLine = blk[0] || '';
            const headerMatch = (firstLine || '').match(headerRe);
            if (headerMatch) stepNumber = headerMatch[1];

            // Look for operation descriptor lines like "Next operation: Addition" or "First operation: Division"
            const opRe = /(?:Next|First)\s*operation\s*[:\-]?\s*(Addition|Subtraction|Multiplication|Division)/i;
            let opName = null;
            let opLineIndex = -1;
            for (let i = 0; i < blk.length; i++) {
                const m = blk[i].match(opRe);
                if (m) {
                    opName = m[1];
                    opLineIndex = i;
                    break;
                }
            }

            // Build title: prefer "Step N: <OpName>" when detected, otherwise use the block's first line
            const title = document.createElement('div');
            title.className = 'step-box-title';
            if (opName && stepNumber) {
                title.textContent = `Step ${stepNumber}: ${opName}`;
            } else if (firstLine) {
                title.textContent = firstLine;
            } else {
                title.textContent = `Step ${idx + 1}`;
            }
            box.appendChild(title);

            // Prepare body lines: start with all lines except the header line (if it exists)
            let bodyLines = blk.slice(headerMatch ? 1 : 0).slice();

            // If we removed an 'operation' descriptor line, also remove that from body so it doesn't repeat
            if (opLineIndex >= 0) {
                // Adjust index if header was removed from the start
                const adjustIndex = headerMatch ? opLineIndex - 1 : opLineIndex;
                if (adjustIndex >= 0 && adjustIndex < bodyLines.length) bodyLines.splice(adjustIndex, 1);
            }

            // Trim leading/trailing blank lines from body for cleanliness
            while (bodyLines.length && bodyLines[0].trim() === '') bodyLines.shift();
            while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();

            const body = document.createElement('div');
            body.className = 'step-box-body';
            const pre = document.createElement('pre');
            pre.textContent = bodyLines.join('\n');
            body.appendChild(pre);
            box.appendChild(body);

            explanationContent.appendChild(box);
        });
    }

    // attach to window under a non-conflicting name
    if (typeof window !== 'undefined') {
        window._displaySteps = displayStepsImpl;
    }
})();
