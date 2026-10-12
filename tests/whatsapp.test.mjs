import test from 'node:test'; import assert from 'node:assert/strict';
import { parseChat, isGroup, summarize, mergeStats, newMessages, summaryText, chatTitle, topics } from '../src/whatsapp.js';
const L = '‎', NN = ' ';
// synthetic exports, 5 real messages + 1 media + 1 system line each, one message spans two lines
const IOS_DE = [`${L}[11.10.26, 21:05:33] Anna: ${L}Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt.`, '[11.10.26, 21:06:10] Anna: Hallo Ben', '[11.10.26, 21:07:00] Ben: Hi Anna,', 'wie geht es dir?', '[12.10.26, 08:00:01] Anna: Wir haben beschlossen, Option 2 zu nehmen.', `[13.10.26, 09:15:00] Ben: ${L}<Anhang: 00000001-PHOTO.jpg>`, '[14.10.26, 18:30:00] Anna: Termin am 20.10.26 um 14:00 beim Installateur', '[14.10.26, 18:31:00] Anna: Kommst du?'].join('\n');
const AND_DE = ['11.10.26, 21:05 - Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt.', '11.10.26, 21:06 - Anna: Hallo Ben', '11.10.26, 21:07 - Ben: Hi Anna,', 'wie geht es dir?', '12.10.26, 08:00 - Anna: Wir haben beschlossen, Option 2 zu nehmen.', '13.10.26, 09:15 - Ben: <Medien ausgeschlossen>', '14.10.26, 18:30 - Anna: Termin am 20.10.26 um 14:00 beim Installateur', '14.10.26, 18:31 - Anna: Kommst du?'].join('\n');
const IOS_EN = [`[10/11/26, 9:05:33${NN}PM] Anna: ${L}Messages and calls are end-to-end encrypted.`, `[10/11/26, 9:06:10${NN}PM] Anna: Hello Ben`, `[10/11/26, 9:07:00${NN}PM] Ben: Hi Anna,`, 'how are you?', `[10/12/26, 8:00:01${NN}AM] Anna: We decided to go with option 2.`, `[10/13/26, 9:15:00${NN}AM] Ben: ${L}<attached: 00000001-PHOTO.jpg>`, `[10/14/26, 6:30:00${NN}PM] Anna: Appointment on 10/20/26 at 2:00 with the installer`, `[10/14/26, 12:31:00${NN}AM] Anna: Are you coming?`].join('\n');
const AND_EN = ['10/11/26, 9:05 PM - Messages and calls are end-to-end encrypted.', '10/11/26, 9:06 PM - Anna: Hello Ben', '10/11/26, 9:07 PM - Ben: Hi Anna,', 'how are you?', '10/12/26, 8:00 AM - Anna: We decided to go with option 2.', '10/13/26, 9:15 AM - Ben: <Media omitted>', '10/14/26, 6:30 PM - Anna: Appointment on 10/20/26 at 2:00 with the installer', '10/14/26, 6:31 PM - Anna: Are you coming?'].join('\n');

for (const [name, txt, fmt, order] of [['iOS German 24h', IOS_DE, 'ios', 'dmy'], ['Android German 24h', AND_DE, 'android', 'dmy'], ['iOS English 12h', IOS_EN, 'ios', 'mdy'], ['Android English 12h', AND_EN, 'android', 'mdy']]) {
  test(`W1 parser: ${name}`, () => {
    const p = parseChat(txt); assert.equal(p.ok, true); assert.equal(p.format, fmt); assert.equal(p.order, order);
    assert.equal(p.system, 1, 'one system line'); assert.equal(p.media, 1, 'one media marker'); assert.equal(p.count, 6, 'real messages incl. media');
    const real = p.messages.filter((m) => m.kind === 'msg'); assert.equal(real.length, 5);
    assert.deepEqual(p.senders.sort(), ['Anna', 'Ben']); assert.equal(isGroup(p), false);
    assert.match(real[1].text, /^Hi Anna,\n.*(wie geht es dir|how are you)\?$/, 'multi-line kept in one message');
    assert.equal(real[0].t.slice(0, 16), '2026-10-11T21:06'); assert.equal(real[2].t.slice(0, 16), '2026-10-12T08:00'); assert.equal(p.messages.at(-1).t.slice(0, 16), name === 'iOS English 12h' ? '2026-10-14T00:31' : '2026-10-14T18:31');
    assert.equal(p.messages.find((m) => m.kind === 'media').text, '', 'media text not kept');
  });
}
test('W1 date order: day-first vs month-first from the data, ambiguity flagged and overridable', () => {
  const a = parseChat('[13.05.26, 10:00:00] A: x\n[01.06.26, 10:00:00] B: y'); assert.equal(a.order, 'dmy'); assert.equal(a.ambiguous, false);
  const b = parseChat('5/13/26, 10:00 AM - A: x\n6/1/26, 10:00 AM - B: y'); assert.equal(b.order, 'mdy'); assert.equal(b.ambiguous, false);
  const c = parseChat('[03.04.26, 10:00:00] A: x\n[04.04.26, 10:00:00] B: y'); assert.equal(c.ambiguous, true); assert.equal(c.messages[0].t.slice(0, 10), '2026-04-03');
  const d = parseChat('[03.04.26, 10:00:00] A: x\n[04.04.26, 10:00:00] B: y', { order: 'mdy' }); assert.equal(d.messages[0].t.slice(0, 10), '2026-03-04'); assert.equal(d.ambiguous, false);
  assert.equal(parseChat('this is not a chat\nat all').ok, false);
});
test('W2 group detection: 3 senders or group-created hint', () => {
  const g = parseChat('[01.01.26, 10:00:00] A: x\n[01.01.26, 10:01:00] B: y\n[01.01.26, 10:02:00] C: z'); assert.equal(isGroup(g), true);
  const h = parseChat(`[01.01.26, 09:00:00] Team: ${L}Anna created group "Team"\n[01.01.26, 10:00:00] A: x\n[01.01.26, 10:01:00] B: y`); assert.equal(isGroup(h), true); assert.equal(h.system, 1);
  assert.equal(isGroup(parseChat(IOS_DE)), false);
});
test('W3 summary: counts, period, planted decision/date/question found, topics, title', () => {
  const p = parseChat(IOS_DE); const s = summarize(p.messages);
  assert.equal(s.n, 6); assert.equal(s.media, 1); assert.deepEqual(s.bySender, { Anna: 4, Ben: 2 }); assert.equal(s.first.slice(0, 10), '2026-10-11'); assert.equal(s.last.slice(0, 10), '2026-10-14');
  assert.ok(s.flagged.some((f) => f.kind === 'decision' && /Option 2/.test(f.text)), 'decision'); assert.ok(s.flagged.some((f) => f.kind === 'date' && /20\.10\.26/.test(f.text)), 'date'); assert.ok(s.flagged.some((f) => f.kind === 'question' && /Kommst du/.test(f.text)), 'open question');
  const t = summaryText(s, 'Ben', false); assert.match(t, /Messages: 6 \(1 media items/); assert.match(t, /Anna \(4\), Ben \(2\)/);
  assert.equal(chatTitle('WhatsApp Chat with Ben.zip'), 'Ben'); assert.equal(chatTitle('WhatsApp Chat - Familie.zip'), 'Familie'); assert.equal(chatTitle('_chat.txt'), 'Chat'); assert.ok(Array.isArray(topics(s)));
});
test('W3 summary mode keeps no message text except capped flagged lines', () => {
  const big = []; for (let i = 0; i < 40; i++) big.push(`[01.02.26, 10:${String(i).padStart(2, '0')}:00] A: Ganz normale Nachricht Nummer ${i} über Zwiebelkuchen${i}`); big.push('[01.02.26, 11:00:00] B: Wir haben entschieden, ' + 'sehr lang '.repeat(40) + 'ENDE');
  const s = summarize(parseChat(big.join('\n')).messages); const dump = JSON.stringify(s);
  assert.ok(!dump.includes('Zwiebelkuchen7'), 'unflagged text must not be stored'); assert.ok(!dump.includes('Nachricht Nummer'), 'no ordinary message text');
  assert.ok(s.flagged.length <= 10); assert.ok(s.flagged.every((f) => f.text.length <= 140)); assert.ok(!dump.includes('ENDE'), 'flagged line is cut at 140 chars'); assert.equal(s.messages, undefined);
  const f = summarize(parseChat(big.join('\n')).messages, { full: true }); assert.equal(f.messages.length, 41);
});
test('W5 append: only new messages are added, merge is exact', () => {
  const p1 = parseChat(IOS_DE); const first = summarize(p1.messages);
  const more = IOS_DE + '\n[15.10.26, 10:00:00] Ben: Ja, ich komme.\n[15.10.26, 10:01:00] Ben: Bis später';
  const p2 = parseChat(more); const fresh = newMessages(first, p2.messages); assert.equal(fresh.length, 2);
  const merged = mergeStats(first, summarize(fresh)); assert.equal(merged.n, 8); assert.equal(merged.bySender.Ben, 4); assert.equal(merged.last.slice(0, 10), '2026-10-15'); assert.equal(new Set(merged.keys).size, 8);
  assert.equal(newMessages(merged, p2.messages).length, 0, 'second append adds nothing');
});
