import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { validSignature, assertCapturedPayment } from "../_shared/payments.js";

const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});

Deno.serve(async(request:Request)=>{
  if(request.method!=="POST") return new Response("Method not allowed",{status:405});
  const secret=Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if(!secret) return new Response("Webhook is not configured",{status:503});
  const raw=await request.text();
  if(!await validSignature(secret,raw,request.headers.get("x-razorpay-signature"))) return new Response("Invalid signature",{status:401});
  try{
    const event=JSON.parse(raw);
    if(event.event!=="payment.captured") return new Response("Ignored");
    const payment=event.payload?.payment?.entity;
    if(!payment?.order_id||!payment?.id) throw new Error("Payment reference is missing");
    const {data:paymentOrder,error:paymentOrderError}=await admin.from("lms_payments").select("*").eq("order_id",payment.order_id).maybeSingle();
    if(paymentOrderError) throw paymentOrderError;
    if(paymentOrder){
      assertCapturedPayment(payment,paymentOrder);
      const {error:confirmPaymentError}=await admin.rpc("lms_confirm_payment",{order_ref:payment.order_id,payment_ref:payment.id});
      if(confirmPaymentError) throw confirmPaymentError;
      return new Response("OK");
    }
    const {data:installment,error}=await admin.from("lms_emi_installments").select("id,amount,razorpay_payment_id").eq("razorpay_order_id",payment.order_id).single();
    if(error||!installment) throw new Error("Installment order was not found");
    if(Number(payment.amount)!==Number(installment.amount)||payment.status!=="captured") throw new Error("Captured payment does not match installment");
    if(installment.razorpay_payment_id&&installment.razorpay_payment_id!==payment.id) throw new Error("Order was already paid by another payment");
    const {error:confirmError}=await admin.rpc("lms_confirm_emi_installment",{order_ref:payment.order_id,payment_ref:payment.id});
    if(confirmError) throw confirmError;
    return new Response("OK");
  }catch(error){console.error(error);return new Response("Unable to process payment; retry delivery",{status:500});}
});
