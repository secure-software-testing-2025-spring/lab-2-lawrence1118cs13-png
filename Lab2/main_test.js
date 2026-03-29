const test = require('node:test');
const assert = require('assert');
const fs = require('fs');

// 1. 建立測試用的假檔案，供 Application 的 constructor 讀取
// 這樣可以避免 getNames() 拋出找不到檔案的錯誤
fs.writeFileSync('name_list.txt', 'Alice\nBob\nCharlie\nDavid');

const { Application, MailSystem } = require('./main');

test('MailSystem - write', () => {
    const mailSystem = new MailSystem();
    const result = mailSystem.write('John');
    assert.strictEqual(result, 'Congrats, John!');
});

test('MailSystem - send (success)', (t) => {
    const mailSystem = new MailSystem();
    // 使用 Stub：將 Math.random 寫死回傳 0.6 (> 0.5 為成功)
    t.mock.method(Math, 'random', () => 0.6);
    const result = mailSystem.send('John', 'Congrats, John!');
    assert.strictEqual(result, true);
});

test('MailSystem - send (failure)', (t) => {
    const mailSystem = new MailSystem();
    // 使用 Stub：將 Math.random 寫死回傳 0.4 (<= 0.5 為失敗)
    t.mock.method(Math, 'random', () => 0.4);
    const result = mailSystem.send('John', 'Congrats, John!');
    assert.strictEqual(result, false);
});

test('Application - constructor and getNames', async () => {
    const app = new Application();
    // 因為 constructor 裡的 getNames().then() 是非同步的
    // 我們需要稍微等待 event loop 執行完畢，確保變數被正確賦值
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepStrictEqual(app.people, ['Alice', 'Bob', 'Charlie', 'David']);
    assert.deepStrictEqual(app.selected, []);
});

test('Application - getRandomPerson', () => {
    const app = new Application();
    app.people = ['Alice', 'Bob'];
    const person = app.getRandomPerson();
    assert(['Alice', 'Bob'].includes(person));
});

test('Application - selectNextPerson', (t) => {
    const app = new Application();
    app.people = ['Alice', 'Bob'];
    app.selected = [];

    // 使用 Stub 控制 getRandomPerson 邏輯，藉此測試到 while 迴圈
    let callCount = 0;
    t.mock.method(app, 'getRandomPerson', () => {
        callCount++;
        if (callCount === 1) return 'Alice';
        if (callCount === 2) return 'Alice'; // 故意回傳重複的 Alice，觸發 while 重抽迴圈
        return 'Bob';                        // 第三次回傳 Bob，結束迴圈
    });

    const first = app.selectNextPerson();
    assert.strictEqual(first, 'Alice');
    assert.deepStrictEqual(app.selected, ['Alice']);

    const second = app.selectNextPerson();
    assert.strictEqual(second, 'Bob');
    assert.deepStrictEqual(app.selected, ['Alice', 'Bob']);

    // 測試當所有人都被選中時 (this.people.length === this.selected.length) 的條件分支
    const third = app.selectNextPerson();
    assert.strictEqual(third, null);
});

test('Application - notifySelected', (t) => {
    const app = new Application();
    app.selected = ['Alice', 'Bob'];

    // 使用 Spy：監聽 mailSystem 的 write 與 send 方法是否有被正確呼叫
    const writeSpy = t.mock.method(app.mailSystem, 'write');
    const sendSpy = t.mock.method(app.mailSystem, 'send', () => true);

    app.notifySelected();

    // 兩個人被選中，所以應該各自呼叫 2 次
    assert.strictEqual(writeSpy.mock.calls.length, 2);
    assert.strictEqual(sendSpy.mock.calls.length, 2);
    
    // 驗證傳入參數是否正確
    assert.strictEqual(writeSpy.mock.calls[0].arguments[0], 'Alice');
    assert.strictEqual(writeSpy.mock.calls[1].arguments[0], 'Bob');
});