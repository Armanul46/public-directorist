import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(
	new URL(
		'../assets/src/js/formgent-integration/utils/enquiryUtils.js',
		import.meta.url
	),
	'utf8'
);
const helpers = source
	.slice(source.indexOf('function parseMysqlDateTimeAsUTC'))
	.replace('export const formatRelativeDate', 'const formatRelativeDate');
const now = Date.parse('2026-10-27T10:20:00Z');
class FixedDate extends Date {
	constructor(...args) {
		super(...(args.length ? args : [now]));
	}
}
const context = { Date: FixedDate };
vm.runInNewContext(helpers + '\nthis.format = formatRelativeDate;', context);
const format = context.format;
const secondsAgo = (seconds) => (now - seconds * 1000) / 1000;

// The database session is UTC+6; its bare string must not override its epoch.
assert.equal(format('2026-10-27 15:12:26', '1793092346'), '1 hour ago');
assert.equal(format('2026-10-27 15:12:26', 1793092346), '1 hour ago');
assert.equal(format('', secondsAgo(300)), '5 minutes ago');
assert.equal(format(null, secondsAgo(300)), '5 minutes ago');
for (const [seconds, expected] of [
	[0, 'just now'],
	[59, 'just now'],
	[60, '1 minute ago'],
	[59 * 60, '59 minutes ago'],
	[3600, '1 hour ago'],
	[23 * 3600, '23 hours ago'],
	[86400, '1 day ago'],
	[2 * 86400, '2 days ago'],
	[3 * 86400, 'Oct 24, 2026'],
]) {
	assert.equal(format('ignored', secondsAgo(seconds)), expected);
}
assert.equal(format('2026-10-27T16:15:00+06:00'), '5 minutes ago');
assert.equal(format('2026-10-27T10:15:00Z'), '5 minutes ago');
assert.equal(format('2026-10-27 10:15:00'), '5 minutes ago');
assert.equal(format('2026-10-27T10:15:00Z', 'invalid'), '5 minutes ago');
assert.equal(format('2026-10-27T10:15:00Z', ''), '5 minutes ago');
assert.equal(format('invalid'), 'invalid');
assert.equal(format(null), '');
assert.equal(format(''), '');
assert.notEqual(format('2026-10-27T15:12:26Z'), 'just now');
assert.notEqual(format('ignored', (now + 3600000) / 1000), 'just now');
console.log(
	`Relative date regression checks passed (${process.env.TZ || 'system timezone'}).`
);
