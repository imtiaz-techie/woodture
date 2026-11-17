// SSLCOMMERZ posts here (customer redirect + server-to-server IPN).
// Nothing in the POST body is trusted: a payment is marked paid only after the
// gateway's validation API confirms it and the amount matches our own record.
import { admin, env, sslBase } from '../_shared/gateway.ts';

Deno.serve(async req => {
  const kind = new URL(req.url).searchParams.get('kind') ?? 'ipn';
  const site = env('SITE_URL').replace(/\/$/, '');
  let orderNumber = '';
  let outcome = kind === 'success' || kind === 'ipn' ? 'failed' : kind;

  try {
    const body = Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
    const tranId = String(body.tran_id ?? '');
    const sb = admin();

    const { data: payment } = await sb.from('payments').select('*').eq('provider', 'sslcommerz').eq('transaction_ref', tranId).maybeSingle();
    if (!payment) throw new Error('Unknown transaction');
    const { data: order } = await sb.from('orders').select('id, order_number, payment_status').eq('id', payment.order_id).single();
    orderNumber = order?.order_number ?? '';

    if (payment.status === 'paid') {
      outcome = 'success'; // already verified earlier (IPN and redirect both arrive) — do nothing twice
    } else if ((kind === 'success' || kind === 'ipn') && body.val_id) {
      const q = new URLSearchParams({
        val_id: body.val_id, store_id: env('SSLCOMMERZ_STORE_ID'), store_passwd: env('SSLCOMMERZ_STORE_PASSWORD'), format: 'json',
      });
      const v = await (await fetch(`${sslBase()}/validator/api/validationserverAPI.php?${q}`)).json();
      const valid = ['VALID', 'VALIDATED'].includes(v.status) && v.tran_id === tranId
        && v.currency_type === 'BDT' && Math.abs(Number(v.currency_amount) - Number(payment.amount)) < 0.01;
      if (valid) {
        // Conditional update: only one concurrent callback can flip pending -> paid.
        const { data: flipped } = await sb.from('payments').update({ status: 'paid', raw: v, updated_at: new Date().toISOString() })
          .eq('id', payment.id).neq('status', 'paid').select('id');
        if (flipped?.length) await sb.from('orders').update({ payment_status: 'paid' }).eq('id', payment.order_id);
        outcome = 'success';
      } else {
        await sb.from('payments').update({ status: 'failed', raw: v }).eq('id', payment.id).neq('status', 'paid');
        if (order?.payment_status !== 'paid') await sb.from('orders').update({ payment_status: 'failed' }).eq('id', payment.order_id);
      }
    } else if (kind === 'failed' || kind === 'cancelled') {
      await sb.from('payments').update({ status: 'failed', raw: body }).eq('id', payment.id).neq('status', 'paid');
      if (order?.payment_status !== 'paid') await sb.from('orders').update({ payment_status: 'failed' }).eq('id', payment.order_id);
    }
  } catch (e) {
    console.error(e);
  }

  if (kind === 'ipn') return new Response('ok');
  const to = orderNumber ? `${site}/order/${encodeURIComponent(orderNumber)}?payment=${outcome}` : `${site}/track`;
  return new Response(null, { status: 303, headers: { Location: to } });
});
