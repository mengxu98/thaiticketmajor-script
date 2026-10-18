import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = name => fs.readFileSync(new URL(`../js/${name}.js`, import.meta.url), 'utf8');
const seatsSource = source('4.select-seats');

function makeClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const schedule = (fn, delay = 0, interval = 0) => {
    const id = ++nextId;
    timers.set(id, { fn, due: now + delay, interval });
    return id;
  };
  return {
    timers,
    get now() { return now; },
    setTimeout: (fn, delay) => schedule(fn, delay),
    setInterval: (fn, delay) => schedule(fn, delay, delay),
    clearTimeout: id => timers.delete(id),
    clearInterval: id => timers.delete(id),
    async advance(ms) {
      const end = now + ms;
      for (let steps = 0; steps < 10000; steps++) {
        for (let i = 0; i < 5; i++) await Promise.resolve();
        const entry = [...timers].filter(([, timer]) => timer.due <= end)
          .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (!entry) { now = end; return; }
        const [id, timer] = entry;
        now = timer.due;
        if (timer.interval) timer.due += timer.interval;
        else timers.delete(id);
        timer.fn();
      }
      throw new Error('Timer limit exceeded');
    },
  };
}

function page(t, html) {
  const dom = new JSDOM(html);
  const clock = makeClock();
  const errors = [];
  const logs = [];
  const counts = { seat: 0, confirm: 0, alert: 0, reload: 0 };
  const { window } = dom;
  for (const method of ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval']) {
    window[method] = clock[method];
  }
  window.addEventListener('error', event => { errors.push(event.error); event.preventDefault(); });
  const context = vm.createContext({
    window, document: window.document, Event: window.Event,
    MutationObserver: window.MutationObserver,
    Date: { now: () => clock.now },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval, clearInterval: clock.clearInterval,
    location: { reload: () => counts.reload++ },
    console: Object.fromEntries(['log', 'warn', 'error'].map(level =>
      [level, (...args) => logs.push({ level, text: args.join(' ') })])),
  });
  const result = {
    window, doc: window.document, clock, context, counts, logs,
    evaluate: text => vm.runInContext(text, context),
    advance: ms => clock.advance(ms),
  };
  t.after(() => {
    dom.window.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(logs.filter(log => log.level === 'error' &&
      !result.expectedError?.test(log.text)), []);
  });
  return result;
}

function seatPage(t, opts = {}) {
  const rows = opts.rows ?? [{ label: 'AA', seats: ['03'] }];
  const html = rows.map(row => `<tr><td>${row.label}</td>${row.seats.map(num =>
    `<td title="${row.label}-${num}"><div id="checkseat-${row.label}-${num}" class="seatuncheck"></div></td>`
  ).join('')}</tr>`).join('');
  const p = page(t, `${opts.table === false ? '' : `<table id="tableseats"><tbody>${html}</tbody></table>`}
    ${opts.confirmMissing ? '' : `<a id="bookmnow" href="#">${opts.confirmInSpan === false ?
      (opts.confirmText ?? 'Book Now') : `<span>${opts.confirmText ?? 'Book Now'}</span>`}</a>`}`);
  p.clicked = [];
  p.showAlert = () => {
    const container = p.doc.createElement('div');
    container.innerHTML = '<button class="btn-red w-auto" onclick="MessageClose()">Close</button>';
    const button = container.firstElementChild;
    button.addEventListener('click', () => { p.counts.alert++; container.hidden = true; });
    p.doc.body.append(container);
    return container;
  };
  for (const seat of p.doc.querySelectorAll('div.seatuncheck')) {
    seat.addEventListener('click', () => {
      p.counts.seat++;
      if (seat.classList.contains('seatchecked')) { seat.className = 'seatuncheck'; return; }
      p.clicked.push({ id: seat.id, time: p.clock.now });
      const accepted = typeof opts.clickSticks === 'function' ? opts.clickSticks(seat.id) : opts.clickSticks !== false;
      if (accepted) {
        const select = () => { seat.className = 'seatchecked'; };
        if (opts.selectionDelay) p.clock.setTimeout(select, opts.selectionDelay);
        else select();
      }
      if (opts.alertOnClick) p.showAlert();
    });
  }
  p.doc.querySelector('#bookmnow')?.addEventListener('click', event => {
    event.preventDefault();
    p.counts.confirm++;
    if (opts.confirmShowsAlert) p.showAlert();
  });
  p.run = (text = seatsSource) => p.evaluate(text);
  t.after(() => assert.equal(p.counts.reload, 0));
  return p;
}

for (const confirmText of ['Book Now', 'ยืนยันที่นั่ง', 'Confirm seats']) {
  test(`confirmation works by ID: ${confirmText}`, async t => {
    const p = seatPage(t, { confirmText });
    p.run();
    await p.advance(10000);
    assert.equal(p.counts.confirm, 1);
    assert.equal(p.counts.seat, 1);
    assert.equal(p.window.ttmSeatSelector.running, false);
    assert.equal(p.clock.timers.size, 0);
  });
}

test('confirmation does not require a span', async t => {
  const p = seatPage(t, { confirmInSpan: false });
  p.run();
  await p.advance(10000);
  assert.equal(p.counts.confirm, 1);
});

for (const unavailable of ['missing', 'hidden', 'disabled']) {
  test(`unavailable confirmation stops: ${unavailable}`, async t => {
    const p = seatPage(t, { confirmMissing: unavailable === 'missing' });
    if (unavailable === 'hidden') p.doc.querySelector('#bookmnow').hidden = true;
    if (unavailable === 'disabled') p.doc.querySelector('#bookmnow').setAttribute('aria-disabled', 'true');
    p.run();
    await p.advance(10000);
    assert.equal(p.counts.confirm, 0);
    assert.equal(p.window.ttmSeatSelector.running, false);
    assert.equal(p.clock.timers.size, 0);
  });
}

test('no seats stops after bounded scans without reload', async t => {
  const p = seatPage(t, { rows: [] });
  p.run();
  await p.advance(60000);
  assert.equal(p.counts.seat, 0);
  assert.equal(p.window.ttmSeatSelector.running, false);
  assert.equal(p.clock.timers.size, 0);
});

test('empty scan retries can detect a newly available seat', async t => {
  const p = seatPage(t);
  const cell = p.doc.querySelector('td[title]');
  cell.className = 'not-available';
  p.run();
  p.clock.setTimeout(() => { cell.className = ''; }, 400);
  await p.advance(10000);
  assert.equal(p.counts.seat, 1);
  assert.equal(p.counts.confirm, 1);
});

for (const alertOnClick of [false, true]) {
  test(`rejected seat is not clicked repeatedly, alert=${alertOnClick}`, async t => {
    const p = seatPage(t, { clickSticks: false, alertOnClick });
    p.run();
    await p.advance(60000);
    assert.equal(p.counts.seat, 1);
    assert.equal(p.counts.confirm, 0);
    assert.equal(p.counts.alert, Number(alertOnClick));
    assert.equal(p.window.ttmSeatSelector.running, false);
    assert.equal(p.clock.timers.size, 0);
  });
}

test('rejected candidate advances to another seat', async t => {
  const p = seatPage(t, { rows: [{ label: 'AA', seats: ['03', '04'] }],
    clickSticks: id => id.endsWith('04') });
  p.run();
  await p.advance(60000);
  assert.deepEqual(p.clicked.map(click => click.id), ['checkseat-AA-03', 'checkseat-AA-04']);
  assert.equal(p.counts.confirm, 1);
});

test('attempts are capped and retry delays increase', async t => {
  const p = seatPage(t, { rows: [{ label: 'AA', seats: ['01', '02', '03', '04', '05', '06'] }],
    clickSticks: false, alertOnClick: true });
  p.run();
  await p.advance(60000);
  assert.equal(p.clicked.length, 5);
  const gaps = p.clicked.slice(1).map((click, i) => click.time - p.clicked[i].time);
  assert.ok(gaps.every((gap, i) => i === 0 || gap >= gaps[i - 1]));
  assert.ok(gaps.at(-1) > gaps[0]);
  assert.equal(p.clock.timers.size, 0);
});

for (const stopAt of [0, 150, 2500]) {
  test(`stop cancels pending work at ${stopAt}ms`, async t => {
    const p = seatPage(t, { clickSticks: false });
    p.run();
    await p.advance(stopAt);
    p.window.ttmSeatSelector.stop();
    const counts = { ...p.counts };
    await p.advance(60000);
    assert.deepEqual(p.counts, counts);
    assert.equal(p.window.ttmSeatSelector.running, false);
    assert.equal(p.clock.timers.size, 0);
  });
}

test('pasting again stops the previous run', async t => {
  const p = seatPage(t, { clickSticks: false });
  p.run();
  const previous = p.window.ttmSeatSelector;
  p.run();
  assert.equal(previous.running, false);
  assert.notEqual(p.window.ttmSeatSelector, previous);
  await p.advance(60000);
  assert.equal(p.counts.seat, 2);
  assert.equal(p.clock.timers.size, 0);
});

test('delayed selection settles before confirmation', async t => {
  const p = seatPage(t, { selectionDelay: 600 });
  p.run();
  await p.advance(700);
  assert.equal(p.counts.confirm, 0);
  await p.advance(3000);
  assert.equal(p.counts.confirm, 1);
  assert.equal(p.counts.seat, 1);
});

test('transient selection is not confirmed', async t => {
  const p = seatPage(t);
  p.run();
  p.clock.setTimeout(() => { p.doc.querySelector('.seatchecked').className = 'seatuncheck'; }, 150);
  await p.advance(60000);
  assert.equal(p.counts.confirm, 0);
  assert.equal(p.counts.seat, 1);
});

for (const hiding of ['hidden', 'display', 'visibility']) {
  test(`hidden alert ancestor is ignored: ${hiding}`, async t => {
    const p = seatPage(t);
    const alert = p.showAlert();
    if (hiding === 'hidden') alert.hidden = true;
    if (hiding === 'display') alert.style.display = 'none';
    if (hiding === 'visibility') alert.style.visibility = 'hidden';
    p.run();
    await p.advance(10000);
    assert.equal(p.counts.confirm, 1);
    assert.equal(p.counts.alert, 0);
  });
}

test('visible alert prevents confirmation even when the seat is checked', async t => {
  const p = seatPage(t, { alertOnClick: true });
  p.run();
  await p.advance(60000);
  assert.equal(p.counts.confirm, 0);
  assert.equal(p.counts.alert, 1);
  assert.equal(p.doc.querySelectorAll('.seatchecked').length, 0);
});

test('an immediate alert prevents clicking the remaining seats in a pair', async t => {
  const p = seatPage(t, { rows: [{ label: 'AA', seats: ['03', '04'] }], alertOnClick: true });
  p.run(seatsSource.replace('const requiredSeats = 1;', 'const requiredSeats = 2;'));
  await p.advance(60000);
  assert.deepEqual(p.clicked.map(click => click.id), ['checkseat-AA-03']);
  assert.equal(p.counts.confirm, 0);
});

test('confirmation dialog is left for the user without reload or another click', async t => {
  const p = seatPage(t, { confirmShowsAlert: true });
  p.run();
  await p.advance(10000);
  assert.equal(p.counts.confirm, 1);
  assert.equal(p.counts.alert, 0);
  assert.equal(p.clock.timers.size, 0);
});

test('wrong page stops without reload', async t => {
  const p = seatPage(t, { table: false });
  p.run();
  await p.advance(10000);
  assert.equal(p.counts.seat, 0);
  assert.equal(p.window.ttmSeatSelector.running, false);
});

test('existing user selection is preserved', async t => {
  const p = seatPage(t);
  p.doc.querySelector('.seatuncheck').className = 'seatchecked';
  p.run();
  await p.advance(10000);
  assert.equal(p.counts.seat, 0);
  assert.equal(p.counts.confirm, 0);
  assert.equal(p.doc.querySelectorAll('.seatchecked').length, 1);
});

test('invalid seat metadata is skipped', async t => {
  const p = seatPage(t);
  p.doc.querySelector('td[title]').removeAttribute('title');
  p.run();
  await p.advance(60000);
  assert.equal(p.counts.seat, 0);
});

test('adjacent pair skips a numeric gap', async t => {
  const p = seatPage(t, { rows: [{ label: 'AA', seats: ['03', '05', '06'] }] });
  p.run(seatsSource.replace('const requiredSeats = 1;', 'const requiredSeats = 2;'));
  await p.advance(10000);
  assert.deepEqual(p.clicked.map(click => click.id), ['checkseat-AA-05', 'checkseat-AA-06']);
  assert.equal(p.counts.confirm, 1);
});

test('adjacent pair skips an unavailable seat', async t => {
  const p = seatPage(t, { rows: [{ label: 'AA', seats: ['03', '04', '05', '06'] }] });
  p.doc.querySelector('[title="AA-04"]').className = 'not-available';
  p.run(seatsSource.replace('const requiredSeats = 1;', 'const requiredSeats = 2;'));
  await p.advance(10000);
  assert.deepEqual(p.clicked.map(click => click.id), ['checkseat-AA-05', 'checkseat-AA-06']);
  assert.equal(p.counts.confirm, 1);
});

test('adjacent pair also works with descending seat numbers', async t => {
  const p = seatPage(t, { rows: [{ label: 'AA', seats: ['06', '05', '03'] }] });
  p.run(seatsSource.replace('const requiredSeats = 1;', 'const requiredSeats = 2;'));
  await p.advance(10000);
  assert.deepEqual(p.clicked.map(click => click.id), ['checkseat-AA-06', 'checkseat-AA-05']);
  assert.equal(p.counts.confirm, 1);
});

test('stopping from a seat click prevents the rest of the pair', async t => {
  const p = seatPage(t, { rows: [{ label: 'AA', seats: ['03', '04'] }] });
  p.doc.querySelector('.seatuncheck').addEventListener('click', () => p.window.ttmSeatSelector.stop());
  p.run(seatsSource.replace('const requiredSeats = 1;', 'const requiredSeats = 2;'));
  await p.advance(10000);
  assert.deepEqual(p.clicked.map(click => click.id), ['checkseat-AA-03']);
  assert.equal(p.counts.confirm, 0);
  assert.equal(p.clock.timers.size, 0);
});

test('partial selection is undone before trying another pair', async t => {
  const p = seatPage(t, { rows: [{ label: 'AA', seats: ['03', '04', '05', '06'] }],
    clickSticks: id => !id.endsWith('04') });
  p.run(seatsSource.replace('const requiredSeats = 1;', 'const requiredSeats = 2;'));
  await p.advance(60000);
  assert.deepEqual([...p.doc.querySelectorAll('.seatchecked')].map(seat => seat.id),
    ['checkseat-AA-05', 'checkseat-AA-06']);
  assert.equal(p.counts.confirm, 1);
});

test('invalid requiredSeats stops before clicking', async t => {
  const p = seatPage(t);
  p.run(seatsSource.replace('const requiredSeats = 1;', 'const requiredSeats = 0;'));
  await p.advance(10000);
  assert.equal(p.counts.seat, 0);
  assert.equal(p.counts.confirm, 0);
  assert.equal(p.window.ttmSeatSelector.running, false);
});

test('nonadjacent pair is not selected', async t => {
  const p = seatPage(t, { rows: [{ label: 'AA', seats: ['03', '05'] }] });
  p.run(seatsSource.replace('const requiredSeats = 1;', 'const requiredSeats = 2;'));
  await p.advance(60000);
  assert.equal(p.counts.seat, 0);
  assert.equal(p.counts.confirm, 0);
});

test('harness propagates synchronous and timer exceptions', async t => {
  const p = page(t, '');
  assert.throws(() => p.evaluate('throw new Error("synchronous failure")'), /synchronous failure/);
  p.evaluate('setTimeout(() => { throw new Error("timer failure"); }, 10)');
  await assert.rejects(p.advance(10), /timer failure/);
  p.evaluate('setTimeout(() => { throw new Error("default timer failure"); })');
  await assert.rejects(p.advance(0), /default timer failure/);
});

test('terms continue once after checking', async t => {
  const p = page(t, '<input type="checkbox" id="rdagree"><button id="btn_verify">Verify</button>');
  let clicks = 0;
  p.doc.querySelector('button').addEventListener('click', () => clicks++);
  p.evaluate(source('1.confirm-terms'));
  await p.advance(350);
  assert.equal(clicks, 1);
  assert.equal(p.clock.timers.size, 0);
});

test('existing terms limitation: unchecked checkbox leaves an interval', async t => {
  const p = page(t, '<input type="checkbox" id="rdagree"><button id="btn_verify">Verify</button>');
  Object.defineProperty(p.doc.querySelector('input'), 'checked', { get: () => false });
  p.evaluate(source('1.confirm-terms'));
  await p.advance(350);
  assert.equal(p.clock.timers.size, 1);
});

test('existing terms limitation: missing checkbox throws', t => {
  const p = page(t, '<button id="btn_verify">Verify</button>');
  assert.throws(() => p.evaluate(source('1.confirm-terms')), /checked/);
});

test('existing show limitation: last matching Wednesday wins', t => {
  const p = page(t, '<select id="rdId"><option value="1">Wed 20</option><option value="2">Wed 27</option></select>');
  let changes = 0;
  p.doc.querySelector('select').addEventListener('change', () => changes++);
  p.evaluate(source('2.select-show-date'));
  assert.equal(p.doc.querySelector('select').value, '2');
  assert.equal(changes, 2);
});

for (const seatsText of ['5', 'Available', '']) {
  test(`existing zone behavior: ${seatsText || 'no data'}`, async t => {
    const row = (id, seats) => `<tr><td><a id="${id}">${id}</a></td><td><a>${seats}</a></td></tr>`;
    const p = page(t, `<button id="popup-avail">Open</button><table>${seatsText ? row('C1', seatsText) : ''}</table>
      ${seatsText === '5' ? `<table>${row('C9', '99')}</table>` : ''}`);
    const calls = [];
    const clicked = [];
    p.context.gonextstep = (...args) => calls.push(args);
    p.context.event = undefined;
    p.expectedError = /No available seats/;
    p.doc.querySelectorAll('tr').forEach(tr => tr.addEventListener('click', () => clicked.push(tr)));
    p.evaluate(source('3.select-zone'));
    p.doc.body.append(p.doc.createElement('span'));
    await p.advance(1100);
    if (seatsText === '5') {
      assert.deepEqual(calls, [['fixed.php', 'C9', undefined]]);
      assert.equal(clicked.length, 1);
    } else {
      assert.equal(calls.length, 0);
      assert.ok(p.logs.some(log => /No available seats/.test(log.text)));
    }
  });
}

test('existing details behavior: value changes without input/change events', t => {
  const p = page(t, Array.from({ length: 4 }, (_, i) => `<input id="txt_firstname_${i}">`).join(''));
  let events = 0;
  p.doc.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => events++);
    input.addEventListener('change', () => events++);
  });
  p.evaluate(source('5.fill-details'));
  assert.ok(p.doc.querySelector('input').value.length > 0);
  assert.equal(events, 0);
});
