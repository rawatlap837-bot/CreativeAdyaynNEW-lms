import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const keyId=Deno.env.get("RAZORPAY_KEY_ID")||"";
const keySecret=Deno.env.get("RAZORPAY_KEY_SECRET")||"";
const origins=(Deno.env.get("APP_ORIGINS")||"http://localhost:5173").split(",").map(v=>v.trim());

Deno.serve(async(request:Request)=>{
  const origin=request.headers.get("origin")||"";
  const headers={"Access-Control-Allow-Origin":origins.includes(origin)?origin:origins[0],"Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json",Vary:"Origin"};
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.includes(origin)) return reply({error:"Origin is not allowed."},403);
  if(request.method==="OPTIONS") return new Response("ok",{headers});
  if(request.method!=="POST") return reply({error:"Method not allowed."},405);
  try{
    const token=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
    if(!token) return reply({error:"Sign in before paying."},401);
    const {data:{user}}=await admin.auth.getUser(token);
    if(!user) return reply({error:"Your session has expired."},401);
    const {installmentId}=await request.json();
    if(typeof installmentId!=="string") return reply({error:"Installment is required."},400);
    const {data:row,error}=await admin.from("lms_emi_installments")
      .select("id,plan_id,installment_number,amount,status,razorpay_order_id,lms_installment_plans!inner(student_id,course_id,status,lms_courses(currency,title))")
      .eq("id",installmentId).single();
    if(error||!row) return reply({error:"Installment was not found."},404);
    const plan:any=row.lms_installment_plans;
    if(plan.student_id!==user.id) return reply({error:"This installment does not belong to you."},403);
    if(row.status==="paid") return reply({error:"This installment is already paid."},409);
    if(!["unpaid","created","overdue"].includes(row.status)) return reply({error:"This installment cannot be paid."},409);
    if(!keyId||!keySecret) return reply({error:"Online payment is not configured."},503);
    if(row.razorpay_order_id&&row.status==="created") return reply({keyId,orderId:row.razorpay_order_id,amount:row.amount,currency:plan.lms_courses.currency||"INR"});
    const response=await fetch("https://api.razorpay.com/v1/orders",{method:"POST",headers:{Authorization:`Basic ${btoa(`${keyId}:${keySecret}`)}`,"Content-Type":"application/json"},body:JSON.stringify({amount:Number(row.amount),currency:plan.lms_courses.currency||"INR",receipt:crypto.randomUUID(),notes:{installmentId:row.id,planId:row.plan_id,courseId:plan.course_id,studentId:user.id}})});
    const order=await response.json();
    if(!response.ok) throw new Error("Payment provider is unavailable. Please try again.");
    const {error:updateError}=await admin.from("lms_emi_installments").update({razorpay_order_id:order.id,status:"created",updated_at:new Date().toISOString()}).eq("id",row.id).in("status",["unpaid","overdue"]);
    if(updateError) throw updateError;
    return reply({keyId,orderId:order.id,amount:row.amount,currency:order.currency,installmentNumber:row.installment_number,courseTitle:plan.lms_courses.title});
  }catch(error){console.error(error);return reply({error:error instanceof Error?error.message:"Unable to create payment order."},400);}
});
