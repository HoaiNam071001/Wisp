const test = require('node:test');
const assert = require('node:assert');
const { parseRequest, checkArgs, okReply, errorReply, GhError, webUrlOnly } = require('../ghosthand/protocol');
const { keyEvents, textEvents } = require('../ghosthand/keys');

const codeOf = fn => { try { fn(); } catch (e) { return e.code; } return 'không lỗi'; };

test('parseRequest: lệnh hợp lệ, selector đã phân tích', () => {
  const r = parseRequest('{"id":3,"cmd":"click","args":{"selector":"role=button[name=\\"Gửi\\"]","tab":2}}');
  assert.strictEqual(r.id, 3);
  assert.deepStrictEqual(r.args.sels, [{ by: 'role', value: 'button', name: 'Gửi' }]);
  assert.strictEqual(r.args.tab, 2);
  assert.deepStrictEqual(parseRequest('{"id":1,"cmd":"tabs"}').args, {});
});

test('parseRequest: lỗi trả bad_args, giữ id', () => {
  assert.strictEqual(codeOf(() => parseRequest('không phải json')), 'bad_args');
  try { parseRequest('{"id":7,"cmd":"bay"}'); } catch (e) { assert.strictEqual(e.id, 7); assert.strictEqual(e.code, 'bad_args'); }
  assert.strictEqual(codeOf(() => checkArgs('open', {})), 'bad_args');                        // thiếu url
  assert.strictEqual(codeOf(() => checkArgs('open', { url: 'x', foo: 1 })), 'bad_args');      // đối số lạ
  assert.strictEqual(codeOf(() => checkArgs('waitLoad', { until: 'never' })), 'bad_args');    // ngoài danh sách
  assert.strictEqual(codeOf(() => checkArgs('click', {})), 'bad_args');                       // thiếu đích
  assert.strictEqual(codeOf(() => checkArgs('click', { ref: 'a', selector: 'b' })), 'bad_args');
  assert.strictEqual(codeOf(() => checkArgs('find', { selectors: ['role=nút'] })), 'bad_args');
  assert.strictEqual(codeOf(() => checkArgs('find', { selectors: [] })), 'bad_args');
  assert.strictEqual(codeOf(() => checkArgs('scroll', { dir: 'down' })), 'không lỗi');      // đích tuỳ chọn
});

test('checkArgs: trần đối số, offset phải là số', () => {
  assert.strictEqual(codeOf(() => checkArgs('waitLoad', { timeoutMs: 86400000 })), 'bad_args');
  assert.strictEqual(codeOf(() => checkArgs('waitLoad', { timeoutMs: -1 })), 'bad_args');
  assert.strictEqual(codeOf(() => checkArgs('type', { selector: 'a', text: 'x'.repeat(10001) })), 'bad_args');
  assert.strictEqual(codeOf(() => checkArgs('type', { selector: 'a', text: 'x'.repeat(10000) })), 'không lỗi');
  assert.strictEqual(codeOf(() => checkArgs('click', { selector: 'a', offset: { x: 'a', y: 1 } })), 'bad_args');
  assert.strictEqual(codeOf(() => checkArgs('click', { selector: 'a', offset: { x: 2, y: 1 } })), 'không lỗi');
  assert.strictEqual(codeOf(() => checkArgs('find', { selectors: Array(21).fill('a') })), 'bad_args');
});

test('webUrlOnly: chỉ http(s)', () => {
  assert.strictEqual(webUrlOnly('https://a.vn/'), 'https://a.vn/');
  assert.strictEqual(webUrlOnly('HTTP://localhost:8080'), 'HTTP://localhost:8080');
  for (const u of ['file:///etc/passwd', 'chrome://gpu', 'javascript:alert(1)', 'ruffle://local/x', '', undefined]) {
    assert.strictEqual(codeOf(() => webUrlOnly(u)), 'bad_args', String(u));
  }
});

test('okReply / errorReply', () => {
  assert.deepStrictEqual(JSON.parse(okReply(1, { a: 1 })), { id: 1, ok: true, result: { a: 1 } });
  assert.deepStrictEqual(JSON.parse(errorReply(2, new GhError('timeout', 'hết giờ'))),
    { id: 2, ok: false, error: { code: 'timeout', detail: 'hết giờ' } });
  assert.strictEqual(JSON.parse(errorReply(3, new Error('x'))).error.code, 'internal');
});

test('keyEvents: phím đặt tên, phím kèm, lệnh soạn thảo', () => {
  assert.deepStrictEqual(keyEvents('Enter').events.map(e => e.type + ':' + e.keyCode), ['keyDown:Enter', 'char:\r', 'keyUp:Enter']);
  assert.deepStrictEqual(keyEvents('a', ['shift']).events[1], { type: 'char', keyCode: 'A', modifiers: ['shift'] });
  assert.deepStrictEqual(keyEvents('a', ['cmd']), { edit: 'selectAll' });
  assert.strictEqual(keyEvents('f5').events.length, 2);
  assert.strictEqual(keyEvents('r', ['ctrl']).events.length, 2); // có ctrl → không chèn chữ
  assert.strictEqual(codeOf(() => keyEvents('bay')), 'bad_args');
  assert.strictEqual(codeOf(() => keyEvents('a', ['hyper'])), 'bad_args');
});

test('textEvents: mỗi ký tự một char, xuống dòng = Enter', () => {
  assert.deepStrictEqual(textEvents('Việt').map(e => e.keyCode), ['V', 'i', 'ệ', 't']);
  assert.deepStrictEqual(textEvents('a\nb').map(e => e.type), ['char', 'keyDown', 'char', 'keyUp', 'char']);
});
