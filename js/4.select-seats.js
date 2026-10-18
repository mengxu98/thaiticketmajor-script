(() => {
    const requiredSeats = 1;
    const maxAttempts = 5;
    const selectionTimeout = 2000;
    let timer, resume;
    window.ttmSeatSelector?.stop();
    const state = window.ttmSeatSelector = {
        running: true,
        selectedSeats: [],
        stop() {
            state.running = false;
            clearTimeout(timer);
            resume?.();
        }
    };
    const wait = ms => new Promise(resolve => {
        resume = resolve;
        if (state.running) timer = setTimeout(resolve, ms);
        else resolve();
    });
    const rejected = new Set();

    function isVisible(element) {
        if (!element) return false;
        for (let node = element; node; node = node.parentElement) {
            const style = window.getComputedStyle(node);
            if (node.hidden || node.getAttribute('aria-hidden') === 'true' ||
                style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)) return false;
        }
        return true;
    }

    function activeAlert() {
        return [...document.querySelectorAll("button.btn-red.w-auto[onclick='MessageClose()']")].find(isVisible);
    }

    function findSeats(table) {
        for (const row of table.querySelectorAll('tbody tr')) {
            const seats = [];
            for (const cell of row.querySelectorAll('td')) {
                const seat = cell.querySelector('div.seatuncheck');
                const id = cell.getAttribute('title');
                if (!seat || cell.classList.contains('not-available') ||
                    !/^[^-]+-\d+$/.test(id) || seat.id !== `checkseat-${id}`) {
                    seats.length = 0;
                    continue;
                }
                seats.push(id);
                if (seats.length > requiredSeats) seats.shift();
                const numbers = seats.map(value => Number(value.split('-')[1])).sort((a, b) => a - b);
                if (seats.length === requiredSeats && !rejected.has(seats.join(',')) &&
                    seats.every((value, i) => value.split('-')[0] === seats[0].split('-')[0] &&
                        numbers[i] === numbers[0] + i)) return seats;
            }
        }
        return [];
    }

    async function run() {
        if (!Number.isSafeInteger(requiredSeats) || requiredSeats < 1) {
            console.warn('requiredSeats must be a positive integer.');
            return;
        }
        for (let attempt = 0; state.running && attempt < maxAttempts; attempt++) {
            const table = document.querySelector('#tableseats');
            if (!table || table.querySelector('.seatchecked') || activeAlert()) {
                console.warn('Open the seat page with no existing selection or visible dialog before running.');
                return;
            }
            const seats = findSeats(table);
            if (seats.length) {
                for (const seat of seats) {
                    if (!state.running) return;
                    if (activeAlert()) break;
                    document.getElementById(`checkseat-${seat}`).click();
                }
                let stable = 0;
                let alert;
                const deadline = Date.now() + selectionTimeout;
                while (state.running && Date.now() < deadline) {
                    await wait(100);
                    if (!state.running) return;
                    alert = activeAlert();
                    if (alert) break;
                    const selected = seats.every(seat =>
                        document.getElementById(`checkseat-${seat}`)?.classList.contains('seatchecked'));
                    stable = selected && table.querySelectorAll('.seatchecked').length === requiredSeats ? stable + 1 : 0;
                    if (stable === 3) break;
                }
                if (!state.running) return;
                if (stable === 3) {
                    const confirm = document.querySelector('#bookmnow');
                    if (!isVisible(confirm) || confirm.matches(':disabled, [disabled], .disabled, [aria-disabled="true"]')) {
                        console.warn('Confirmation button is missing, hidden or disabled. Check the page manually.');
                        return;
                    }
                    state.selectedSeats = seats;
                    confirm.click();
                    await wait(500);
                    if (state.running) console.log(activeAlert() ?
                        'Confirmation opened a dialog. Check the page manually.' :
                        'Confirmation clicked. Check the booking status on the page.');
                    return;
                }
                if (alert) alert.click();
                for (const seat of seats) {
                    if (!state.running) return;
                    const element = document.getElementById(`checkseat-${seat}`);
                    if (element?.classList.contains('seatchecked')) element.click();
                }
                rejected.add(seats.join(','));
            }
            if (attempt < maxAttempts - 1) await wait(Math.min(500 * 2 ** attempt, 4000));
        }
        if (state.running) console.warn('Seat search stopped after the attempt limit.');
    }

    run().catch(error => console.error('Seat selection failed:', error)).finally(() => state.stop());
})();
