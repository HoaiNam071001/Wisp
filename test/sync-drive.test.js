const test = require('node:test');
const assert = require('node:assert');
const { createDrive } = require('../sync-drive');

// Drive giả: lưu file trong RAM, modifiedTime tăng mỗi lần ghi
function fake() {
  const files = new Map(); let n = 0; const log = [];
  const transport = async (method, url, headers, body) => {
    log.push(method + ' ' + url.split('?')[0].replace(/^.*\/files/, ''));
    const u = new URL(url);
    if (method === 'GET' && u.searchParams.get('q')) {
      const name = /name='(.*?)' and/.exec(u.searchParams.get('q'))[1];
      const f = [...files.values()].find(x => x.name === name);
      return { status: 200, body: JSON.stringify({ files: f ? [{ id: f.id, modifiedTime: f.mt }] : [] }) };
    }
    if (method === 'GET' && !u.searchParams.get('alt')) return { status: 200, body: JSON.stringify({ files: [...files.values()].map(f => ({ id: f.id })) }) };
    if (method === 'GET' && u.searchParams.get('alt') === 'media') return { status: 200, body: files.get(u.pathname.split('/').pop()).text };
    if (method === 'POST') {
      const name = /"name":"(.*?)"/.exec(body)[1];
      const id = 'f' + (++n); files.set(id, { id, name, text: body.split('\r\n\r\n')[2].split('\r\n--')[0], mt: 't' + n }); return { status: 200, body: '{}' };
    }
    if (method === 'PATCH') { const f = files.get(u.pathname.split('/').pop()); f.text = body; f.mt = 't' + (++n); return { status: 200, body: '{}' }; }
    if (method === 'DELETE') { files.delete(u.pathname.split('/').pop()); return { status: 204, body: '' }; }
    return { status: 500, body: '' };
  };
  return { files, log, drive: createDrive(async () => 'tok', transport) };
}

test('read file chưa có → null; ghi mới rồi đọc lại', async () => {
  const { drive } = fake();
  assert.strictEqual(await drive.read('a.json'), null);
  await drive.write('a.json', '{"x":1}', null);
  assert.strictEqual((await drive.read('a.json')).text, '{"x":1}');
});

test('ghi đè khi máy khác đã ghi sau lúc đọc → conflict; đọc lại rồi ghi được', async () => {
  const { drive } = fake();
  await drive.write('a.json', '1', null);
  const mine = await drive.read('a.json');
  await drive.write('a.json', '2', mine); // máy khác
  await assert.rejects(drive.write('a.json', '3', mine), { code: 'conflict' });
  await drive.write('a.json', '3', await drive.read('a.json'));
  assert.strictEqual((await drive.read('a.json')).text, '3');
});

test('tạo mới khi file đã xuất hiện (máy khác tạo trước) → conflict', async () => {
  const { drive } = fake();
  await drive.write('a.json', '1', null);
  await assert.rejects(drive.write('a.json', '2', null), { code: 'conflict' });
});

test('lỗi HTTP: 401 báo đăng nhập lại, 403 nói cách sửa; file quá lớn bị chặn', async () => {
  const mk = (status) => createDrive(async () => 't', async () => ({ status, body: '{"error":{"message":"x"}}' }));
  await assert.rejects(mk(401).read('a'), { code: 'unauthorized' });
  await assert.rejects(mk(403).read('a'), /Drive API/);
  await assert.rejects(fake().drive.write('a', 'x'.repeat(9 * 1024 * 1024), null), { code: 'too_large' });
});

test('removeAll xoá hết file', async () => {
  const { drive, files } = fake();
  await drive.write('a.json', '1', null);
  await drive.write('b.json', '2', null);
  await drive.removeAll();
  assert.strictEqual(files.size, 0);
});
