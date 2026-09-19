import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ensureSalesTables } from "@/lib/sales-system";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest){
  try{
    const session=await getSession();
    if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
    const q=String(req.nextUrl.searchParams.get("q")||"").trim();
    if(q.length<2)return NextResponse.json([]);
    const can=(p:string)=>session.role==="ADMIN"||session.permissions?.includes(p as any);
    const results:any[]=[];

    if(can("customers.view")){
      const customers=await prisma.customer.findMany({
        where:{OR:[
          {name:{contains:q,mode:"insensitive"}},
          {phone:{contains:q}},
          {email:{contains:q,mode:"insensitive"}},
          {city:{contains:q,mode:"insensitive"}},
        ]},
        take:6,
        orderBy:{updatedAt:"desc"},
      });
      results.push(...customers.map(c=>({type:"Cliente",title:c.name,subtitle:[c.phone,c.city].filter(Boolean).join(" · "),href:"/admin/clientes?customerId="+c.id})));
    }

    if(can("orders.view")){
      const orders=await prisma.order.findMany({
        where:{OR:[
          {number:{contains:q,mode:"insensitive"}},
          {customer:{name:{contains:q,mode:"insensitive"}}},
          {customer:{phone:{contains:q}}},
        ]},
        include:{customer:true},
        take:6,
        orderBy:{updatedAt:"desc"},
      });
      results.push(...orders.map(o=>({type:"Pedido",title:o.number,subtitle:(o.customer?.name||"Cliente")+" · "+o.shipStatus,href:"/admin/pedidos?orderId="+o.id})));
    }

    if(can("products.view")){
      const products=await prisma.product.findMany({
        where:{OR:[
          {name:{contains:q,mode:"insensitive"}},
          {sku:{contains:q,mode:"insensitive"}},
          {variants:{some:{OR:[{sku:{contains:q,mode:"insensitive"}},{name:{contains:q,mode:"insensitive"}}]}}},
        ]},
        take:6,
        orderBy:{updatedAt:"desc"},
      });
      results.push(...products.map(p=>({type:"Producto",title:p.name,subtitle:p.sku,href:"/admin/productos"})));
    }

    if(can("crm.view")){
      await ensureSalesTables();
      const like="%"+q+"%";
      const oppSql="SELECT \"id\",\"customerName\",\"phone\",\"title\",\"stage\",\"value\" FROM \"Opportunity\" WHERE COALESCE(\"customerName\", '') ILIKE $1 OR COALESCE(\"phone\", '') ILIKE $1 OR \"title\" ILIKE $1 ORDER BY \"updatedAt\" DESC LIMIT 6";
      const opps=await prisma.$queryRawUnsafe<any[]>(oppSql,like);
      results.push(...opps.map(o=>({type:"Oportunidad",title:o.customerName||o.title,subtitle:o.title+" · "+o.stage,href:"/admin/crm?opportunityId="+o.id})));

      const quoteSql="SELECT \"id\",\"number\",\"customerName\",\"status\",\"total\" FROM \"Quote\" WHERE \"number\" ILIKE $1 OR COALESCE(\"customerName\", '') ILIKE $1 ORDER BY \"updatedAt\" DESC LIMIT 6";
      const quotes=await prisma.$queryRawUnsafe<any[]>(quoteSql,like);
      results.push(...quotes.map(x=>({type:"Cotización",title:x.number,subtitle:(x.customerName||"Cliente")+" · "+x.status,href:"/admin/cotizaciones"})));
    }

    return NextResponse.json(results.slice(0,24),{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("[GLOBAL_SEARCH]",error);
    return NextResponse.json({error:"No se pudo buscar"},{status:500});
  }
}
