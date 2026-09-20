import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export type AiProviderId = "openai" | "anthropic" | "gemini";
export type AiChatMessage = { role: "system" | "user" | "assistant"; content: string };

export const AI_PROVIDERS: Record<AiProviderId,{name:string;defaultModel:string;secretKey:string}> = {
  openai: { name: "OpenAI", defaultModel: "gpt-5", secretKey: "AI_OPENAI_API_KEY" },
  anthropic: { name: "Anthropic", defaultModel: "claude-sonnet-4-20250514", secretKey: "AI_ANTHROPIC_API_KEY" },
  gemini: { name: "Google Gemini", defaultModel: "gemini-3.5-flash", secretKey: "AI_GEMINI_API_KEY" },
};

function encryptionKey(){
  const secret=process.env.JWT_SECRET?.trim();
  if(!secret) throw new Error("JWT_SECRET no está configurado");
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value:string){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  const tag=cipher.getAuthTag();
  return "enc:v1:"+Buffer.concat([iv,tag,encrypted]).toString("base64");
}

function decrypt(value:string){
  if(!value.startsWith("enc:v1:")) return value;
  const raw=Buffer.from(value.slice(7),"base64");
  const iv=raw.subarray(0,12), tag=raw.subarray(12,28), encrypted=raw.subarray(28);
  const decipher=crypto.createDecipheriv("aes-256-gcm",encryptionKey(),iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted),decipher.final()]).toString("utf8");
}

async function getSecretRow(key:string){
  const rows=await prisma.$queryRawUnsafe<Array<{key:string;value:string;updatedAt:Date}>>(
    'SELECT "key","value","updatedAt" FROM "AiCredential" WHERE "key"=$1 LIMIT 1',
    key
  );
  return rows[0]||null;
}

export async function getAiApiKey(provider:AiProviderId){
  const meta=AI_PROVIDERS[provider];
  const row=await getSecretRow(meta.secretKey);
  if(!row) return null;
  return decrypt(row.value);
}

export async function saveAiApiKey(provider:AiProviderId,apiKey:string){
  const meta=AI_PROVIDERS[provider];
  const value=encrypt(apiKey.trim());
  await prisma.$executeRawUnsafe(
    'INSERT INTO "AiCredential" ("key","value","updatedAt") VALUES ($1,$2,NOW()) ON CONFLICT ("key") DO UPDATE SET "value"=EXCLUDED."value","updatedAt"=NOW()',
    meta.secretKey,value
  );
}

export async function deleteAiApiKey(provider:AiProviderId){
  await prisma.$executeRawUnsafe('DELETE FROM "AiCredential" WHERE "key"=$1',AI_PROVIDERS[provider].secretKey);
}

export async function getProviderStatus(provider:AiProviderId){
  const row=await getSecretRow(AI_PROVIDERS[provider].secretKey);
  if(!row) return {connected:false,maskedKey:null,updatedAt:null};
  let maskedKey="••••••••";
  try{
    const value=decrypt(row.value);
    maskedKey=value.length>4?"••••••••"+value.slice(-4):"••••••••";
  }catch{}
  return {connected:true,maskedKey,updatedAt:row.updatedAt};
}

async function readError(response:Response){
  const raw=await response.text();
  try{
    const data=raw?JSON.parse(raw):{};
    return data?.error?.message||data?.message||raw||("HTTP "+response.status);
  }catch{return raw||("HTTP "+response.status)}
}

function cleanMessages(messages:AiChatMessage[]){
  return messages
    .filter(m=>m&&typeof m.content==="string"&&m.content.trim())
    .slice(-30)
    .map(m=>({...m,content:m.content.trim().slice(0,12000)}));
}

async function callOpenAI(apiKey:string,model:string,messages:AiChatMessage[]){
  const input=cleanMessages(messages).map(m=>({
    role:m.role==="system"?"developer":m.role,
    content:m.content,
  }));
  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({model,input,max_output_tokens:1200}),
  });
  if(!response.ok) throw new Error(await readError(response));
  const data:any=await response.json();
  const text=(data.output||[])
    .flatMap((item:any)=>item?.content||[])
    .filter((part:any)=>part?.type==="output_text"||typeof part?.text==="string")
    .map((part:any)=>part?.text||"")
    .join("")
    .trim();
  return {text:text||data.output_text||"Sin respuesta de texto.",usage:data.usage||null,model:data.model||model};
}

async function callAnthropic(apiKey:string,model:string,messages:AiChatMessage[]){
  const clean=cleanMessages(messages);
  const system=clean.filter(m=>m.role==="system").map(m=>m.content).join("\n\n");
  const chat=clean.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.content}));
  const response=await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01","Content-Type":"application/json"},
    body:JSON.stringify({model,max_tokens:1200,system:system||undefined,messages:chat}),
  });
  if(!response.ok) throw new Error(await readError(response));
  const data:any=await response.json();
  const text=(data.content||[]).filter((x:any)=>x?.type==="text").map((x:any)=>x.text||"").join("").trim();
  return {text:text||"Sin respuesta de texto.",usage:data.usage||null,model:data.model||model};
}

async function callGemini(apiKey:string,model:string,messages:AiChatMessage[]){
  const clean=cleanMessages(messages);
  const system=clean.filter(m=>m.role==="system").map(m=>m.content).join("\n\n");
  const contents=clean.filter(m=>m.role!=="system").map(m=>({
    role:m.role==="assistant"?"model":"user",
    parts:[{text:m.content}],
  }));
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
    method:"POST",
    headers:{"x-goog-api-key":apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({
      contents,
      systemInstruction:system?{parts:[{text:system}]}:undefined,
      generationConfig:{maxOutputTokens:1200},
    }),
  });
  if(!response.ok) throw new Error(await readError(response));
  const data:any=await response.json();
  const text=(data.candidates?.[0]?.content?.parts||[]).map((x:any)=>x?.text||"").join("").trim();
  return {text:text||"Sin respuesta de texto.",usage:data.usageMetadata||null,model:data.modelVersion||model};
}

export async function runAiChat(input:{provider:AiProviderId;model?:string;messages:AiChatMessage[];apiKeyOverride?:string}){
  const meta=AI_PROVIDERS[input.provider];
  if(!meta) throw new Error("Proveedor no soportado");
  const apiKey=input.apiKeyOverride?.trim()||await getAiApiKey(input.provider);
  if(!apiKey) throw new Error(meta.name+" no está conectado");
  const model=(input.model||meta.defaultModel).trim();
  if(input.provider==="openai") return callOpenAI(apiKey,model,input.messages);
  if(input.provider==="anthropic") return callAnthropic(apiKey,model,input.messages);
  return callGemini(apiKey,model,input.messages);
}

export async function testAiKey(provider:AiProviderId,apiKey:string,model?:string){
  return runAiChat({
    provider,
    apiKeyOverride:apiKey,
    model:model||AI_PROVIDERS[provider].defaultModel,
    messages:[{role:"user",content:"Responde únicamente con la palabra OK."}],
  });
}
