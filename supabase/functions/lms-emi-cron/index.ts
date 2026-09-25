import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});

Deno.serve(async(request:Request)=>{
  const expected=Deno.env.get("CRON_SECRET")||"";
  if(!expected||request.headers.get("authorization")!==`Bearer ${expected}`) return new Response("Unauthorized",{status:401});
  try{
    const now=new Date();
    const {data:plans,error}=await admin.from("lms_installment_plans").select("id,student_id,course_id,grace_days").in("status",["active","overdue"]);
    if(error) throw error;
    for(const plan of plans||[]){
      const {data:due,error:dueError}=await admin.from("lms_emi_installments").select("id,due_at,status").eq("plan_id",plan.id).in("status",["unpaid","created","overdue"]).not("due_at","is",null).order("installment_number").limit(1).maybeSingle();
      if(dueError) throw dueError;
      if(due?.due_at&&new Date(due.due_at)<=now){
        await admin.from("lms_emi_installments").update({status:"overdue",updated_at:now.toISOString()}).eq("id",due.id).neq("status","paid");
        const defaulted=now.getTime()>new Date(due.due_at).getTime()+Number(plan.grace_days||7)*86400000;
        await admin.from("lms_installment_plans").update({status:defaulted?"defaulted":"overdue",updated_at:now.toISOString()}).eq("id",plan.id);
      }
      await admin.rpc("recompute_module_access",{p_student:plan.student_id,p_course:plan.course_id,p_plan_id:plan.id});
    }
    return Response.json({processed:plans?.length||0});
  }catch(error){console.error(error);return Response.json({error:"Cron failed"},{status:500});}
});
