import { prisma } from "@/lib/db";
import { ensureSalesTables } from "@/lib/sales-system";

const DEFAULTS = {
  newOrderTask: true,
  followup24h: true,
  postSale48h: true,
  unassignedAlert: true,
  lowStockAlert: true,
};

async function recentNotification(type:string,message:string,hours=12){
  const since=new Date(Date.now()-hours*3600_000);
  return prisma.notification.findFirst({where:{type,message,createdAt:{gte:since}},select:{id:true}});
}

async function notifyOnce(type:string,message:string,hours=12){
  if(await recentNotification(type,message,hours))return false;
  await prisma.notification.create({data:{type,message}});
  return true;
}

export async function runCommercialAutomations(){
  await ensureSalesTables();
  const setting=await prisma.siteSetting.findUnique({where:{key:"crmAutomations"}});
  let cfg:any={...DEFAULTS};
  try{cfg={...cfg,...JSON.parse(setting?.value||"{}")}}catch{}

  await prisma.$executeRawUnsafe(
    'UPDATE "Quote" SET "status"=\\'EXPIRED\\',"updatedAt"=NOW() WHERE "status" IN (\\'DRAFT\\',\\'SENT\\') AND "validUntil" IS NOT NULL AND "validUntil" < NOW()'
  );

  let created=0;

  if(cfg.unassignedAlert){
    const rows=await prisma.$queryRawUnsafe<any[]>(
      'SELECT "id","customerName","title" FROM "Opportunity" WHERE "stage" IN (\\'NEW\\',\\'CONTACTED\\',\\'QUOTED\\',\\'NEGOTIATION\\') AND "assignedSellerId" IS NULL ORDER BY "updatedAt" DESC LIMIT 20'
    );
    for(const row of rows){
      const msg="Oportunidad sin responsable: "+(row.customerName||row.title);
      if(await notifyOnce("opportunity_unassigned",msg,12))created++;
    }
  }

  if(cfg.followup24h){
    const rows=await prisma.$queryRawUnsafe<any[]>(
      'SELECT "id","customerName","title","nextAction" FROM "Opportunity" WHERE "stage" IN (\\'NEW\\',\\'CONTACTED\\',\\'QUOTED\\',\\'NEGOTIATION\\') AND "nextAt" IS NOT NULL AND "nextAt" <= NOW() ORDER BY "nextAt" ASC LIMIT 30'
    );
    for(const row of rows){
      const msg="Seguimiento vencido: "+(row.customerName||row.title)+(row.nextAction?" · "+row.nextAction:"");
      if(await notifyOnce("opportunity_followup",msg,8))created++;
    }
  }

  if(cfg.lowStockAlert){
    const products=await prisma.product.findMany({include:{variants:true},take:500});
    for(const p of products){
      if(p.variants.length){
        for(const v of p.variants){
          if(v.active&&v.stock<=p.lowStockAlert){
            const msg="Stock bajo: "+p.name+" · "+v.name+" ("+v.stock+" und.)";
            if(await notifyOnce("low_stock",msg,24))created++;
          }
        }
      }else if(p.stock<=p.lowStockAlert){
        const msg="Stock bajo: "+p.name+" ("+p.stock+" und.)";
        if(await notifyOnce("low_stock",msg,24))created++;
      }
    }
  }

  if(cfg.postSale48h){
    const from=new Date(Date.now()-72*3600_000);
    const to=new Date(Date.now()-24*3600_000);
    const delivered=await prisma.order.findMany({where:{shipStatus:"DELIVERED",updatedAt:{gte:from,lte:to}},include:{customer:true},take:30});
    for(const order of delivered){
      const msg="Postventa pendiente: "+order.number+" · "+(order.customer?.name||"Cliente");
      if(await notifyOnce("post_sale",msg,48))created++;
    }
  }

  return {created};
}
