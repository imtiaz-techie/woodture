// POST { order_number, phone }  ->  { url }   (hosted payment page to redirect the customer to)
//
// The amount always comes from the order row in the database, never from the browser.
import { admin, cors, digits, env, json, sslBase } from '../_shared/gateway.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { order_number, phone } = await req.json();
    const sb = admin();

    const { data: settings } = await sb.from('website_settings').select('value').eq('key', 'general').single();
    const pay = settings?.value?.payment ?? {};
    if (!pay.online_enabled) return json({ error: 'Online payment is not enabled.' });

    const { data: order } = await sb.from('orders').select('*').eq('order_number', String(order_number ?? '').toUpperCase()).maybeSingle();
    // Same proof as order tracking: the order number plus the phone used at checkout.
    if (!order || digits(phone).length < 6 || digits(order.phone) !== digits(phone)) return json({ error: 'Order not found.' });
    if (order.payment_method !== 'online') return json({ error: 'This order does not use online payment.' });
    if (order.payment_status === 'paid') return json({ error: 'This order is already paid.' });
    if (['cancelled', 'returned'].includes(order.status)) return json({ error: 'This order is no longer active.' });

    const provider = pay.online_provider ?? 'sslcommerz';
    if (provider !== 'sslcommerz') {
      // bKash / Nagad: add their tokenized-checkout "create payment" call here once merchant
      // API credentials are issued, and verify it in payment-callback in the same way.
      return json({ error: `The ${provider} gateway has not been set up yet.` });
    }

    // A fresh transaction id per attempt; the unique index on (provider, transaction_ref)
    // guarantees a gateway transaction can never be recorded twice.
    const tranId = `${order.order_number}-${crypto.randomUUID().slice(0, 8)}`;
    const { error: payErr } = await sb.from('payments').insert({
      order_id: order.id, method: 'online', provider, amount: order.total, status: 'pending', transaction_ref: tranId,
    });
    if (payErr) throw new Error(payErr.message);

    const callback = `${env('SUPABASE_URL')}/functions/v1/payment-callback`;
    const form = new URLSearchParams({
      store_id: env('SSLCOMMERZ_STORE_ID'),
      store_passwd: env('SSLCOMMERZ_STORE_PASSWORD'),
      total_amount: Number(order.total).toFixed(2),
      currency: 'BDT',
      tran_id: tranId,
      success_url: `${callback}?kind=success`,
      fail_url: `${callback}?kind=failed`,
      cancel_url: `${callback}?kind=cancelled`,
      ipn_url: `${callback}?kind=ipn`,
      cus_name: order.customer_name,
      cus_email: order.email || 'customer@example.com',
      cus_phone: order.phone,
      cus_add1: order.address,
      cus_city: order.city,
      cus_postcode: order.postal_code || '0000',
      cus_country: 'Bangladesh',
      shipping_method: 'Courier',
      ship_name: order.customer_name,
      ship_add1: order.address,
      ship_city: order.city,
      ship_postcode: order.postal_code || '0000',
      ship_country: 'Bangladesh',
      product_name: `Order ${order.order_number}`,
      product_category: 'Handcrafted wooden art',
      product_profile: 'physical-goods',
    });
    const res = await fetch(`${sslBase()}/gwprocess/v4/api.php`, { method: 'POST', body: form });
    const data = await res.json();
    if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      await sb.from('payments').update({ status: 'failed', raw: data }).eq('transaction_ref', tranId);
      return json({ error: data.failedreason || 'Could not start the payment. Please try again.' });
    }
    await sb.from('orders').update({ payment_status: 'pending' }).eq('id', order.id);
    return json({ url: data.GatewayPageURL });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Payment error.' });
  }
});
