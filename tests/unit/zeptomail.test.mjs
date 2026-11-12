import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, test } from 'node:test';
import {
  verifyZeptoMailWebhook,
  zeptoMailApiUrl,
  zeptoMailAuthorization,
  zeptoMailErrorCode,
  zeptoMailRequestBody,
  zeptoMailRequestId,
  zeptoMailWebhookEvent,
} from '../../src/modules/email/zeptomail.ts';

const secret = 'test-authentication-key';

function signatureFor(payload, ts) {
  const mac = createHmac('sha256', secret).update(payload, 'utf8').digest('base64');
  return `ts=${ts};s=${encodeURIComponent(mac)};s-algorithm=HmacSHA256`;
}

describe('ZeptoMail configuration', () => {
  test('defaults to the ZeptoMail API and accepts regional hosts', () => {
    assert.equal(zeptoMailApiUrl(''), 'https://api.zeptomail.com/v1.1/email');
    assert.equal(
      zeptoMailApiUrl('https://api.zeptomail.eu/v1.1/email'),
      'https://api.zeptomail.eu/v1.1/email',
    );
    assert.equal(
      zeptoMailApiUrl('https://api.zeptomail.com.au/v1.1/email'),
      'https://api.zeptomail.com.au/v1.1/email',
    );
  });

  test('refuses hosts that could leak the API key', () => {
    for (const url of [
      'http://api.zeptomail.com/v1.1/email',
      'https://zeptomail.com.evil.io/v1.1/email',
      'https://evil.io/zeptomail.com',
      'https://user:pass@api.zeptomail.com/v1.1/email',
      'not a url',
    ])
      assert.equal(zeptoMailApiUrl(url), '', url);
  });

  test('adds the Zoho-enczapikey prefix only when missing', () => {
    assert.equal(zeptoMailAuthorization('abc'), 'Zoho-enczapikey abc');
    assert.equal(zeptoMailAuthorization('Zoho-enczapikey abc'), 'Zoho-enczapikey abc');
    assert.equal(zeptoMailAuthorization('  '), '');
  });
});

describe('ZeptoMail sending', () => {
  test('builds the documented request body', () => {
    const body = zeptoMailRequestBody({
      fromAddress: 'orders@example.com',
      fromName: 'Xelle',
      to: 'shopper@example.com',
      replyTo: 'owner@example.com',
      subject: 'Order received',
      html: '<p>Hi</p>',
      text: 'Hi',
      clientReference: 'order:1:ORDER_RECEIVED',
    });
    assert.deepEqual(body.from, { address: 'orders@example.com', name: 'Xelle' });
    assert.deepEqual(body.to, [{ email_address: { address: 'shopper@example.com' } }]);
    assert.deepEqual(body.reply_to, [{ address: 'owner@example.com' }]);
    assert.equal(body.htmlbody, '<p>Hi</p>');
    assert.equal(body.textbody, 'Hi');
    assert.equal(body.client_reference, 'order:1:ORDER_RECEIVED');
    assert.equal(body.track_opens, false);
  });

  test('omits reply_to when there is none', () => {
    const body = zeptoMailRequestBody({
      fromAddress: 'a@example.com',
      fromName: 'A',
      to: 'b@example.com',
      subject: 's',
      html: 'h',
      text: 't',
      clientReference: 'k',
    });
    assert.equal('reply_to' in body, false);
  });

  test('reads the request id only from a successful response', () => {
    const ok = { data: [{ code: 'EM_104', message: 'OK' }], message: 'OK', request_id: 'req-1' };
    assert.equal(zeptoMailRequestId(200, ok), 'req-1');
    assert.equal(zeptoMailRequestId(201, ok), 'req-1');
    assert.equal(zeptoMailRequestId(400, ok), '');
    assert.equal(zeptoMailRequestId(200, { message: 'OK' }), '');
    assert.equal(zeptoMailRequestId(200, null), '');
  });

  test('maps failures to bounded error codes', () => {
    assert.equal(zeptoMailErrorCode(401, null), 'ZEPTOMAIL_UNAUTHORIZED');
    assert.equal(zeptoMailErrorCode(429, null), 'ZEPTOMAIL_RATE_LIMITED');
    assert.equal(
      zeptoMailErrorCode(400, { data: { error_code: 'TM_3004', message: 'Invalid request' } }),
      'ZEPTOMAIL_TM_3004',
    );
    assert.equal(
      zeptoMailErrorCode(400, { data: { error_code: 'bad code; drop table' } }),
      'ZEPTOMAIL_SEND_FAILED',
    );
    assert.equal(zeptoMailErrorCode(503, null), 'ZEPTOMAIL_UNAVAILABLE');
  });
});

describe('ZeptoMail webhooks', () => {
  const now = 1_800_000_000_000;
  const payload = JSON.stringify({
    event_name: ['hardbounce'],
    webhook_request_id: 'hook-1',
    event_message: [
      {
        request_id: 'req-1',
        email_info: { processed_time: '2026-11-12T10:00:00Z' },
        event_data: [
          {
            object: 'hardbounce',
            details: [{ reason: 'Mailbox does not exist', time: '2026-11-12T10:00:05Z' }],
          },
        ],
      },
    ],
  });

  test('accepts a valid signature over a JSON body', () => {
    const signed = verifyZeptoMailWebhook({
      rawBody: payload,
      signatureHeader: signatureFor(payload, now),
      secret,
      now,
    });
    assert.equal(signed, payload);
  });

  test('accepts a signature over a form-encoded event value', () => {
    const rawBody = `event=${encodeURIComponent(payload)}`;
    const signed = verifyZeptoMailWebhook({
      rawBody,
      signatureHeader: signatureFor(payload, now),
      secret,
      now,
    });
    assert.equal(signed, payload);
  });

  test('rejects a wrong secret, a tampered body, and stale timestamps', () => {
    const header = signatureFor(payload, now);
    assert.equal(
      verifyZeptoMailWebhook({ rawBody: payload, signatureHeader: header, secret: 'x', now }),
      null,
    );
    assert.equal(
      verifyZeptoMailWebhook({
        rawBody: payload.replace('req-1', 'req-2'),
        signatureHeader: header,
        secret,
        now,
      }),
      null,
    );
    assert.equal(
      verifyZeptoMailWebhook({
        rawBody: payload,
        signatureHeader: header,
        secret,
        now: now + 6 * 60 * 1000,
      }),
      null,
    );
    assert.equal(
      verifyZeptoMailWebhook({ rawBody: payload, signatureHeader: 'garbage', secret, now }),
      null,
    );
  });

  test('maps bounces, complaints, and deliveries to queue events', () => {
    assert.deepEqual(zeptoMailWebhookEvent(JSON.parse(payload)), {
      eventId: 'zeptomail:hook-1',
      eventType: 'email.bounced',
      providerMessageId: 'req-1',
      createdAt: '2026-11-12T10:00:05.000Z',
      errorCode: 'Mailbox does not exist',
    });
    const event = (name, object) => ({
      event_name: name,
      webhook_request_id: 'hook-2',
      event_message: { request_id: 'req-2', event_data: { object, details: {} } },
    });
    assert.equal(
      zeptoMailWebhookEvent(event('soft bounce', 'softbounce')).eventType,
      'email.delivery_delayed',
    );
    assert.equal(
      zeptoMailWebhookEvent({
        ...event('feedback_loop', ''),
        event_message: { request_id: 'r', object: 'fbl_complaint', event_data: {} },
      }).eventType,
      'email.complained',
    );
    assert.equal(zeptoMailWebhookEvent(event('delivered', '')).eventType, 'email.delivered');
  });

  test('ignores opens, clicks, and incomplete events', () => {
    const base = { webhook_request_id: 'h', event_message: { request_id: 'r' } };
    assert.equal(zeptoMailWebhookEvent({ ...base, event_name: 'email_open' }), null);
    assert.equal(zeptoMailWebhookEvent({ ...base, event_name: 'email_link_click' }), null);
    assert.equal(zeptoMailWebhookEvent({ event_name: 'hardbounce' }), null);
    assert.equal(zeptoMailWebhookEvent(null), null);
  });
});
