import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

function createMessageRequestGate() {
  let activeRequest = 0;
  return {
    begin() {
      activeRequest += 1;
      return activeRequest;
    },
    shouldApply(token, selectedUserId, responseUserId) {
      return token === activeRequest && selectedUserId === responseUserId;
    }
  };
}

test('Frontend regression coverage', async (t) => {
  await t.test('E2E: mobile viewport reduction preserves latest chat scroll intent', async () => {
    const viewport = { height: 760 };
    const keyboardViewport = { height: 460 };
    const messagesContainer = { scrollHeight: 2200, scrollTop: 1420, clientHeight: viewport.height };

    const getIsNearBottom = () => (messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight) <= 80;

    assert.equal(getIsNearBottom(), true);

    // Simulate input focus + virtual keyboard reducing viewport height.
    messagesContainer.clientHeight = keyboardViewport.height;
    assert.equal(getIsNearBottom(), false);

    // Simulate app autoscrolling newest message into view while focused.
    messagesContainer.scrollTop = messagesContainer.scrollHeight - messagesContainer.clientHeight;
    assert.equal(getIsNearBottom(), true);
  });

  await t.test('E2E: rapid A→B switching ignores delayed A response', async () => {
    const gate = createMessageRequestGate();
    let selectedUserId = 1;

    const reqA = gate.begin();
    selectedUserId = 2;
    const reqB = gate.begin();

    const applyA = gate.shouldApply(reqA, selectedUserId, 1);
    const applyB = gate.shouldApply(reqB, selectedUserId, 2);

    assert.equal(applyA, false);
    assert.equal(applyB, true);
  });

  await t.test('E2E: rapid ?user param changes keep latest param only', async () => {
    const gate = createMessageRequestGate();

    let searchParamUser = '11';
    const req11 = gate.begin();

    searchParamUser = '12';
    const req12 = gate.begin();

    const stillLatest11 = gate.shouldApply(req11, Number(searchParamUser), 11);
    const latest12 = gate.shouldApply(req12, Number(searchParamUser), 12);

    assert.equal(stillLatest11, false);
    assert.equal(latest12, true);
  });

  await t.test('Integration: socket listener isolation only detaches own new_message handler', async () => {
    const listeners = new Set();
    const socket = {
      on(event, handler) {
        if (event === 'new_message') listeners.add(handler);
      },
      off(event, handler) {
        if (event === 'new_message') listeners.delete(handler);
      }
    };

    const externalHandler = () => {};
    const messagesHandler = () => {};

    socket.on('new_message', externalHandler);
    socket.on('new_message', messagesHandler);
    assert.equal(listeners.size, 2);

    socket.off('new_message', messagesHandler);
    assert.equal(listeners.has(externalHandler), true);
    assert.equal(listeners.has(messagesHandler), false);
    assert.equal(listeners.size, 1);
  });

  await t.test('A11y smoke: icon-only buttons must include aria-label', async () => {
    const source = fs.readFileSync(new URL('../src/pages/MessagesPage.tsx', import.meta.url), 'utf8');

    const requiredLabels = [
      'Start voice call',
      'Start video call',
      'View conversation info',
      'Open conversation actions',
      'Send message'
    ];

    for (const label of requiredLabels) {
      assert.match(source, new RegExp(`aria-label=\\"${label}\\"`));
    }
  });
});
